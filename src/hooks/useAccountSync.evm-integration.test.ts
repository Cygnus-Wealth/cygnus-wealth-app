import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAccountSync } from './useAccountSync';
import { useStore } from '../store/useStore';
import type { Account } from '../store/useStore';

// Mock the wallet integration system
vi.mock('@cygnus-wealth/wallet-integration-system', () => ({
  Chain: {
    ETHEREUM: 'ethereum',
    POLYGON: 'polygon',
    BSC: 'bsc',
    ARBITRUM: 'arbitrum',
    OPTIMISM: 'optimism',
    AVALANCHE: 'avalanche',
    BASE: 'base'
  }
}));

// Mock viem - keep basic client creation
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBalance: vi.fn().mockResolvedValue(BigInt('1500000000000000000')), // 1.5 ETH
      readContract: vi.fn().mockResolvedValue(BigInt('1000000000')),
    })),
  };
});

// Mock the asset valuator
vi.mock('@cygnus-wealth/asset-valuator', () => ({
  AssetValuator: vi.fn().mockImplementation(() => ({
    getPrice: vi.fn().mockImplementation((symbol: string) => {
      const prices: Record<string, number> = {
        'ETH': 2000,
        'MATIC': 1,
        'USDC': 1,
        'USDT': 1,
        'DAI': 1,
      };
      return Promise.resolve({ price: prices[symbol] || 0 });
    }),
  })),
}));

// Track ChainRegistry usage
const mockGetAdapterByName = vi.fn();
const mockGetBalance = vi.fn();
const mockGetTokenBalances = vi.fn();
const mockConnect = vi.fn();
const mockGetSupportedChains = vi.fn();

vi.mock('@cygnus-wealth/evm-integration', () => ({
  ChainRegistry: vi.fn().mockImplementation(() => ({
    getAdapterByName: mockGetAdapterByName,
    getSupportedChains: mockGetSupportedChains,
  })),
  defaultRegistry: {
    getAdapterByName: mockGetAdapterByName,
    getSupportedChains: mockGetSupportedChains,
  },
}));

// Mock fetch to ensure we're NOT using Ethplorer
global.fetch = vi.fn() as unknown as typeof fetch;

describe('useAccountSync - EVM Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset store
    useStore.setState({
      accounts: [],
      assets: [],
      portfolio: { totalValue: 0, totalAssets: 0, lastUpdated: null },
      isLoading: false,
      error: null,
    });

    // Default mock: adapter returns native + token balances
    mockConnect.mockResolvedValue(undefined);
    mockGetBalance.mockResolvedValue({
      assetId: 'ethereum-native',
      asset: { id: 'ethereum-native', symbol: 'ETH', name: 'Ether', decimals: 18, chain: 'ethereum' },
      amount: '1.5',
    });
    mockGetTokenBalances.mockResolvedValue([
      {
        assetId: 'ethereum-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        asset: { id: 'ethereum-usdc', symbol: 'USDC', name: 'USD Coin', decimals: 6, chain: 'ethereum', contractAddress: '0xa0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        amount: '1000',
      },
      {
        assetId: 'ethereum-0xdac17f958d2ee523a2206206994597c13d831ec7',
        asset: { id: 'ethereum-usdt', symbol: 'USDT', name: 'Tether USD', decimals: 6, chain: 'ethereum', contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
        amount: '500',
      },
    ]);
    mockGetAdapterByName.mockReturnValue({
      connect: mockConnect,
      getBalance: mockGetBalance,
      getTokenBalances: mockGetTokenBalances,
    });
    mockGetSupportedChains.mockReturnValue([
      { id: 1, name: 'Ethereum', symbol: 'ETH', decimals: 18 },
      { id: 137, name: 'Polygon', symbol: 'MATIC', decimals: 18 },
      { id: 42161, name: 'Arbitrum One', symbol: 'ETH', decimals: 18 },
      { id: 10, name: 'Optimism', symbol: 'ETH', decimals: 18 },
      { id: 8453, name: 'Base', symbol: 'ETH', decimals: 18 },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ERC20 Token Discovery via evm-integration', () => {
    it('should use ChainRegistry adapter for token discovery instead of Ethplorer', async () => {
      const account: Account = {
        id: 'account-1',
        type: 'wallet',
        platform: 'Multi-Chain EVM',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
        metadata: { detectedChains: ['Ethereum'] },
      };

      useStore.setState({ accounts: [account] });
      renderHook(() => useAccountSync());
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should NOT have called Ethplorer
      const fetchCalls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const ethplorerCalls = fetchCalls.filter((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('ethplorer')
      );
      expect(ethplorerCalls).toHaveLength(0);
    });

    it('should include ERC20 tokens from evm-integration in returned assets', async () => {
      const account: Account = {
        id: 'account-1',
        type: 'wallet',
        platform: 'Multi-Chain EVM',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
        metadata: { detectedChains: ['Ethereum'] },
      };

      useStore.setState({ accounts: [account] });
      renderHook(() => useAccountSync());
      await new Promise(resolve => setTimeout(resolve, 500));

      const assets = useStore.getState().assets;
      // Should have native ETH + USDC + USDT from the adapter
      expect(assets.length).toBeGreaterThanOrEqual(3);

      const symbols = assets.map(a => a.symbol);
      expect(symbols).toContain('ETH');
      expect(symbols).toContain('USDC');
      expect(symbols).toContain('USDT');
    });
  });

  describe('Base Chain Support', () => {
    it('should fetch balances for Base chain when in detectedChains', async () => {
      const account: Account = {
        id: 'account-1',
        type: 'wallet',
        platform: 'Multi-Chain EVM',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
        metadata: { detectedChains: ['Base'] },
      };

      useStore.setState({ accounts: [account] });
      renderHook(() => useAccountSync());
      await new Promise(resolve => setTimeout(resolve, 500));

      const assets = useStore.getState().assets;
      // Should have found at least the native ETH on Base
      expect(assets.length).toBeGreaterThanOrEqual(1);
      const baseAssets = assets.filter(a => a.chain === 'Base');
      expect(baseAssets.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Unsupported chain handling', () => {
    it('should warn but not crash for unsupported chains like BSC', async () => {
      mockGetAdapterByName.mockImplementation((name: string) => {
        if (name === 'BSC') throw new Error('Chain not supported');
        return {
          connect: mockConnect,
          getBalance: mockGetBalance,
          getTokenBalances: mockGetTokenBalances,
        };
      });

      const account: Account = {
        id: 'account-1',
        type: 'wallet',
        platform: 'Multi-Chain EVM',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
        metadata: { detectedChains: ['Ethereum', 'BSC'] },
      };

      useStore.setState({ accounts: [account] });
      renderHook(() => useAccountSync());
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should still have Ethereum assets despite BSC failure
      const assets = useStore.getState().assets;
      const ethAssets = assets.filter(a => a.chain === 'Ethereum');
      expect(ethAssets.length).toBeGreaterThanOrEqual(1);
    });
  });
});
