/**
 * BalanceAggregate
 * 
 * Aggregate root for managing asset balances with their associated prices
 * and loading states. Coordinates the progressive loading of balance and price data.
 */

import { AssetValue } from './AssetValue';
import { Price } from './Price';
import { AssetLoadingState } from './AssetLoadingState';
import { ValidationError } from '../shared/DomainError';

export interface BalanceAggregateData {
  id: string;
  accountId: string;
  assetSymbol: string;
  assetName: string;
  chain: string;
  balance: AssetValue;
  price?: Price;
  loadingState: AssetLoadingState;
  lastUpdated: Date;
  metadata?: {
    contractAddress?: string;
    decimals?: number;
    isNative?: boolean;
    logo?: string;
  };
}

export class BalanceAggregate {
  private _data: BalanceAggregateData;
  private _version: number = 0;

  private constructor(data: BalanceAggregateData) {
    this._data = data;
    this.validate();
  }

  private validate(): void {
    if (!this._data.id || this._data.id.trim().length === 0) {
      throw new ValidationError('Balance ID cannot be empty', 'id', this._data.id);
    }

    if (!this._data.accountId || this._data.accountId.trim().length === 0) {
      throw new ValidationError('Account ID cannot be empty', 'accountId', this._data.accountId);
    }

    if (!this._data.assetSymbol || this._data.assetSymbol.trim().length === 0) {
      throw new ValidationError('Asset symbol cannot be empty', 'assetSymbol', this._data.assetSymbol);
    }

    if (!this._data.chain || this._data.chain.trim().length === 0) {
      throw new ValidationError('Chain cannot be empty', 'chain', this._data.chain);
    }
  }

  /**
   * Create a new balance aggregate
   */
  public static create(
    id: string,
    accountId: string,
    assetSymbol: string,
    assetName: string,
    chain: string,
    balance: AssetValue,
    metadata?: BalanceAggregateData['metadata']
  ): BalanceAggregate {
    return new BalanceAggregate({
      id,
      accountId,
      assetSymbol: assetSymbol.toUpperCase(),
      assetName,
      chain,
      balance,
      loadingState: AssetLoadingState.initial(),
      lastUpdated: new Date(),
      metadata
    });
  }

  /**
   * Create from existing data (for rehydration)
   */
  public static fromData(data: BalanceAggregateData): BalanceAggregate {
    return new BalanceAggregate(data);
  }

  // Getters
  public getId(): string {
    return this._data.id;
  }

  public getAccountId(): string {
    return this._data.accountId;
  }

  public getAssetSymbol(): string {
    return this._data.assetSymbol;
  }

  public getAssetName(): string {
    return this._data.assetName;
  }

  public getChain(): string {
    return this._data.chain;
  }

  public getBalance(): AssetValue {
    return this._data.balance;
  }

  public getPrice(): Price | undefined {
    return this._data.price;
  }

  public getLoadingState(): AssetLoadingState {
    return this._data.loadingState;
  }

  public getLastUpdated(): Date {
    return this._data.lastUpdated;
  }

  public getMetadata(): BalanceAggregateData['metadata'] {
    return this._data.metadata;
  }

  public getVersion(): number {
    return this._version;
  }

  /**
   * Update balance (starts loading, then success/error)
   */
  public startBalanceLoading(): void {
    this._data.loadingState = AssetLoadingState.loadingBalance(this._data.loadingState);
    this._version++;
  }

  /**
   * Update balance with new value
   */
  public updateBalance(newBalance: AssetValue, fromCache: boolean = false, cacheAge?: number): void {
    // Ensure the balance is for the same asset
    if (newBalance.getSymbol() !== this._data.assetSymbol) {
      throw new ValidationError(
        'Balance symbol mismatch',
        'symbol',
        { expected: this._data.assetSymbol, received: newBalance.getSymbol() }
      );
    }

    this._data.balance = newBalance;
    this._data.loadingState = AssetLoadingState.balanceSuccess(this._data.loadingState, fromCache, cacheAge);
    this._data.lastUpdated = new Date();
    this._version++;
  }

  /**
   * Mark balance loading as failed
   */
  public markBalanceError(error: string): void {
    this._data.loadingState = AssetLoadingState.balanceError(error, this._data.loadingState);
    this._version++;
  }

  /**
   * Start price loading
   */
  public startPriceLoading(): void {
    this._data.loadingState = AssetLoadingState.loadingPrice(this._data.loadingState);
    this._version++;
  }

  /**
   * Update price
   */
  public updatePrice(newPrice: Price): void {
    this._data.price = newPrice;
    this._data.loadingState = AssetLoadingState.priceSuccess(
      this._data.loadingState,
      newPrice.isCached(),
      newPrice.getAge()
    );
    this._version++;
  }

  /**
   * Mark price loading as failed
   */
  public markPriceError(error: string): void {
    this._data.loadingState = AssetLoadingState.priceError(error, this._data.loadingState);
    this._version++;
  }

