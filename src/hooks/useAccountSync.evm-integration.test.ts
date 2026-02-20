import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useAccountSync } from './useAccountSync';
import { useStore } from '../store/useStore';
import type { Account } from '../store/useStore';

// Use vi.hoisted() so mock functions are available when vi.mock factories run
const {
  mockGetAdapterByName,
  mockGetBalance,
  mockGetTokenBalances,
  mockConnect,
  mockGetSupportedChains,
} = vi.hoisted(() => ({
  mockGetAdapterByName: vi.fn(),
  mockGetBalance: vi.fn(),
  mockGetTokenBalances: vi.fn(),
  mockConnect: vi.fn(),
  mockGetSupportedChains: vi.fn(),
}));

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

// Mock viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBalance: vi.fn().mockResolvedValue(BigInt('1500000000000000000')),
      readContract: vi.fn().mockResolvedValue(BigInt('1000000000')),
    })),
  };
});

// Mock the asset valuator
vi.mock('@cygnus-wealth/asset-valuator', () => ({
  AssetValuator: vi.fn().mockImplementation(() => ({
    getPrice: vi.fn().mockImplementation((symbol: string) => {
      const prices: Record<string, number> = {
        'ETH': 2000, 'MATIC': 1, 'USDC': 1, 'USDT': 1, 'DAI': 1,
      };
      return Promise.resolve({ price: prices[symbol] || 0 });
    }),
  })),
}));

// Mock evm-integration with hoisted mock fns
vi.mock('@cygnus-wealth/evm-integration', () => ({
  ChainRegistry: vi.fn().mockImplementation(() => ({
    getAdapterByName: mockGetAdapterByName,
    getSupportedChains: mockGetSupportedChains,
  })),
}));

