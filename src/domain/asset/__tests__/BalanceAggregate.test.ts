/**
 * Comprehensive tests for BalanceAggregate
 * 
 * Tests the balance aggregate domain model with progressive loading states
 * according to the specifications in ProgressiveLoadingTestSpec.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BalanceAggregate } from '../BalanceAggregate';
import { AssetValue } from '../AssetValue';
import { Price } from '../Price';
import { LoadingStatus } from '../AssetLoadingState';
import { ValidationError } from '../../shared/DomainError';

describe('BalanceAggregate', () => {
  let balance: AssetValue;
  let aggregate: BalanceAggregate;

  beforeEach(() => {
    balance = AssetValue.fromString('10', 'ETH');
    aggregate = BalanceAggregate.create(
      'test-id',
      'test-account',
      'ETH',
      'Ethereum',
      'ethereum',
      balance
    );
  });

  describe('Creation and basic properties', () => {
    it('should create a valid balance aggregate', () => {
      expect(aggregate.getId()).toBe('test-id');
      expect(aggregate.getAccountId()).toBe('test-account');
      expect(aggregate.getAssetSymbol()).toBe('ETH');
      expect(aggregate.getAssetName()).toBe('Ethereum');
      expect(aggregate.getChain()).toBe('ethereum');
      expect(aggregate.getBalance()).toBe(balance);
      expect(aggregate.getPrice()).toBeUndefined();
      expect(aggregate.getLoadingState().getBalanceStatus()).toBe(LoadingStatus.IDLE);
      expect(aggregate.getLoadingState().getPriceStatus()).toBe(LoadingStatus.IDLE);
    });

    it('should validate required fields during creation', () => {
      expect(() => 
        BalanceAggregate.create('', 'account', 'ETH', 'Ethereum', 'ethereum', balance)
      ).toThrow(ValidationError);

      expect(() => 
        BalanceAggregate.create('id', '', 'ETH', 'Ethereum', 'ethereum', balance)
      ).toThrow(ValidationError);

      expect(() => 
        BalanceAggregate.create('id', 'account', '', 'Ethereum', 'ethereum', balance)
      ).toThrow(ValidationError);

      expect(() => 
        BalanceAggregate.create('id', 'account', 'ETH', 'Ethereum', '', balance)
      ).toThrow(ValidationError);
    });

    it('should normalize asset symbol to uppercase', () => {
      const agg = BalanceAggregate.create(
        'test-id',
        'test-account',
        'eth',
        'Ethereum',
        'ethereum',
        balance
      );
      expect(agg.getAssetSymbol()).toBe('ETH');
    });
  });

  describe('should track separate loading states for balance and price', () => {
    it('Progressive loading of balance then price', () => {
      // Initial state
      expect(aggregate.getLoadingState().isBalanceLoading()).toBe(false);
      expect(aggregate.getLoadingState().isPriceLoading()).toBe(false);

      // Start balance loading
      aggregate.startBalanceLoading();
      expect(aggregate.getLoadingState().isBalanceLoading()).toBe(true);
      expect(aggregate.getLoadingState().isPriceLoading()).toBe(false);

      // Complete balance loading
      const newBalance = AssetValue.fromString('15', 'ETH');
      aggregate.updateBalance(newBalance);
      expect(aggregate.getLoadingState().getBalanceStatus()).toBe(LoadingStatus.SUCCESS);
      expect(aggregate.getLoadingState().isPriceLoading()).toBe(false);
      expect(aggregate.isFullyLoaded()).toBe(false);

      // Start price loading
      aggregate.startPriceLoading();
      expect(aggregate.getLoadingState().getBalanceStatus()).toBe(LoadingStatus.SUCCESS);
      expect(aggregate.getLoadingState().isPriceLoading()).toBe(true);

      // Complete price loading
      const price = Price.live(3000, 'USD');
      aggregate.updatePrice(price);
      expect(aggregate.isFullyLoaded()).toBe(true);
      expect(aggregate.getPrice()).toBe(price);
    });

    it('should handle loading errors correctly', () => {
      // Test balance error
      aggregate.startBalanceLoading();
      aggregate.markBalanceError('Network timeout');
      expect(aggregate.getLoadingState().getBalanceStatus()).toBe(LoadingStatus.ERROR);
      expect(aggregate.getLoadingState().getErrors().balance).toBe('Network timeout');

      // Test price error
      aggregate.startPriceLoading();
      aggregate.markPriceError('Price service unavailable');
      expect(aggregate.getLoadingState().getPriceStatus()).toBe(LoadingStatus.ERROR);
      expect(aggregate.getLoadingState().getErrors().price).toBe('Price service unavailable');
    });

    it('should track version changes', () => {
      const initialVersion = aggregate.getVersion();
      
      aggregate.startBalanceLoading();
      expect(aggregate.getVersion()).toBe(initialVersion + 1);

      aggregate.updateBalance(AssetValue.fromString('20', 'ETH'));
      expect(aggregate.getVersion()).toBe(initialVersion + 2);

      aggregate.updatePrice(Price.live(3000, 'USD'));
      expect(aggregate.getVersion()).toBe(initialVersion + 3);
    });
  });

  describe('should calculate value only when price available', () => {
    it('Balance loaded but price pending', () => {
      // Without price
      expect(aggregate.calculateValue()).toBe(null);
      expect(aggregate.getDisplayValue()).toBe('-');

      // With price
      const price = Price.live(100, 'USD');
      aggregate.updatePrice(price);
      expect(aggregate.calculateValue()).toBe(1000); // 10 ETH * $100
      expect(aggregate.getDisplayValue()).toBe('$1,000.00');
    });

    it('should handle zero balances correctly', () => {
      const zeroBalance = AssetValue.zero('ETH');
      const zeroAggregate = BalanceAggregate.create(
        'zero-id',
        'test-account',
        'ETH',
        'Ethereum',
        'ethereum',
        zeroBalance
      );

      expect(zeroAggregate.isZeroBalance()).toBe(true);
      
      zeroAggregate.updatePrice(Price.live(3000, 'USD'));
      expect(zeroAggregate.calculateValue()).toBe(0);
      expect(zeroAggregate.getDisplayValue()).toBe('$0.00');
    });

    it('should format values with different currencies', () => {
      aggregate.updatePrice(Price.live(2500, 'EUR'));
      expect(aggregate.getDisplayValue()).toBe('€25,000.00');
    });
  });

  describe('should merge aggregates correctly', () => {
    it('Multiple accounts with same asset', async () => {
      // Create second aggregate
      const balance2 = AssetValue.fromString('5', 'ETH');
      const aggregate2 = BalanceAggregate.create(
        'test-id-2',
        'test-account-2',
        'ETH',
        'Ethereum',
        'ethereum',
        balance2
      );

      // Add prices with different timestamps
      const olderPrice = Price.live(3000, 'USD');
      aggregate2.updatePrice(olderPrice);
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const newerPrice = Price.live(3100, 'USD');
      aggregate.updatePrice(newerPrice);

      // Merge aggregates
      const merged = aggregate.merge(aggregate2);

      // Assertions
      expect(merged.getBalance().getAmount()).toBe('15'); // 10 + 5
      expect(merged.getPrice()?.getAmount()).toBe(3100); // Newer price
      expect(merged.getId()).toContain('merged');
      expect(merged.getChain()).toBe('ethereum');
      expect(merged.getAssetSymbol()).toBe('ETH');
    });

    it('should reject merging different assets', () => {
      const btcBalance = AssetValue.fromString('0.5', 'BTC');
      const btcAggregate = BalanceAggregate.create(
        'btc-id',
        'test-account',
        'BTC',
        'Bitcoin',
        'bitcoin',
        btcBalance
      );

      expect(() => aggregate.merge(btcAggregate)).toThrow(ValidationError);
    });

    it('should reject merging different chains', () => {
      const balance2 = AssetValue.fromString('5', 'ETH');
      const polygonAggregate = BalanceAggregate.create(
        'poly-id',
        'test-account',
        'ETH',
        'Ethereum',
        'polygon',
        balance2
      );

      expect(() => aggregate.merge(polygonAggregate)).toThrow(ValidationError);
    });

    it('should handle merging with missing prices', () => {
      const balance2 = AssetValue.fromString('5', 'ETH');
      const aggregate2 = BalanceAggregate.create(
        'test-id-2',
        'test-account-2',
        'ETH',
        'Ethereum',
        'ethereum',
        balance2
      );

      // Only first aggregate has price
      aggregate.updatePrice(Price.live(3000, 'USD'));

      const merged = aggregate.merge(aggregate2);
      expect(merged.getPrice()?.getAmount()).toBe(3000);
    });
  });

  describe('Balance validation and updates', () => {
    it('should validate balance symbol matches on update', () => {
      const wrongBalance = AssetValue.fromString('5', 'BTC');
      expect(() => aggregate.updateBalance(wrongBalance)).toThrow(ValidationError);
    });

    it('should update balance with cache information', () => {
      const newBalance = AssetValue.fromString('20', 'ETH');
      aggregate.updateBalance(newBalance, true, 15000);

      expect(aggregate.getBalance().getAmount()).toBe('20');
      expect(aggregate.getLoadingState().isFromCache()).toBe(true);
      expect(aggregate.getLoadingState().getCacheAge()).toBe(15000);
    });

    it('should mark data as stale', () => {
      aggregate.markStale('balance');
      expect(aggregate.getLoadingState().getBalanceStatus()).toBe(LoadingStatus.STALE);

      aggregate.markStale('price');
      expect(aggregate.getLoadingState().getPriceStatus()).toBe(LoadingStatus.STALE);

      aggregate.markStale('both');
      expect(aggregate.getLoadingState().getBalanceStatus()).toBe(LoadingStatus.STALE);
      expect(aggregate.getLoadingState().getPriceStatus()).toBe(LoadingStatus.STALE);
    });
  });

  describe('Refresh logic', () => {
    it('should determine when refresh is needed', () => {
      // Fresh data - no refresh needed
      aggregate.startBalanceLoading();
      aggregate.updateBalance(AssetValue.fromString('10', 'ETH'));
      aggregate.startPriceLoading();
      aggregate.updatePrice(Price.live(3000, 'USD'));
      
      let refreshNeeds = aggregate.needsRefresh();
      expect(refreshNeeds.balance).toBe(false);
      expect(refreshNeeds.price).toBe(false);

      // Mark as stale
      aggregate.markStale('both');
      refreshNeeds = aggregate.needsRefresh();
      expect(refreshNeeds.balance).toBe(true);
      expect(refreshNeeds.price).toBe(true);
    });

    it('should identify expired prices', () => {
      // Create an expired price
      const expiredPrice = Price.cached(3000, 'USD', new Date(Date.now() - 120000)); // 2 minutes ago
      aggregate.updatePrice(expiredPrice);

      const refreshNeeds = aggregate.needsRefresh();
      expect(refreshNeeds.price).toBe(true);
    });
  });

  describe('Display and formatting', () => {
    it('should provide comprehensive display metadata', () => {
      aggregate.startBalanceLoading();
      aggregate.updateBalance(AssetValue.fromString('10', 'ETH'));
      aggregate.startPriceLoading();
      aggregate.updatePrice(Price.live(3000, 'USD'));
      
      const metadata = aggregate.getDisplayMetadata();
      expect(metadata.symbol).toBe('ETH');
      expect(metadata.name).toBe('Ethereum');
      expect(metadata.chain).toBe('ethereum');
      expect(metadata.balance).toBe('10');
      expect(metadata.price).toBe('$3,000.00');
      expect(metadata.value).toBe('$30,000.00');
      expect(metadata.loadingStatus.balance).toBe('success');
      expect(metadata.loadingStatus.price).toBe('success');
    });

    it('should handle missing price in display metadata', () => {
      const metadata = aggregate.getDisplayMetadata();
      expect(metadata.price).toBe(null);
      expect(metadata.value).toBe(null);
    });

    it('should show loading states in display metadata', () => {
      aggregate.startBalanceLoading();
      aggregate.startPriceLoading();

      const metadata = aggregate.getDisplayMetadata();
      expect(metadata.loadingStatus.balance).toBe('loading');
      expect(metadata.loadingStatus.price).toBe('loading');
    });
  });

  describe('Aggregate key generation', () => {
    it('should generate consistent aggregate keys', () => {
      const key = aggregate.getAggregateKey();
      expect(key).toBe('ETH-ethereum-test-account');

      // Different aggregate with same asset/chain/account should have same key
      const aggregate2 = BalanceAggregate.create(
        'different-id',
        'test-account',
        'ETH',
        'Ethereum',
        'ethereum',
        AssetValue.fromString('5', 'ETH')
      );
      expect(aggregate2.getAggregateKey()).toBe(key);
    });
  });

  describe('Data persistence', () => {
    it('should export and recreate from data', () => {
      aggregate.updatePrice(Price.live(3000, 'USD'));
      
      const data = aggregate.toData();
      const recreated = BalanceAggregate.fromData(data);

      expect(recreated.getId()).toBe(aggregate.getId());
      expect(recreated.getAssetSymbol()).toBe(aggregate.getAssetSymbol());
      expect(recreated.getBalance().getAmount()).toBe(aggregate.getBalance().getAmount());
      expect(recreated.getPrice()?.getAmount()).toBe(aggregate.getPrice()?.getAmount());
    });

    it('should clone with updates', () => {
      const clone = aggregate.clone({ 
        assetName: 'Updated Ethereum',
        accountId: 'new-account'
      });

      expect(clone.getAssetName()).toBe('Updated Ethereum');
      expect(clone.getAccountId()).toBe('new-account');
      expect(clone.getId()).toBe(aggregate.getId()); // Unchanged
      expect(clone.getAssetSymbol()).toBe(aggregate.getAssetSymbol()); // Unchanged
    });
  });

  describe('Loading state checks', () => {
    it('should correctly identify loading states', () => {
      expect(aggregate.isLoading()).toBe(false);
      expect(aggregate.isFullyLoaded()).toBe(false);

      aggregate.startBalanceLoading();
      expect(aggregate.isLoading()).toBe(true);

      aggregate.updateBalance(AssetValue.fromString('10', 'ETH'));
      expect(aggregate.isLoading()).toBe(false);
      expect(aggregate.isFullyLoaded()).toBe(false);

      aggregate.startPriceLoading();
      expect(aggregate.isLoading()).toBe(true);

      aggregate.updatePrice(Price.live(3000, 'USD'));
      expect(aggregate.isLoading()).toBe(false);
      expect(aggregate.isFullyLoaded()).toBe(true);
    });
  });

  describe('Metadata handling', () => {
    it('should store and retrieve metadata correctly', () => {
      const metadata = {
        contractAddress: '0x123',
        decimals: 18,
        isNative: true,
        logo: 'https://example.com/eth.png'
      };

      const agg = BalanceAggregate.create(
        'test-id',
        'test-account',
        'ETH',
        'Ethereum',
        'ethereum',
        balance,
        metadata
      );

      expect(agg.getMetadata()).toEqual(metadata);
    });
  });
});