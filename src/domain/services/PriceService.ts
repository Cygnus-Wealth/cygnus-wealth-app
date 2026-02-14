/**
 * PriceService
 * 
 * Domain service for fetching and managing asset prices with multi-layer caching.
 * Implements progressive loading, background refresh, and fallback strategies.
 */

import { Price } from '../asset/Price';
import { Result } from '../shared/Result';
import { DomainError, ServiceError } from '../shared/DomainError';

export interface PriceFetchRequest {
  symbol: string;
  currency?: string;
  preferCache?: boolean;
  maxCacheAge?: number; // milliseconds
}

export interface PriceFetchResult {
  price: Price;
  fetchDuration: number;
}

export interface BatchPriceFetchResult {
  prices: Map<string, Price>;
  fetchDuration: number;
  successCount: number;
  failureCount: number;
}

export interface IPriceProvider {
  fetchPrice(symbol: string, currency: string): Promise<Result<number, Error>>;
  fetchBatchPrices(symbols: string[], currency: string): Promise<Map<string, number>>;
  getProviderName(): string;
  getPriority(): number; // Lower number = higher priority
}

export interface IPriceCache {
  get(key: string): Promise<Price | null>;
  set(key: string, price: Price, ttl?: number): Promise<void>;
  getBatch(keys: string[]): Promise<Map<string, Price>>;
  setBatch(prices: Map<string, Price>, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  getStats(): Promise<{ hits: number; misses: number; size: number }>;
}

export class PriceService {
  private providers: IPriceProvider[] = [];
  private cache?: IPriceCache;
  private fallbackPrices: Map<string, Price> = new Map();
  private refreshQueue: Set<string> = new Set();
  private isRefreshing: boolean = false;
  
  // Configuration
  private readonly defaultCurrency = 'USD';
  private readonly defaultTTL = 10000; // 10 seconds
  private readonly staleTTL = 60000; // 1 minute
  private readonly batchSize = 50;

  constructor(cache?: IPriceCache) {
    this.cache = cache;
    this.startBackgroundRefresh();
  }

  /**
   * Register a price provider
   */
  public registerProvider(provider: IPriceProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.getPriority() - b.getPriority());
  }

