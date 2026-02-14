/**
 * AssetLoadingState Value Object
 * 
 * Represents the loading state of an asset, including separate states for
 * balance and price loading to enable progressive loading patterns.
 */

import { ValueObject } from '../shared/ValueObject';
import { ValidationError } from '../shared/DomainError';

export const LoadingStatus = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  STALE: 'stale',
} as const;

export type LoadingStatus = (typeof LoadingStatus)[keyof typeof LoadingStatus];

export interface AssetLoadingStateData {
  balanceStatus: LoadingStatus;
  priceStatus: LoadingStatus;
  lastBalanceUpdate: Date | null;
  lastPriceUpdate: Date | null;
  balanceError?: string;
  priceError?: string;
  isFromCache: boolean;
  cacheAge?: number; // in milliseconds
}

export class AssetLoadingState extends ValueObject<AssetLoadingStateData> {
  // Cache freshness thresholds (in milliseconds)
  private static readonly BALANCE_FRESH_DURATION = 30000; // 30 seconds
  private static readonly PRICE_FRESH_DURATION = 10000; // 10 seconds
  private static readonly STALE_THRESHOLD = 60000; // 1 minute

  private constructor(data: AssetLoadingStateData) {
    super(data);
    this.validate();
  }

  protected validate(): void {
    const { balanceStatus, priceStatus } = this._value;

    if (!Object.values(LoadingStatus).includes(balanceStatus)) {
      throw new ValidationError(
        'Invalid balance loading status',
        'balanceStatus',
        balanceStatus
      );
    }

    if (!Object.values(LoadingStatus).includes(priceStatus)) {
      throw new ValidationError(
        'Invalid price loading status',
        'priceStatus',
        priceStatus
      );
    }

    // Error states must have error messages
    if (balanceStatus === LoadingStatus.ERROR && !this._value.balanceError) {
      throw new ValidationError(
        'Balance error status requires error message',
        'balanceError',
        undefined
      );
    }

    if (priceStatus === LoadingStatus.ERROR && !this._value.priceError) {
      throw new ValidationError(
        'Price error status requires error message',
        'priceError',
        undefined
      );
    }
  }

  /**
   * Create initial loading state
   */
  public static initial(): AssetLoadingState {
    return new AssetLoadingState({
      balanceStatus: LoadingStatus.IDLE,
      priceStatus: LoadingStatus.IDLE,
      lastBalanceUpdate: null,
      lastPriceUpdate: null,
      isFromCache: false
    });
  }

  /**
   * Create loading state for balance fetch
   */
  public static loadingBalance(currentState?: AssetLoadingState): AssetLoadingState {
    const current = currentState?._value || AssetLoadingState.initial()._value;
    return new AssetLoadingState({
      ...current,
      balanceStatus: LoadingStatus.LOADING,
      balanceError: undefined
    });
  }

  /**
   * Create loading state for price fetch
   */
  public static loadingPrice(currentState?: AssetLoadingState): AssetLoadingState {
    const current = currentState?._value || AssetLoadingState.initial()._value;
    return new AssetLoadingState({
      ...current,
      priceStatus: LoadingStatus.LOADING,
      priceError: undefined
    });
  }

  /**
   * Create success state for balance
   */
  public static balanceSuccess(
    currentState?: AssetLoadingState,
    fromCache: boolean = false,
    cacheAge?: number
  ): AssetLoadingState {
    const current = currentState?._value || AssetLoadingState.initial()._value;
    return new AssetLoadingState({
      ...current,
      balanceStatus: LoadingStatus.SUCCESS,
      lastBalanceUpdate: new Date(),
      balanceError: undefined,
      isFromCache: fromCache,
      cacheAge
    });
  }

  /**
   * Create success state for price
   */
  public static priceSuccess(
    currentState?: AssetLoadingState,
    fromCache: boolean = false,
    cacheAge?: number
  ): AssetLoadingState {
    const current = currentState?._value || AssetLoadingState.initial()._value;
    return new AssetLoadingState({
      ...current,
      priceStatus: LoadingStatus.SUCCESS,
      lastPriceUpdate: new Date(),
      priceError: undefined,
      isFromCache: current.isFromCache && fromCache,
      cacheAge: fromCache ? cacheAge : current.cacheAge
    });
  }

  /**
   * Create error state for balance
   */
  public static balanceError(error: string, currentState?: AssetLoadingState): AssetLoadingState {
    const current = currentState?._value || AssetLoadingState.initial()._value;
    return new AssetLoadingState({
      ...current,
      balanceStatus: LoadingStatus.ERROR,
      balanceError: error
    });
  }

