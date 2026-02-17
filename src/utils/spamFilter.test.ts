import { describe, it, expect } from 'vitest';
import { isSpamOrWorthless, shouldHideByDefault, filterSpamTokens, DUST_THRESHOLD_USD } from './spamFilter';
import type { Asset } from '../store/useStore';

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'test-asset',
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '1.0',
    source: 'MetaMask',
    chain: 'Ethereum',
    accountId: 'acc-1',
    priceUsd: 2000,
    valueUsd: 2000,
    ...overrides,
  };
}

describe('spamFilter', () => {
  describe('isSpamOrWorthless', () => {
    it('should return false for a valid priced asset', () => {
      expect(isSpamOrWorthless(makeAsset())).toBe(false);
    });

    it('should return true when priceUsd is 0', () => {
      expect(isSpamOrWorthless(makeAsset({ priceUsd: 0 }))).toBe(true);
    });

    it('should return true when priceUsd is null', () => {
      expect(isSpamOrWorthless(makeAsset({ priceUsd: null }))).toBe(true);
    });

    it('should return true when priceUsd is NaN', () => {
      expect(isSpamOrWorthless(makeAsset({ priceUsd: NaN }))).toBe(true);
    });

    it('should return true when valueUsd is 0', () => {
      expect(isSpamOrWorthless(makeAsset({ valueUsd: 0 }))).toBe(true);
    });

    it('should return true when valueUsd is null', () => {
      expect(isSpamOrWorthless(makeAsset({ valueUsd: null }))).toBe(true);
    });

    it('should return true when valueUsd is NaN', () => {
      expect(isSpamOrWorthless(makeAsset({ valueUsd: NaN }))).toBe(true);
    });

    it('should return true when valueUsd is negative', () => {
      expect(isSpamOrWorthless(makeAsset({ valueUsd: -5 }))).toBe(true);
    });

    it('should detect spam tokens with "visit" URL patterns in name', () => {
      expect(isSpamOrWorthless(makeAsset({ name: 'Visit ethgift.org to claim' }))).toBe(true);
    });

    it('should detect spam tokens with "claim" in name', () => {
      expect(isSpamOrWorthless(makeAsset({ name: 'Claim your reward at...' }))).toBe(true);
    });

    it('should detect spam tokens with "airdrop" in name', () => {
      expect(isSpamOrWorthless(makeAsset({ name: 'Free Airdrop Token' }))).toBe(true);
    });

    it('should detect spam tokens with .com in name', () => {
      expect(isSpamOrWorthless(makeAsset({ name: 'scamtoken.com' }))).toBe(true);
    });

    it('should not flag legitimate tokens', () => {
      expect(isSpamOrWorthless(makeAsset({ name: 'USD Coin', symbol: 'USDC', priceUsd: 1, valueUsd: 100 }))).toBe(false);
      expect(isSpamOrWorthless(makeAsset({ name: 'Wrapped Ether', symbol: 'WETH', priceUsd: 2000, valueUsd: 4000 }))).toBe(false);
    });
  });

  describe('shouldHideByDefault', () => {
    it('should hide spam tokens', () => {
      expect(shouldHideByDefault(makeAsset({ priceUsd: 0 }), 0)).toBe(true);
    });

    it('should hide dust (below threshold)', () => {
      const asset = makeAsset({ priceUsd: 0.001, valueUsd: 0.001 });
      expect(shouldHideByDefault(asset, 0.001)).toBe(true);
    });

    it('should not hide tokens above dust threshold', () => {
      const asset = makeAsset({ priceUsd: 1, valueUsd: 10 });
      expect(shouldHideByDefault(asset, 10)).toBe(false);
    });

    it('dust threshold should be $0.01', () => {
      expect(DUST_THRESHOLD_USD).toBe(0.01);
    });
  });

  describe('filterSpamTokens', () => {
    it('should remove spam tokens from array', () => {
      const assets = [
        makeAsset({ id: 'good-1', symbol: 'ETH', priceUsd: 2000, valueUsd: 2000 }),
        makeAsset({ id: 'spam-1', symbol: 'SCAM', priceUsd: 0, valueUsd: 0 }),
        makeAsset({ id: 'good-2', symbol: 'USDC', priceUsd: 1, valueUsd: 100 }),
        makeAsset({ id: 'spam-2', name: 'Visit scam.com to claim', priceUsd: 1, valueUsd: 1 }),
      ];

      const filtered = filterSpamTokens(assets);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(a => a.id)).toEqual(['good-1', 'good-2']);
    });

    it('should return empty array when all tokens are spam', () => {
      const assets = [
        makeAsset({ id: 'spam-1', priceUsd: 0, valueUsd: 0 }),
        makeAsset({ id: 'spam-2', priceUsd: null, valueUsd: null }),
      ];

      expect(filterSpamTokens(assets)).toHaveLength(0);
    });

    it('should return all tokens when none are spam', () => {
      const assets = [
        makeAsset({ id: 'good-1', priceUsd: 100, valueUsd: 100 }),
        makeAsset({ id: 'good-2', priceUsd: 1, valueUsd: 50 }),
      ];

      expect(filterSpamTokens(assets)).toHaveLength(2);
    });
  });
});