  /**
   * Fetch price for a single asset
   */
  public async fetchPrice(
    request: PriceFetchRequest
  ): Promise<Result<PriceFetchResult, DomainError>> {
    const startTime = Date.now();
    const currency = request.currency || this.defaultCurrency;
    const cacheKey = this.getCacheKey(request.symbol, currency);

    try {
      // 1. Check memory cache first
      if (request.preferCache && this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached && !cached.isExpired()) {
          const maxAge = request.maxCacheAge || this.staleTTL;
          if (cached.getAge() <= maxAge) {
            return Result.success({
              price: cached,
              fetchDuration: Date.now() - startTime
            });
          }
        }
      }

      // 2. Check fallback prices
      const fallback = this.fallbackPrices.get(cacheKey);
      if (fallback && !fallback.isExpired()) {
        // Queue for background refresh
        this.queueForRefresh(request.symbol, currency);
        
        return Result.success({
          price: fallback,
          fetchDuration: Date.now() - startTime
        });
      }

      // 3. Fetch from providers
      const price = await this.fetchFromProviders(request.symbol, currency);
      
      if (price) {
        // Cache the result
        if (this.cache) {
          await this.cache.set(cacheKey, price, this.defaultTTL);
        }
        
        // Update fallback
        this.fallbackPrices.set(cacheKey, price);
        
        return Result.success({
          price,
          fetchDuration: Date.now() - startTime
        });
      }

      // 4. Return stale cache if available
      if (this.cache) {
        const stale = await this.cache.get(cacheKey);
        if (stale) {
          const refreshedPrice = stale.refresh();
          return Result.success({
            price: refreshedPrice,
            fetchDuration: Date.now() - startTime
          });
        }
      }

      // 5. Return expired fallback if nothing else
      if (fallback) {
        return Result.success({
          price: fallback.refresh(),
          fetchDuration: Date.now() - startTime
        });
      }

      return Result.failure(
        new ServiceError(
          'PRICE_NOT_AVAILABLE',
          `No price available for ${request.symbol}`
        )
      );

    } catch (error) {
      return Result.failure(
        new ServiceError(
          'PRICE_FETCH_ERROR',
          error instanceof Error ? error.message : 'Unknown error fetching price'
        )
      );
    }
  }

  /**
   * Fetch prices for multiple assets in batch
   */
  public async fetchBatchPrices(
    symbols: string[],
    currency: string = 'USD'
  ): Promise<Result<BatchPriceFetchResult, DomainError>> {
    const startTime = Date.now();
    const prices = new Map<string, Price>();
    let successCount = 0;
    let failureCount = 0;

    try {
      // 1. Check cache for all symbols
      const cacheKeys = symbols.map(s => this.getCacheKey(s, currency));
      const cachedPrices = this.cache ? await this.cache.getBatch(cacheKeys) : new Map();
      
      const uncachedSymbols: string[] = [];
      
      for (const symbol of symbols) {
        const cacheKey = this.getCacheKey(symbol, currency);
        const cached = cachedPrices.get(cacheKey);
        
        if (cached && !cached.isExpired()) {
          prices.set(symbol, cached);
          successCount++;
        } else {
          uncachedSymbols.push(symbol);
        }
      }

      // 2. Fetch uncached prices in batches
      if (uncachedSymbols.length > 0) {
        const batches = this.chunkArray(uncachedSymbols, this.batchSize);
        
        for (const batch of batches) {
          const batchPrices = await this.fetchBatchFromProviders(batch, currency);
          
          for (const [symbol, price] of batchPrices) {
            prices.set(symbol, price);
            successCount++;
            
            // Cache the result
            if (this.cache) {
              const cacheKey = this.getCacheKey(symbol, currency);
              await this.cache.set(cacheKey, price, this.defaultTTL);
            }
          }
          
          failureCount += batch.length - batchPrices.size;
        }
      }

      return Result.success({
        prices,
        fetchDuration: Date.now() - startTime,
        successCount,
        failureCount
      });

    } catch (error) {
      return Result.failure(
        new ServiceError(
          'BATCH_PRICE_FETCH_ERROR',
          error instanceof Error ? error.message : 'Unknown error fetching batch prices'
        )
      );
    }
  }

  /**
   * Fetch from providers with fallback
   */
  private async fetchFromProviders(
    symbol: string,
    currency: string
  ): Promise<Price | null> {
    for (const provider of this.providers) {
      try {
        const result = await provider.fetchPrice(symbol, currency);
        if (result.isSuccess) {
          return Price.live(
            result.value,
            currency,
            provider.getProviderName()
          );
        }
      } catch (error) {
        console.warn(`Provider ${provider.getProviderName()} failed for ${symbol}:`, error);
      }
    }
    
    return null;
  }

  /**
   * Batch fetch from providers
   */
  private async fetchBatchFromProviders(
    symbols: string[],
    currency: string
  ): Promise<Map<string, Price>> {
    const prices = new Map<string, Price>();
    
    for (const provider of this.providers) {
      try {
        const batchResult = await provider.fetchBatchPrices(symbols, currency);
        
        for (const [symbol, amount] of batchResult) {
          if (!prices.has(symbol)) {
            prices.set(
              symbol,
              Price.live(amount, currency, provider.getProviderName())
            );
          }
        }
        
        // If we got all prices, stop trying other providers
        if (prices.size === symbols.length) {
          break;
        }
      } catch (error) {
        console.warn(`Batch fetch failed for provider ${provider.getProviderName()}:`, error);
      }
    }
    
    return prices;
  }

  /**
   * Queue symbol for background refresh
   */
  private queueForRefresh(symbol: string, currency: string): void {
    const key = `${symbol}:${currency}`;
    this.refreshQueue.add(key);
  }

  /**
   * Start background refresh process
   */
  private startBackgroundRefresh(): void {
    setInterval(async () => {
      if (this.isRefreshing || this.refreshQueue.size === 0) {
        return;
      }
      
      this.isRefreshing = true;
      const toRefresh = Array.from(this.refreshQueue);
      this.refreshQueue.clear();
      
      try {
        for (const key of toRefresh) {
          const [symbol, currency] = key.split(':');
          await this.fetchFromProviders(symbol, currency);
        }
      } catch (error) {
        console.error('Background refresh error:', error);
      } finally {
        this.isRefreshing = false;
      }
    }, 5000); // Run every 5 seconds
  }

  /**
   * Invalidate cache for pattern
   */
  public async invalidateCache(pattern: string): Promise<void> {
    if (this.cache) {
      await this.cache.invalidate(pattern);
    }
    
    // Clear matching fallback prices
    for (const key of this.fallbackPrices.keys()) {
      if (key.includes(pattern)) {
        this.fallbackPrices.delete(key);
      }
    }
  }

  /**
   * Warm cache with commonly used prices
   */
  public async warmCache(symbols: string[], currency: string = 'USD'): Promise<void> {
    // Fetch in background without waiting
    this.fetchBatchPrices(symbols, currency).catch(error => {
      console.warn('Cache warm-up failed:', error);
    });
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<{
    cacheStats?: { hits: number; misses: number; size: number };
    fallbackSize: number;
    refreshQueueSize: number;
  }> {
    return {
      cacheStats: this.cache ? await this.cache.getStats() : undefined,
      fallbackSize: this.fallbackPrices.size,
      refreshQueueSize: this.refreshQueue.size
    };
  }

  /**
   * Set manual price (for testing or overrides)
   */
  public setManualPrice(symbol: string, amount: number, currency: string = 'USD'): void {
    const price = Price.manual(amount, currency);
    const cacheKey = this.getCacheKey(symbol, currency);
    
    // Set in fallback (never expires)
    this.fallbackPrices.set(cacheKey, price);
    
    // Also set in cache if available
    if (this.cache) {
      this.cache.set(cacheKey, price).catch(error => {
        console.warn('Failed to cache manual price:', error);
      });
    }
  }

  /**
   * Calculate total value for assets with prices
   */
  public calculateTotalValue(
    balances: Map<string, number>,
    prices: Map<string, Price>
  ): number {
    let total = 0;
    
    for (const [symbol, balance] of balances) {
      const price = prices.get(symbol);
      if (price) {
        total += balance * price.getAmount();
      }
    }
    
    return total;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(symbol: string, currency: string): string {
    return `price:${symbol.toUpperCase()}:${currency.toUpperCase()}`;
  }

  /**
   * Chunk array helper
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get price with retry logic
   */
  public async fetchPriceWithRetry(
    request: PriceFetchRequest,
    maxRetries: number = 3
  ): Promise<Result<PriceFetchResult, DomainError>> {
    let lastError: DomainError | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.fetchPrice(request);
      
      if (result.isSuccess) {
        return result;
      }
      
      lastError = result.error;
      
      // Exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    return Result.failure(
      lastError || new ServiceError('RETRY_EXHAUSTED', 'All retry attempts failed')
    );
  }
}