  /**
   * Create error state for price
   */
  public static priceError(error: string, currentState?: AssetLoadingState): AssetLoadingState {
    const current = currentState?._value || AssetLoadingState.initial()._value;
    return new AssetLoadingState({
      ...current,
      priceStatus: LoadingStatus.ERROR,
      priceError: error
    });
  }

  /**
   * Mark data as stale (needs refresh but old data still available)
   */
  public static markStale(currentState: AssetLoadingState, staleType: 'balance' | 'price' | 'both'): AssetLoadingState {
    const current = currentState._value;
    return new AssetLoadingState({
      ...current,
      balanceStatus: (staleType === 'balance' || staleType === 'both') 
        ? LoadingStatus.STALE 
        : current.balanceStatus,
      priceStatus: (staleType === 'price' || staleType === 'both') 
        ? LoadingStatus.STALE 
        : current.priceStatus
    });
  }

  // Getters
  public getBalanceStatus(): LoadingStatus {
    return this._value.balanceStatus;
  }

  public getPriceStatus(): LoadingStatus {
    return this._value.priceStatus;
  }

  public isBalanceLoading(): boolean {
    return this._value.balanceStatus === LoadingStatus.LOADING;
  }

  public isPriceLoading(): boolean {
    return this._value.priceStatus === LoadingStatus.LOADING;
  }

  public isFullyLoaded(): boolean {
    return this._value.balanceStatus === LoadingStatus.SUCCESS && 
           this._value.priceStatus === LoadingStatus.SUCCESS;
  }

  public hasErrors(): boolean {
    return this._value.balanceStatus === LoadingStatus.ERROR || 
           this._value.priceStatus === LoadingStatus.ERROR;
  }

  public isFromCache(): boolean {
    return this._value.isFromCache;
  }

  public getCacheAge(): number | undefined {
    return this._value.cacheAge;
  }

  /**
   * Check if balance data is fresh
   */
  public isBalanceFresh(): boolean {
    if (!this._value.lastBalanceUpdate) return false;
    const age = Date.now() - this._value.lastBalanceUpdate.getTime();
    return age < AssetLoadingState.BALANCE_FRESH_DURATION;
  }

  /**
   * Check if price data is fresh
   */
  public isPriceFresh(): boolean {
    if (!this._value.lastPriceUpdate) return false;
    const age = Date.now() - this._value.lastPriceUpdate.getTime();
    return age < AssetLoadingState.PRICE_FRESH_DURATION;
  }

  /**
   * Check if data should be marked as stale
   */
  public shouldMarkStale(): { balance: boolean; price: boolean } {
    const now = Date.now();
    const balanceAge = this._value.lastBalanceUpdate 
      ? now - this._value.lastBalanceUpdate.getTime() 
      : Infinity;
    const priceAge = this._value.lastPriceUpdate 
      ? now - this._value.lastPriceUpdate.getTime() 
      : Infinity;

    return {
      balance: balanceAge > AssetLoadingState.STALE_THRESHOLD,
      price: priceAge > AssetLoadingState.STALE_THRESHOLD
    };
  }

  /**
   * Get display-friendly cache status
   */
  public getCacheStatus(): 'fresh' | 'cached' | 'stale' | 'none' {
    if (!this._value.isFromCache) return 'none';
    
    if (this._value.cacheAge === undefined) return 'cached';
    
    if (this._value.cacheAge < 10000) return 'fresh'; // < 10 seconds
    if (this._value.cacheAge < 60000) return 'cached'; // < 1 minute
    return 'stale';
  }

  /**
   * Get error messages if any
   */
  public getErrors(): { balance?: string; price?: string } {
    return {
      balance: this._value.balanceError,
      price: this._value.priceError
    };
  }

  /**
   * Get human-readable description of state
   */
  public describe(): string {
    const parts: string[] = [];
    
    if (this._value.balanceStatus === LoadingStatus.LOADING) {
      parts.push('Loading balance...');
    } else if (this._value.balanceStatus === LoadingStatus.ERROR) {
      parts.push(`Balance error: ${this._value.balanceError}`);
    } else if (this._value.balanceStatus === LoadingStatus.STALE) {
      parts.push('Balance data is stale');
    }

    if (this._value.priceStatus === LoadingStatus.LOADING) {
      parts.push('Loading price...');
    } else if (this._value.priceStatus === LoadingStatus.ERROR) {
      parts.push(`Price error: ${this._value.priceError}`);
    } else if (this._value.priceStatus === LoadingStatus.STALE) {
      parts.push('Price data is stale');
    }

    if (this.isFullyLoaded()) {
      const cacheStatus = this.getCacheStatus();
      if (cacheStatus !== 'none') {
        parts.push(`Data from ${cacheStatus} cache`);
      } else {
        parts.push('Fresh data loaded');
      }
    }

    return parts.length > 0 ? parts.join(', ') : 'Idle';
  }
}