// Mock IntegrationProvider to provide integration context
vi.mock('../providers/IntegrationProvider', () => ({
  useIntegration: vi.fn(() => ({
    evmRegistry: {
      getAdapterByName: mockGetAdapterByName,
      getSupportedChains: mockGetSupportedChains,
      getEnvironment: vi.fn().mockReturnValue('production'),
    },
    solanaFacade: {
      getSolanaBalance: vi.fn().mockResolvedValue({ isSuccess: false, getValue: () => 0 }),
      getTokenBalances: vi.fn().mockResolvedValue({ isSuccess: false, getValue: () => [] }),
      getHealthMetrics: vi.fn(),
    },
    rpcConfig: {
      environment: 'production',
      availableProviders: [],
      chains: {},
    },
  })),
  IntegrationProvider: ({ children }: { children: React.ReactNode }) => children,
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

    useStore.setState({
      accounts: [],
      assets: [],
      portfolio: { totalValue: 0, totalAssets: 0, lastUpdated: null },
      isLoading: false,
      error: null,
      networkEnvironment: 'production',
    });

    mockConnect.mockResolvedValue(undefined);
    mockGetBalance.mockResolvedValue({
      assetId: 'ethereum-native',
      asset: { id: 'ethereum-native', symbol: 'ETH', name: 'Ether', decimals: 18, chain: 'ethereum' },
      amount: '1.5',
    });
    mockGetTokenBalances.mockResolvedValue([
      {
        assetId: 'ethereum-usdc',
        asset: { id: 'ethereum-usdc', symbol: 'USDC', name: 'USD Coin', decimals: 6, chain: 'ethereum', contractAddress: '0xa0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        amount: '1000',
      },
      {
        assetId: 'ethereum-usdt',
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
      expect(assets.length).toBeGreaterThanOrEqual(1);
      const baseAssets = assets.filter(a => a.chain === 'Base');
      expect(baseAssets.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Expanded token discovery', () => {
    it('should pass well-known token list to getTokenBalances for Ethereum', async () => {
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

      // getTokenBalances should have been called with a token list (not undefined)
      expect(mockGetTokenBalances).toHaveBeenCalled();
      const tokenListArg = mockGetTokenBalances.mock.calls[0][1];
      expect(tokenListArg).toBeDefined();
      expect(Array.isArray(tokenListArg)).toBe(true);

      // Should include WETH and PYUSD in the token list
      const symbols = tokenListArg.map((t: { symbol: string }) => t.symbol);
      expect(symbols).toContain('WETH');
      expect(symbols).toContain('PYUSD');
      expect(symbols).toContain('USDC');
      expect(symbols).toContain('USDT');
    });

    it('should discover WETH and PYUSD when adapter returns them', async () => {
      mockGetTokenBalances.mockResolvedValue([
        {
          assetId: 'ethereum-usdc',
          asset: { id: 'ethereum-usdc', symbol: 'USDC', name: 'USD Coin', decimals: 6, chain: 'ethereum', contractAddress: '0xa0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
          amount: '1000',
        },
        {
          assetId: 'ethereum-weth',
          asset: { id: 'ethereum-weth', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chain: 'ethereum', contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
          amount: '2.5',
        },
        {
          assetId: 'ethereum-pyusd',
          asset: { id: 'ethereum-pyusd', symbol: 'PYUSD', name: 'PayPal USD', decimals: 6, chain: 'ethereum', contractAddress: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8' },
          amount: '500',
        },
      ]);

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
      const symbols = assets.map(a => a.symbol);
      expect(symbols).toContain('WETH');
      expect(symbols).toContain('PYUSD');
      expect(symbols).toContain('USDC');
    });

    it('should merge user-configured tokens with well-known tokens', async () => {
      const account: Account = {
        id: 'account-1',
        type: 'wallet',
        platform: 'Multi-Chain EVM',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
        metadata: { detectedChains: ['Ethereum'] },
        tokens: [
          { address: '0x1111111111111111111111111111111111111111', symbol: 'CUSTOM', name: 'Custom Token', decimals: 18, chainId: 1 },
        ],
      };

      useStore.setState({ accounts: [account] });
      renderHook(() => useAccountSync());
      await new Promise(resolve => setTimeout(resolve, 500));

      const tokenListArg = mockGetTokenBalances.mock.calls[0][1];
      const symbols = tokenListArg.map((t: { symbol: string }) => t.symbol);
      expect(symbols).toContain('CUSTOM');
      expect(symbols).toContain('WETH');
    });

    it('should use formatted value.amount when available', async () => {
      // Simulate what the real evm-integration returns: raw bigint in amount, formatted in value.amount
      mockGetBalance.mockResolvedValue({
        assetId: 'ethereum-native',
        asset: { id: 'ethereum-native', symbol: 'ETH', name: 'Ether', decimals: 18, chain: 'ethereum' },
        amount: '1500000000000000000', // raw bigint
        value: { amount: 1.5, currency: 'USD', timestamp: new Date() },
      });
      mockGetTokenBalances.mockResolvedValue([
        {
          assetId: 'ethereum-usdc',
          asset: { id: 'ethereum-usdc', symbol: 'USDC', name: 'USD Coin', decimals: 6, chain: 'ethereum', contractAddress: '0xa0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
          amount: '1000000000', // raw bigint (1000 USDC with 6 decimals)
          value: { amount: 1000, currency: 'USD', timestamp: new Date() },
        },
      ]);

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
      const ethAsset = assets.find(a => a.symbol === 'ETH');
      const usdcAsset = assets.find(a => a.symbol === 'USDC');

      // Should use formatted values, not raw bigints
      expect(ethAsset?.balance).toBe('1.5');
      expect(usdcAsset?.balance).toBe('1000');
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

      const assets = useStore.getState().assets;
      const ethAssets = assets.filter(a => a.chain === 'Ethereum');
      expect(ethAssets.length).toBeGreaterThanOrEqual(1);
    });

    it('should warn but not crash for unsupported chains like Avalanche', async () => {
      mockGetAdapterByName.mockImplementation((name: string) => {
        if (name === 'Avalanche') throw new Error('Chain not supported');
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
        metadata: { detectedChains: ['Ethereum', 'Avalanche'] },
      };

      useStore.setState({ accounts: [account] });
      renderHook(() => useAccountSync());
      await new Promise(resolve => setTimeout(resolve, 500));

      const assets = useStore.getState().assets;
      const ethAssets = assets.filter(a => a.chain === 'Ethereum');
      expect(ethAssets.length).toBeGreaterThanOrEqual(1);
    });
  });
});
