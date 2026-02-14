/**
 * Price Value Object
 * 
 * Represents a price with currency, timestamp, and cache metadata.
 * Ensures proper handling of price data with source tracking.
 */

import { ValueObject } from '../shared/ValueObject';
import { ValidationError } from '../shared/DomainError';

export const PriceSource = {
  LIVE: 'live',
  CACHED: 'cached',
  FALLBACK: 'fallback',
  MANUAL: 'manual',
} as const;

export type PriceSource = (typeof PriceSource)[keyof typeof PriceSource];

export interface PriceData {
  amount: number;
  currency: string;
  timestamp: Date;
  source: PriceSource;
  provider?: string; // e.g., 'coingecko', 'binance', 'chainlink'
  confidence?: number; // 0-100, representing confidence in price accuracy
  ttl?: number; // Time to live in milliseconds
}

export class Price extends ValueObject<PriceData> {
  // Standard TTL values (in milliseconds)
  private static readonly STANDARD_TTL = 10000; // 10 seconds for live prices
  private static readonly CACHED_TTL = 60000; // 1 minute for cached prices
  private static readonly FALLBACK_TTL = 300000; // 5 minutes for fallback prices

  private constructor(data: PriceData) {
    super(data);
    this.validate();
  }

  protected validate(): void {
    const { amount, currency, source, confidence } = this._value;

    if (!Number.isFinite(amount) || amount < 0) {
      throw new ValidationError(
        'Price amount must be a non-negative finite number',
        'amount',
        amount
      );
    }

    if (!currency || currency.trim().length === 0) {
      throw new ValidationError(
        'Currency cannot be empty',
        'currency',
        currency
      );
    }

    if (!Object.values(PriceSource).includes(source)) {
      throw new ValidationError(
        'Invalid price source',
        'source',
        source
      );
    }

    if (confidence !== undefined) {
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
        throw new ValidationError(
          'Confidence must be between 0 and 100',
          'confidence',
          confidence
        );
      }
    }
  }

  /**
   * Create a live price
   */
  public static live(
    amount: number,
    currency: string = 'USD',
    provider?: string,
    confidence: number = 100
  ): Price {
    return new Price({
      amount,
      currency: currency.toUpperCase(),
      timestamp: new Date(),
      source: PriceSource.LIVE,
      provider,
      confidence,
      ttl: Price.STANDARD_TTL
    });
  }

  /**
   * Create a cached price
   */
  public static cached(
    amount: number,
    currency: string = 'USD',
    timestamp: Date,
    provider?: string,
    confidence?: number
  ): Price {
    return new Price({
      amount,
      currency: currency.toUpperCase(),
      timestamp,
      source: PriceSource.CACHED,
      provider,
      confidence: confidence ?? 80,
      ttl: Price.CACHED_TTL
    });
  }

  /**
   * Create a fallback price
   */
  public static fallback(
    amount: number,
    currency: string = 'USD',
    timestamp: Date,
    provider?: string
  ): Price {
    return new Price({
      amount,
      currency: currency.toUpperCase(),
      timestamp,
      source: PriceSource.FALLBACK,
      provider,
      confidence: 50,
      ttl: Price.FALLBACK_TTL
    });
  }

  /**
   * Create a manual price
   */
  public static manual(
    amount: number,
    currency: string = 'USD'
  ): Price {
    return new Price({
      amount,
      currency: currency.toUpperCase(),
      timestamp: new Date(),
      source: PriceSource.MANUAL,
      confidence: 100,
      ttl: undefined // Manual prices don't expire
    });
  }

  /**
   * Create a zero price
   */
  public static zero(currency: string = 'USD'): Price {
    return new Price({
      amount: 0,
      currency: currency.toUpperCase(),
      timestamp: new Date(),
      source: PriceSource.MANUAL,
      confidence: 100
    });
  }

  // Getters
  public getAmount(): number {
    return this._value.amount;
  }

  public getCurrency(): string {
    return this._value.currency;
  }

  public getTimestamp(): Date {
    return this._value.timestamp;
  }

  public getSource(): PriceSource {
    return this._value.source;
  }

  public getProvider(): string | undefined {
    return this._value.provider;
  }

  public getConfidence(): number {
    return this._value.confidence ?? 100;
  }

  /**
   * Get age of price in milliseconds
   */
  public getAge(): number {
    return Date.now() - this._value.timestamp.getTime();
  }

  /**
   * Check if price is expired based on TTL
   */
  public isExpired(): boolean {
    if (this._value.ttl === undefined) return false;
    return this.getAge() > this._value.ttl;
  }

  /**
   * Check if price is stale (older than 1 minute)
   */
  public isStale(): boolean {
    return this.getAge() > 60000;
  }

  /**
   * Check if price is fresh (less than 10 seconds old)
   */
  public isFresh(): boolean {
    return this.getAge() < 10000;
  }

  /**
   * Check if this is a live price
   */
  public isLive(): boolean {
    return this._value.source === PriceSource.LIVE;
  }

  /**
   * Check if this is a cached price
   */
  public isCached(): boolean {
    return this._value.source === PriceSource.CACHED;
  }

  /**
   * Convert to different currency (requires exchange rate)
   */
  public convertTo(targetCurrency: string, exchangeRate: number): Price {
    if (exchangeRate <= 0) {
      throw new ValidationError(
        'Exchange rate must be positive',
        'exchangeRate',
        exchangeRate
      );
    }

    return new Price({
      ...this._value,
      amount: this._value.amount * exchangeRate,
      currency: targetCurrency.toUpperCase(),
      confidence: Math.max(0, (this._value.confidence ?? 100) - 10) // Reduce confidence for conversion
    });
  }

  /**
   * Apply percentage change
   */
  public applyChange(percentageChange: number): Price {
    const multiplier = 1 + (percentageChange / 100);
    return new Price({
      ...this._value,
      amount: this._value.amount * multiplier,
      timestamp: new Date()
    });
  }

  /**
   * Multiply by a scalar
   */
  public multiply(scalar: number): Price {
    if (!Number.isFinite(scalar)) {
      throw new ValidationError(
        'Scalar must be finite',
        'scalar',
        scalar
      );
    }

    return new Price({
      ...this._value,
      amount: this._value.amount * scalar
    });
  }

  /**
   * Compare with another price
   */
  public compare(other: Price): -1 | 0 | 1 {
    if (this._value.currency !== other._value.currency) {
      throw new ValidationError(
        'Cannot compare prices with different currencies',
        'currency',
        { this: this._value.currency, other: other._value.currency }
      );
    }

    if (this._value.amount < other._value.amount) return -1;
    if (this._value.amount > other._value.amount) return 1;
    return 0;
  }

  /**
   * Get percentage difference from another price
   */
  public percentageDifference(other: Price): number {
    if (this._value.currency !== other._value.currency) {
      throw new ValidationError(
        'Cannot calculate difference between different currencies',
        'currency',
        { this: this._value.currency, other: other._value.currency }
      );
    }

    if (other._value.amount === 0) return 0;
    return ((this._value.amount - other._value.amount) / other._value.amount) * 100;
  }

  /**
   * Format for display
   */
  public format(decimals: number = 2, includeSymbol: boolean = true): string {
    const formatted = this._value.amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    if (!includeSymbol) return formatted;

    // Common currency symbols
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'BTC': '₿',
      'ETH': 'Ξ'
    };

    const symbol = symbols[this._value.currency];
    if (symbol) {
      return `${symbol}${formatted}`;
    }

    return `${formatted} ${this._value.currency}`;
  }

  /**
   * Get quality indicator for UI display
   */
  public getQualityIndicator(): 'high' | 'medium' | 'low' {
    const confidence = this.getConfidence();
    const age = this.getAge();

    if (this._value.source === PriceSource.MANUAL) return 'high';
    
    if (this._value.source === PriceSource.LIVE && age < 10000) {
      return confidence >= 90 ? 'high' : 'medium';
    }

    if (this._value.source === PriceSource.CACHED && age < 60000) {
      return confidence >= 70 ? 'medium' : 'low';
    }

    return 'low';
  }

  /**
   * Create a refreshed version with updated timestamp
   */
  public refresh(): Price {
    return new Price({
      ...this._value,
      timestamp: new Date(),
      source: PriceSource.CACHED,
      confidence: Math.max(50, (this._value.confidence ?? 100) - 20)
    });
  }

  /**
   * Get cache key for this price
   */
  public getCacheKey(assetSymbol: string): string {
    return `price:${assetSymbol}:${this._value.currency}`;
  }

  /**
   * Get display metadata
   */
  public getDisplayMetadata(): {
    ageText: string;
    sourceText: string;
    qualityColor: string;
  } {
    const age = this.getAge();
    let ageText: string;
    
    if (age < 1000) {
      ageText = 'just now';
    } else if (age < 60000) {
      ageText = `${Math.floor(age / 1000)}s ago`;
    } else if (age < 3600000) {
      ageText = `${Math.floor(age / 60000)}m ago`;
    } else {
      ageText = `${Math.floor(age / 3600000)}h ago`;
    }

    const sourceText = {
      [PriceSource.LIVE]: 'Live',
      [PriceSource.CACHED]: 'Cached',
      [PriceSource.FALLBACK]: 'Fallback',
      [PriceSource.MANUAL]: 'Manual'
    }[this._value.source];

    const quality = this.getQualityIndicator();
    const qualityColor = {
      'high': 'green',
      'medium': 'yellow',
      'low': 'red'
    }[quality];

    return { ageText, sourceText, qualityColor };
  }
}