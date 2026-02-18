import { describe, it, expect } from 'vitest';
import type {
  LiquidityPosition,
  StakedPosition,
  LendingPosition,
  VaultPosition,
  Asset,
  Chain,
  LendingPositionType,
  VaultStrategyType,
  AssetType,
} from '@cygnus-wealth/data-models';
import {
  getDeFiPositions,
  normalizeLiquidityPosition,
  normalizeStakedPosition,
  normalizeLendingPosition,
  normalizeVaultPosition,
} from '../DeFiPositionService';

const mockAsset = (symbol: string, name: string): Asset => ({
  id: `test-${symbol.toLowerCase()}`,
  symbol,
  name,
  type: 'CRYPTOCURRENCY' as AssetType,
});

describe('DeFiPositionService', () => {
  describe('normalizeLiquidityPosition', () => {
    it('should convert a LiquidityPosition to unified DeFiPosition', () => {
      const lp: LiquidityPosition = {
        id: 'uniswap-eth-usdc-1',
        protocol: 'Uniswap V3',
        poolAddress: '0xabc',
        poolName: 'ETH/USDC',
        chain: 'ETHEREUM' as Chain,
        tokens: [
          { assetId: 'eth', asset: mockAsset('ETH', 'Ethereum'), amount: '5.0' },
          { assetId: 'usdc', asset: mockAsset('USDC', 'USD Coin'), amount: '10000' },
        ],
        value: { value: 20000, currency: 'USD', timestamp: new Date() },
      };

      const result = normalizeLiquidityPosition(lp, 'subgraph');

      expect(result.id).toBe('uniswap-eth-usdc-1');
      expect(result.protocol).toBe('Uniswap V3');
      expect(result.positionType).toBe('lp');
      expect(result.label).toBe('ETH/USDC');
      expect(result.chain).toBe('ETHEREUM');
      expect(result.underlyingAssets).toHaveLength(2);
      expect(result.underlyingAssets[0].symbol).toBe('ETH');
      expect(result.underlyingAssets[1].symbol).toBe('USDC');
      expect(result.valueUsd).toBe(20000);
      expect(result.discoverySource).toBe('subgraph');
    });

    it('should handle missing value', () => {
      const lp: LiquidityPosition = {
        id: 'lp-1',
        protocol: 'Curve',
        poolAddress: '0x',
        poolName: 'stETH/ETH',
        chain: 'ETHEREUM' as Chain,
        tokens: [],
      };

      const result = normalizeLiquidityPosition(lp, 'rpc');
      expect(result.valueUsd).toBe(0);
    });
  });

  describe('normalizeStakedPosition', () => {
    it('should convert a StakedPosition to unified DeFiPosition', () => {
      const staked: StakedPosition = {
        id: 'lido-steth-1',
        protocol: 'Lido',
        chain: 'ETHEREUM' as Chain,
        asset: mockAsset('ETH', 'Ethereum'),
        stakedAmount: '32.0',
        rewards: [],
        apr: 4.2,
        value: { value: 64000, currency: 'USD', timestamp: new Date() },
      };

      const result = normalizeStakedPosition(staked, 'on-chain');

      expect(result.positionType).toBe('staking');
      expect(result.label).toBe('ETH Staking');
      expect(result.underlyingAssets).toHaveLength(1);
      expect(result.underlyingAssets[0].amount).toBe('32.0');
      expect(result.valueUsd).toBe(64000);
      expect(result.apy).toBe(4.2);
    });
  });

  describe('normalizeLendingPosition', () => {
    it('should convert a LendingPosition to unified DeFiPosition', () => {
      const lending: LendingPosition = {
        id: 'aave-usdc-1',
        protocol: 'Aave V3',
        chain: 'ETHEREUM' as Chain,
        type: 'SUPPLY' as LendingPositionType,
        asset: mockAsset('USDC', 'USD Coin'),
        amount: '50000',
        apy: 3.5,
        value: { value: 50000, currency: 'USD', timestamp: new Date() },
      };

      const result = normalizeLendingPosition(lending, 'subgraph');

      expect(result.positionType).toBe('lending');
      expect(result.label).toBe('USDC SUPPLY');
      expect(result.apy).toBe(3.5);
      expect(result.valueUsd).toBe(50000);
    });
  });

  describe('normalizeVaultPosition', () => {
    it('should convert a VaultPosition to unified DeFiPosition', () => {
      const vault: VaultPosition = {
        id: 'yearn-usdc-1',
        protocol: 'Yearn V3',
        vaultAddress: '0xvault',
        vaultName: 'USDC yVault',
        chain: 'ETHEREUM' as Chain,
        strategyType: 'YIELD_AGGREGATOR' as VaultStrategyType,
        depositAsset: mockAsset('USDC', 'USD Coin'),
        depositedAmount: '50000',
        apy: 8.5,
        value: { value: 50000, currency: 'USD', timestamp: new Date() },
      };

      const result = normalizeVaultPosition(vault, 'on-chain');

      expect(result.positionType).toBe('vault');
      expect(result.label).toBe('USDC yVault');
      expect(result.apy).toBe(8.5);
      expect(result.valueUsd).toBe(50000);
    });
  });

  describe('getDeFiPositions', () => {
    it('should aggregate positions from all types', () => {
      const rawData = {
        liquidityPositions: [
          {
            id: 'lp-1',
            protocol: 'Uniswap V3',
            poolAddress: '0x',
            poolName: 'ETH/USDC',
            chain: 'ETHEREUM' as Chain,
            tokens: [
              { assetId: 'eth', asset: mockAsset('ETH', 'Ethereum'), amount: '5' },
              { assetId: 'usdc', asset: mockAsset('USDC', 'USD Coin'), amount: '10000' },
            ],
            value: { value: 20000, currency: 'USD', timestamp: new Date() },
          },
        ],
        stakedPositions: [
          {
            id: 'stk-1',
            protocol: 'Lido',
            chain: 'ETHEREUM' as Chain,
            asset: mockAsset('ETH', 'Ethereum'),
            stakedAmount: '10',
            rewards: [],
            apr: 4.0,
            value: { value: 20000, currency: 'USD', timestamp: new Date() },
          },
        ],
        lendingPositions: [
          {
            id: 'lnd-1',
            protocol: 'Aave V3',
            chain: 'ARBITRUM' as Chain,
            type: 'SUPPLY' as LendingPositionType,
            asset: mockAsset('USDC', 'USD Coin'),
            amount: '5000',
            apy: 3.0,
            value: { value: 5000, currency: 'USD', timestamp: new Date() },
          },
        ],
        vaultPositions: [
          {
            id: 'vlt-1',
            protocol: 'Yearn V3',
            vaultAddress: '0x',
            vaultName: 'USDC yVault',
            chain: 'ETHEREUM' as Chain,
            strategyType: 'YIELD_AGGREGATOR' as VaultStrategyType,
            depositAsset: mockAsset('USDC', 'USD Coin'),
            depositedAmount: '10000',
            apy: 8.0,
            value: { value: 10000, currency: 'USD', timestamp: new Date() },
          },
        ],
      };

      const positions = getDeFiPositions(rawData, 'test-source');

      expect(positions).toHaveLength(4);
      expect(positions[0].positionType).toBe('lp');
      expect(positions[1].positionType).toBe('staking');
      expect(positions[2].positionType).toBe('lending');
      expect(positions[3].positionType).toBe('vault');

      const totalValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);
      expect(totalValue).toBe(55000);
    });

    it('should handle empty raw data', () => {
      const positions = getDeFiPositions({});
      expect(positions).toHaveLength(0);
    });

    it('should handle partial raw data', () => {
      const positions = getDeFiPositions({
        stakedPositions: [
          {
            id: 'stk-1',
            protocol: 'Lido',
            chain: 'ETHEREUM' as Chain,
            asset: mockAsset('ETH', 'Ethereum'),
            stakedAmount: '32',
            rewards: [],
          },
        ],
      });

      expect(positions).toHaveLength(1);
      expect(positions[0].positionType).toBe('staking');
    });

    it('should use default source when not provided', () => {
      const positions = getDeFiPositions({
        stakedPositions: [
          {
            id: 'stk-1',
            protocol: 'Lido',
            chain: 'ETHEREUM' as Chain,
            asset: mockAsset('ETH', 'Ethereum'),
            stakedAmount: '32',
            rewards: [],
          },
        ],
      });

      expect(positions[0].discoverySource).toBe('on-chain');
    });
  });
});
