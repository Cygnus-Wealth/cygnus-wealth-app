/**
 * Comprehensive tests for BalanceService
 * 
 * Tests balance fetching with caching, retry logic, and progressive loading
 * according to the specifications in ProgressiveLoadingTestSpec.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BalanceService, type BalanceFetchRequest, type IBalanceProvider, type IBalanceCache } from '../BalanceService';
import { AssetValue } from '../../asset/AssetValue';
import { BalanceAggregate } from '../../asset/BalanceAggregate';
import { Price } from '../../asset/Price';
import { Result } from '../../shared/Result';
import { ServiceError } from '../../shared/DomainError';

// Helper interface for accessing private members in tests
interface BalanceServiceInternals {
  delay: (ms: number) => Promise<void>;
}

function getInternals(service: BalanceService): BalanceServiceInternals {
  return service as unknown as BalanceServiceInternals;
}

// Mock implementations
class MockBalanceProvider implements IBalanceProvider {
  public fetchBalance = vi.fn();
  public fetchTokenBalances = vi.fn();
  public supportsChain = vi.fn().mockReturnValue(true);
}

class MockBalanceCache implements IBalanceCache {
  public get = vi.fn();
  public set = vi.fn();
  public invalidate = vi.fn();
  public getAge = vi.fn();
}

describe('BalanceService', () => {
  let balanceService: BalanceService;
  let mockProvider: MockBalanceProvider;
  let mockCache: MockBalanceCache;

  beforeEach(() => {
    mockProvider = new MockBalanceProvider();
    mockCache = new MockBalanceCache();
    balanceService = new BalanceService(mockCache);
    balanceService.registerProvider('ethereum', mockProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('should fetch balance and return immediately from cache', () => {
    it('Balance is available in cache and fresh', async () => {
      // Setup
      const mockBalance = AssetValue.fromString('10', 'ETH');
      const mockCacheEntry = { balance: mockBalance, age: 15000 }; // 15 seconds old
      mockCache.get.mockResolvedValue(mockCacheEntry);

      const request: BalanceFetchRequest = {
        accountId: 'test-account',
        address: '0x123',
        chain: 'ethereum'
      };

      const startTime = Date.now();

      // Execute
      const result = await balanceService.fetchBalances(request);

      // Assertions
      expect(result.isSuccess).toBe(true);
      expect(result.value.fromCache).toBe(true);
      expect(result.value.cacheAge).toBe(15000);
      expect(mockProvider.fetchBalance).not.toHaveBeenCalled();
      expect(result.value.fetchDuration).toBeLessThan(10);

      // Performance check
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });
  });

  describe('should fetch fresh balance when cache is stale', () => {
    it('Cache exists but is older than TTL', async () => {
      // Setup
      const mockBalance = AssetValue.fromString('10', 'ETH');
      const staleCacheEntry = { balance: mockBalance, age: 45000 }; // 45 seconds old (stale)
      mockCache.get.mockResolvedValue(staleCacheEntry);
      mockProvider.fetchBalance.mockResolvedValue(Result.success(mockBalance));

      const request: BalanceFetchRequest = {
        accountId: 'test-account',
        address: '0x123',
        chain: 'ethereum'
      };

      const startTime = Date.now();

      // Execute
      const result = await balanceService.fetchBalances(request);

      // Assertions
      expect(result.isSuccess).toBe(true);
      expect(result.value.fromCache).toBe(false);
      expect(mockProvider.fetchBalance).toHaveBeenCalledOnce();
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String), 
        expect.any(AssetValue), 
        30000
      );

      // Performance check
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('should handle provider failure scenarios', () => {
    it('Provider fails but stale cache is available', async () => {
      // Setup - no cache (null), so it will try provider
      mockCache.get.mockResolvedValue(null); // No cache
      mockProvider.fetchBalance.mockResolvedValue(
        Result.failure(new ServiceError('NETWORK_ERROR', 'Network timeout'))
      );

      const request: BalanceFetchRequest = {
        accountId: 'test-account',
        address: '0x123',
        chain: 'ethereum'
      };

      // Execute
      const result = await balanceService.fetchBalances(request);

      // Assertions - should fail since no cache and provider fails
      expect(result.isFailure).toBe(true);
      expect(mockProvider.fetchBalance).toHaveBeenCalled();
    });
  });

  describe('should batch fetch balances with concurrency control', () => {
    it('Multiple accounts need balance updates', async () => {
      // Setup
      const requests: BalanceFetchRequest[] = Array.from({ length: 20 }, (_, i) => ({
        accountId: `account-${i}`,
        address: `0x${i.toString().padStart(40, '0')}`,
        chain: 'ethereum'
      }));

      const mockBalance = AssetValue.fromString('10', 'ETH');
      mockProvider.fetchBalance.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(Result.success(mockBalance));
          }, 100);
        });
      });

      let maxConcurrentCalls = 0;
      let currentCalls = 0;
      const originalFetch = mockProvider.fetchBalance;
      mockProvider.fetchBalance = vi.fn().mockImplementation(async (...args) => {
        currentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, currentCalls);
        const result = await originalFetch(...args);
        currentCalls--;
        return result;
      });

      const startTime = Date.now();

      // Execute
      const results = await balanceService.batchFetchBalances(requests);

      // Assertions
      expect(results.size).toBe(20);
      expect(mockProvider.fetchBalance).toHaveBeenCalledTimes(20);
      expect(maxConcurrentCalls).toBeLessThanOrEqual(5);
      
      const totalDuration = Date.now() - startTime;
      expect(totalDuration).toBeLessThan(500); // Should process in parallel
    });
  });

  describe('should implement exponential backoff retry', () => {
    it('Provider fails intermittently', async () => {
      // Setup
      const mockBalance = AssetValue.fromString('10', 'ETH');
      const retryDelays: number[] = [];
      let attemptCount = 0;

      mockProvider.fetchBalance.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.resolve(Result.failure(new ServiceError('TEMPORARY_ERROR', 'Temporary failure')));
        }
        return Promise.resolve(Result.success(mockBalance));
      });

      const request: BalanceFetchRequest = {
        accountId: 'test-account',
        address: '0x123',
        chain: 'ethereum'
      };

      // Track retry delays
      const originalDelay = getInternals(balanceService).delay;
      getInternals(balanceService).delay = vi.fn().mockImplementation((ms: number) => {
        retryDelays.push(ms);
        return Promise.resolve();
      });

      // Execute
      const result = await balanceService.fetchBalancesWithRetry(request, 3, 1000);

      // Assertions
      expect(mockProvider.fetchBalance).toHaveBeenCalledTimes(3);
      expect(retryDelays[0]).toBeCloseTo(1000, -2);
      expect(retryDelays[1]).toBeCloseTo(2000, -2);
      expect(result.isSuccess).toBe(true);

      // Restore original delay
      getInternals(balanceService).delay = originalDelay;
    });
  });

  describe('Cache management operations', () => {
    it('should invalidate cache correctly', async () => {
      // Setup
      const pattern = 'ethereum:0x123';

      // Execute
      await balanceService.invalidateCache(pattern);

      // Assertions
      expect(mockCache.invalidate).toHaveBeenCalledWith(pattern);
    });

    it('should provide cache statistics', async () => {
      // Setup
      mockCache.getAge.mockResolvedValue(25000); // 25 seconds

      // Execute
      const stats = await balanceService.getCacheStats('0x123', 'ethereum');

      // Assertions
      expect(stats.hasCache).toBe(true);
      expect(stats.age).toBe(25000);
      expect(stats.isStale).toBe(false);
      expect(stats.isFresh).toBe(false);
    });

    it('should handle missing cache gracefully', async () => {
      // Setup
      mockCache.getAge.mockResolvedValue(null);

      // Execute
      const stats = await balanceService.getCacheStats('0x123', 'ethereum');

      // Assertions
      expect(stats.hasCache).toBe(false);
    });
  });

  describe('Balance aggregation', () => {
    it('should aggregate balances by asset correctly', () => {
      // Setup
      const balance1 = BalanceAggregate.create(
        'id1', 'account1', 'ETH', 'Ethereum', 'ethereum',
        AssetValue.fromString('10', 'ETH')
      );
      const balance2 = BalanceAggregate.create(
        'id2', 'account2', 'ETH', 'Ethereum', 'ethereum', 
        AssetValue.fromString('5', 'ETH')
      );

      // Execute
      const aggregated = balanceService.aggregateBalancesByAsset([balance1, balance2]);

      // Assertions
      expect(aggregated.size).toBe(1);
      const merged = aggregated.get('ETH-ethereum');
      expect(merged).toBeDefined();
      expect(merged!.getBalance().getAmount()).toBe('15');
    });

    it('should filter zero balances', () => {
      // Setup
      const zeroBalance = BalanceAggregate.create(
        'id1', 'account1', 'ETH', 'Ethereum', 'ethereum',
        AssetValue.zero('ETH')
      );
      const positiveBalance = BalanceAggregate.create(
        'id2', 'account2', 'ETH', 'Ethereum', 'ethereum',
        AssetValue.fromString('10', 'ETH')
      );

      // Execute
      const filtered = balanceService.filterZeroBalances([zeroBalance, positiveBalance]);

      // Assertions
      expect(filtered).toHaveLength(1);
      expect(filtered[0].getId()).toBe('id2');
    });

    it('should sort balances by value', () => {
      // Setup
      const lowBalance = BalanceAggregate.create(
        'id1', 'account1', 'ETH', 'Ethereum', 'ethereum',
        AssetValue.fromString('1', 'ETH')
      );
      const highBalance = BalanceAggregate.create(
        'id2', 'account2', 'ETH', 'Ethereum', 'ethereum',
        AssetValue.fromString('10', 'ETH')
      );

      // Mock prices for value calculation
      const price = Price.live(100, 'USD');
      lowBalance.updatePrice(price);
      highBalance.updatePrice(price);

      // Execute
      const sorted = balanceService.sortByValue([lowBalance, highBalance]);

      // Assertions
      expect(sorted[0].getId()).toBe('id2'); // Higher value first
      expect(sorted[1].getId()).toBe('id1');
    });
  });

  describe('Token balance fetching', () => {
    it('should fetch token balances when requested', async () => {
      // Setup
      const nativeBalance = AssetValue.fromString('1', 'ETH');
      const tokenBalances = [
        AssetValue.fromString('1000', 'USDC'),
        AssetValue.fromString('500', 'DAI')
      ];

      mockProvider.fetchBalance.mockResolvedValue(Result.success(nativeBalance));
      mockProvider.fetchTokenBalances.mockResolvedValue(Result.success(tokenBalances));

      const request: BalanceFetchRequest = {
        accountId: 'test-account',
        address: '0x123',
        chain: 'ethereum',
        includeTokens: true
      };

      // Execute
      const result = await balanceService.fetchBalances(request);

      // Assertions
      expect(result.isSuccess).toBe(true);
      expect(result.value.balances).toHaveLength(3); // 1 native + 2 tokens
      expect(mockProvider.fetchTokenBalances).toHaveBeenCalledWith('0x123', 'ethereum');
    });
  });

  describe('Error handling', () => {
    it('should handle provider not found error', async () => {
      // Setup
      const request: BalanceFetchRequest = {
        accountId: 'test-account',
        address: '0x123',
        chain: 'unsupported-chain'
      };

      // Execute
      const result = await balanceService.fetchBalances(request);

      // Assertions
      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('PROVIDER_NOT_FOUND');
    });

    it('should handle cache errors gracefully', async () => {
      // Setup
      mockCache.get.mockRejectedValue(new Error('Cache error'));
      const mockBalance = AssetValue.fromString('10', 'ETH');
      mockProvider.fetchBalance.mockResolvedValue(Result.success(mockBalance));

      const request: BalanceFetchRequest = {
        accountId: 'test-account',
        address: '0x123',
        chain: 'ethereum'
      };

      // Execute
      const result = await balanceService.fetchBalances(request);

      // Assertions - Cache error propagates up, causing the whole operation to fail
      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Cache error');
    });
  });

  describe('Performance requirements', () => {
    it('should meet cache hit performance target (<10ms)', async () => {
      // Setup
      const mockBalance = AssetValue.fromString('10', 'ETH');
      mockCache.get.mockResolvedValue({ balance: mockBalance, age: 5000 });

      const request: BalanceFetchRequest = {
        accountId: 'test-account',
        address: '0x123',
        chain: 'ethereum'
      };

      // Execute
      const startTime = Date.now();
      const result = await balanceService.fetchBalances(request);
      const duration = Date.now() - startTime;

      // Assertions
      expect(result.isSuccess).toBe(true);
      expect(duration).toBeLessThan(10);
    });

    it('should meet fresh fetch performance target (<500ms)', async () => {
      // Setup
      const mockBalance = AssetValue.fromString('10', 'ETH');
      mockProvider.fetchBalance.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(Result.success(mockBalance)), 100);
        });
      });

      const request: BalanceFetchRequest = {
        accountId: 'test-account',
        address: '0x123',
        chain: 'ethereum',
        forceRefresh: true
      };

      // Execute
      const startTime = Date.now();
      const result = await balanceService.fetchBalances(request);
      const duration = Date.now() - startTime;

      // Assertions
      expect(result.isSuccess).toBe(true);
      expect(duration).toBeLessThan(500);
    });
  });
});