  /**
   * Mark data as stale
   */
  public markStale(staleType: 'balance' | 'price' | 'both'): void {
    this._data.loadingState = AssetLoadingState.markStale(this._data.loadingState, staleType);
    this._version++;
  }

  /**
   * Check if refresh is needed
   */
  public needsRefresh(): { balance: boolean; price: boolean } {
    const staleCheck = this._data.loadingState.shouldMarkStale();
    const balanceNeedsRefresh = 
      staleCheck.balance || 
      !this._data.loadingState.isBalanceFresh() ||
      this._data.loadingState.getBalanceStatus() === 'error' ||
      this._data.loadingState.getBalanceStatus() === 'stale';
    
    const priceNeedsRefresh = 
      staleCheck.price || 
      !this._data.loadingState.isPriceFresh() ||
      this._data.loadingState.getPriceStatus() === 'error' ||
      this._data.loadingState.getPriceStatus() === 'stale' ||
      !this._data.price ||
      this._data.price.isExpired();

    return {
      balance: balanceNeedsRefresh,
      price: priceNeedsRefresh
    };
  }

  /**
   * Calculate USD value
   */
  public calculateValue(): number | null {
    if (!this._data.price) return null;
    
    const balanceAmount = this._data.balance.getAmountAsNumber();
    const priceAmount = this._data.price.getAmount();
    
    return balanceAmount * priceAmount;
  }

  /**
   * Get display value with proper formatting
   */
  public getDisplayValue(): string {
    const value = this.calculateValue();
    if (value === null) return '-';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this._data.price?.getCurrency() || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Check if this is a zero balance
   */
  public isZeroBalance(): boolean {
    return this._data.balance.isZero();
  }

  /**
   * Check if data is fully loaded
   */
  public isFullyLoaded(): boolean {
    return this._data.loadingState.isFullyLoaded();
  }

  /**
   * Check if any data is loading
   */
  public isLoading(): boolean {
    return this._data.loadingState.isBalanceLoading() || 
           this._data.loadingState.isPriceLoading();
  }

  /**
   * Get aggregate key for grouping
   */
  public getAggregateKey(): string {
    return `${this._data.assetSymbol}-${this._data.chain}-${this._data.accountId}`;
  }

  /**
   * Clone with new data
   */
  public clone(updates?: Partial<BalanceAggregateData>): BalanceAggregate {
    return new BalanceAggregate({
      ...this._data,
      ...updates
    });
  }

  /**
   * Export to plain data (for persistence)
   */
  public toData(): BalanceAggregateData {
    return { ...this._data };
  }

  /**
   * Get display metadata for UI
   */
  public getDisplayMetadata(): {
    symbol: string;
    name: string;
    chain: string;
    balance: string;
    price: string | null;
    value: string | null;
    loadingStatus: {
      balance: string;
      price: string;
    };
    cacheStatus: 'fresh' | 'cached' | 'stale' | 'none';
  } {
    return {
      symbol: this._data.assetSymbol,
      name: this._data.assetName,
      chain: this._data.chain,
      balance: this._data.balance.format(),
      price: this._data.price?.format() || null,
      value: this.getDisplayValue() !== '-' ? this.getDisplayValue() : null,
      loadingStatus: {
        balance: this._data.loadingState.getBalanceStatus(),
        price: this._data.loadingState.getPriceStatus()
      },
      cacheStatus: this._data.loadingState.getCacheStatus()
    };
  }

  /**
   * Merge with another balance aggregate (for multi-account aggregation)
   */
  public merge(other: BalanceAggregate): BalanceAggregate {
    if (this._data.assetSymbol !== other._data.assetSymbol) {
      throw new ValidationError(
        'Cannot merge balances of different assets',
        'assetSymbol',
        { this: this._data.assetSymbol, other: other._data.assetSymbol }
      );
    }

    if (this._data.chain !== other._data.chain) {
      throw new ValidationError(
        'Cannot merge balances from different chains',
        'chain',
        { this: this._data.chain, other: other._data.chain }
      );
    }

    const mergedBalance = this._data.balance.add(other._data.balance);
    
    // Use the most recent price
    const mergedPrice = !this._data.price ? other._data.price :
                       !other._data.price ? this._data.price :
                       this._data.price.getTimestamp() > other._data.price.getTimestamp() ?
                       this._data.price : other._data.price;

    return new BalanceAggregate({
      id: `merged-${this._data.id}-${other._data.id}`,
      accountId: `merged-${this._data.accountId}-${other._data.accountId}`,
      assetSymbol: this._data.assetSymbol,
      assetName: this._data.assetName,
      chain: this._data.chain,
      balance: mergedBalance,
      price: mergedPrice,
      loadingState: AssetLoadingState.initial(), // Reset loading state for merged
      lastUpdated: new Date(),
      metadata: this._data.metadata
    });
  }
}