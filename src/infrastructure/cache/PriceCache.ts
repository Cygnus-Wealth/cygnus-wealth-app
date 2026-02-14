/**
 * PriceCache Implementation
 * 
 * Multi-layer cache implementation for price data using IndexedDB for persistence
 * and in-memory cache for fast access.
 */

import { Price } from '../../domain/asset/Price';
import type { IPriceCache } from '../../domain/services/PriceService';

interface CacheEntry {
  price: Price;
  timestamp: number;
  ttl: number;
}

export class PriceCache implements IPriceCache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private dbName = 'CygnusWealthCache';
  private storeName = 'prices';
  private db: IDBDatabase | null = null;
  private stats = { hits: 0, misses: 0 };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDB();
    this.startCleanupTask();
  }

  /**
   * Initialize IndexedDB
   */
  private async initializeDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available, using memory cache only');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.loadFromDB(); // Load persisted data into memory
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Load persisted cache into memory
   */
  private async loadFromDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result;
        const now = Date.now();

        for (const entry of entries) {
          // Skip expired entries
          if (entry.timestamp + entry.ttl > now) {
            this.memoryCache.set(entry.key, {
              price: this.deserializePrice(entry.price),
              timestamp: entry.timestamp,
              ttl: entry.ttl
            });
          }
        }
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to load from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get price from cache
   */
  public async get(key: string): Promise<Price | null> {
    // Check memory cache first
    const entry = this.memoryCache.get(key);
    
    if (entry) {
      const now = Date.now();
      if (now - entry.timestamp <= entry.ttl) {
        this.stats.hits++;
        return entry.price;
      }
      
      // Remove expired entry
      this.memoryCache.delete(key);
      this.removeFromDB(key);
    }

    this.stats.misses++;

    // Try to load from DB if not in memory
    if (this.db) {
      const dbEntry = await this.getFromDB(key);
      if (dbEntry) {
        const now = Date.now();
        if (now - dbEntry.timestamp <= dbEntry.ttl) {
          // Add to memory cache
          this.memoryCache.set(key, dbEntry);
          this.stats.hits++;
          return dbEntry.price;
        }
        
        // Remove expired entry from DB
        await this.removeFromDB(key);
      }
    }

    return null;
  }

  /**
   * Set price in cache
   */
  public async set(key: string, price: Price, ttl: number = 10000): Promise<void> {
    const entry: CacheEntry = {
      price,
      timestamp: Date.now(),
      ttl
    };

    // Set in memory cache
    this.memoryCache.set(key, entry);

    // Persist to IndexedDB
    if (this.db) {
      await this.setInDB(key, entry);
    }
  }

  /**
   * Get batch of prices
   */
  public async getBatch(keys: string[]): Promise<Map<string, Price>> {
    const results = new Map<string, Price>();
    
    for (const key of keys) {
      const price = await this.get(key);
      if (price) {
        results.set(key, price);
      }
    }
    
    return results;
  }

  /**
   * Set batch of prices
   */
  public async setBatch(prices: Map<string, Price>, ttl: number = 10000): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [key, price] of prices) {
      promises.push(this.set(key, price, ttl));
    }
    
    await Promise.all(promises);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  public async invalidate(pattern: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
      if (this.db) {
        await this.removeFromDB(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{ hits: number; misses: number; size: number }> {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.memoryCache.size
    };
  }

  /**
   * Get from IndexedDB
   */
  private async getFromDB(key: string): Promise<CacheEntry | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            price: this.deserializePrice(result.price),
            timestamp: result.timestamp,
            ttl: result.ttl
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('Failed to get from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Set in IndexedDB
   */
  private async setInDB(key: string, entry: CacheEntry): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.put({
        key,
        price: this.serializePrice(entry.price),
        timestamp: entry.timestamp,
        ttl: entry.ttl
      });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to set in IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Remove from IndexedDB
   */
  private async removeFromDB(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to remove from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Serialize price for storage
   */
  private serializePrice(price: Price): unknown {
    return price.toJSON();
  }

  /**
   * Deserialize price from storage
   */
  private deserializePrice(data: Record<string, unknown>): Price {
    // Reconstruct Price object from stored data
    const amount = data.amount as number;
    const currency = data.currency as string;
    const provider = data.provider as string | undefined;
    const confidence = data.confidence as number | undefined;
    const timestamp = new Date(data.timestamp as string | number);

    // Use appropriate factory method based on source
    switch (data.source) {
      case 'live':
        return Price.live(amount, currency, provider, confidence);
      case 'cached':
        return Price.cached(amount, currency, timestamp, provider, confidence);
      case 'fallback':
        return Price.fallback(amount, currency, timestamp, provider);
      case 'manual':
        return Price.manual(amount, currency);
      default:
        return Price.cached(amount, currency, timestamp);
    }
  }

  /**
   * Start cleanup task to remove expired entries
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Run every minute
  }

  /**
   * Clean up expired entries
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
      if (this.db) {
        await this.removeFromDB(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  public async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Failed to clear IndexedDB:', request.error);
          reject(request.error);
        };
      });
    }
  }

  /**
   * Destroy cache (cleanup resources)
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.memoryCache.clear();
  }
}