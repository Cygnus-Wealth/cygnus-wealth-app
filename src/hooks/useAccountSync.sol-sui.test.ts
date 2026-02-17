import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAccountSync } from './useAccountSync';
import { useStore } from '../store/useStore';
import type { Account } from '../store/useStore';

// Mock evm-integration to avoid module resolution errors
vi.mock('@cygnus-wealth/evm-integration', () => ({
  ChainRegistry: vi.fn().mockImplementation(() => ({
    getAdapterByName: vi.fn().mockReturnValue({
      connect: vi.fn().mockResolvedValue(undefined),
      getBalance: vi.fn().mockResolvedValue({ amount: '0' }),
      getTokenBalances: vi.fn().mockResolvedValue([]),
    }),
    getSupportedChains: vi.fn().mockReturnValue([]),
  })),
}));

// Mock wallet-integration-system
vi.mock('@cygnus-wealth/wallet-integration-system', () => ({
  WalletManager: vi.fn(),
  Chain: {
    ETHEREUM: 'ETHEREUM',
    POLYGON: 'POLYGON',
    ARBITRUM: 'ARBITRUM',
    OPTIMISM: 'OPTIMISM',
    BSC: 'BSC',
    AVALANCHE: 'AVALANCHE',
    BASE: 'BASE',
    SOLANA: 'SOLANA',
    SUI: 'SUI',
  },
  IntegrationSource: {
    EVM_WALLET: 'EVM_WALLET',
    SOLANA_WALLET: 'SOLANA_WALLET',
    SUI_WALLET: 'SUI_WALLET',
    CEX: 'CEX',
    MANUAL: 'MANUAL'
  },
  SolanaWalletIntegration: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(true),
    getBalances: vi.fn().mockResolvedValue([{
      amount: '1.5',
      asset: {
        symbol: 'SOL',
        name: 'Solana',
        address: 'native'
      },
      source: 'SOLANA_WALLET'
    }])
  })),
  SuiWalletIntegration: vi.fn().mockImplementation(() => {
    const mockInstance = {
      connect: vi.fn().mockResolvedValue(true),
      getBalances: vi.fn().mockResolvedValue([{
        amount: '2.5',
        asset: {
          symbol: 'SUI',
          name: 'Sui',
          address: 'native'
        },
        source: 'SUI_WALLET'
      }])
    };
    return mockInstance;
  })
}));

// Mock Solana web3.js
vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn().mockImplementation(() => ({
    getBalance: vi.fn().mockResolvedValue(1500000000), // 1.5 SOL in lamports
    getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: 'test-blockhash' }),
    getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({
      value: [] // No token accounts for simplicity
    }),
    getHealth: vi.fn().mockResolvedValue('ok'),
  })),
  PublicKey: vi.fn().mockImplementation((key) => ({ 
    toString: () => key,
    toBase58: () => key 
  })),
  LAMPORTS_PER_SOL: 1000000000,
}));

// Mock SUI SDK
vi.mock('@mysten/sui.js/client', () => ({
  SuiClient: vi.fn().mockImplementation(() => ({
    getBalance: vi.fn().mockResolvedValue({
      coinType: '0x2::sui::SUI',
      totalBalance: '2500000000', // 2.5 SUI (9 decimals)
    }),
  })),
  getFullnodeUrl: vi.fn().mockReturnValue('https://fullnode.mainnet.sui.io'),
}));

// Mock the asset valuator
vi.mock('@cygnus-wealth/asset-valuator', () => ({
  AssetValuator: vi.fn().mockImplementation(() => ({
    getPrice: vi.fn().mockImplementation((symbol) => {
      const prices: Record<string, number> = {
        'SOL': 50,
        'SUI': 1.2,
      };
      return Promise.resolve({ price: prices[symbol] || 0 });
    }),
  })),
}));

describe('useAccountSync - Solana & SUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    // Mock console.log to prevent debug output in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Reset store
    useStore.setState({
      accounts: [],
      assets: [],
      portfolio: {
        totalValue: 0,
        totalAssets: 0,
        lastUpdated: null,
      },
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Solana Integration', () => {
    // Skipped: hook currently skips Solana — sol-integration library not yet available
    it.skip('should sync Solana wallet balances', async () => {
      const solanaAccount: Account = {
        id: 'sol-account-1',
        type: 'wallet',
        platform: 'Solana',
        label: 'Phantom Wallet',
        address: '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs',
        status: 'connected',
        metadata: {
          connectionType: 'Phantom',
        },
      };

      useStore.setState({ accounts: [solanaAccount] });

      renderHook(() => useAccountSync());
      
      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const assets = useStore.getState().assets;
      expect(assets).toHaveLength(1);
      
      const solAsset = assets[0];
      expect(solAsset.symbol).toBe('SOL');
      expect(solAsset.name).toBe('Solana');
      expect(solAsset.balance).toBe('1.5'); // 1500000000 / 1e9
      expect(solAsset.priceUsd).toBe(50);
      expect(solAsset.valueUsd).toBe(75); // 1.5 * 50
      expect(solAsset.chain).toBe('Solana');
    });

    it.skip('should handle multiple Solana accounts', async () => {
      const accounts: Account[] = [
        {
          id: 'sol-account-1',
          type: 'wallet',
          platform: 'Solana',
          label: 'Phantom Account 1',
          address: '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs',
          status: 'connected',
        },
        {
          id: 'sol-account-2',
          type: 'wallet',
          platform: 'Solana',
          label: 'Phantom Account 2',
          address: '5ZiE3vAkrdXBgyFL7KqG3RoEGBws4CjRcXVbABDLZTgx',
          status: 'connected',
        },
      ];

      // Reset store completely and set fresh state
      useStore.setState({
        accounts,
        assets: [],
        portfolio: { totalValue: 0, totalAssets: 0, lastUpdated: null }
      });

      const { unmount } = renderHook(() => useAccountSync());
      
      // Give more time for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      const assets = useStore.getState().assets;
      expect(assets).toHaveLength(2);
      
      unmount();
      
      // Check both accounts have SOL
      expect(assets.every(a => a.symbol === 'SOL')).toBe(true);
      expect(assets[0].accountId).toBe('sol-account-1');
      expect(assets[1].accountId).toBe('sol-account-2');
    });
  });

  describe('SUI Integration', () => {
    // Skipped: hook currently skips SUI — sui-integration library not yet available
    it.skip('should sync SUI wallet balances', async () => {
      const suiAccount: Account = {
        id: 'sui-account-1',
        type: 'wallet',
        platform: 'SUI',
        label: 'Sui Wallet',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        status: 'connected',
        metadata: {
          connectionType: 'Suiet',
        },
      };

      // Reset store completely and set fresh state
      useStore.setState({
        accounts: [suiAccount],
        assets: [],
        portfolio: { totalValue: 0, totalAssets: 0, lastUpdated: null }
      });

      const { unmount } = renderHook(() => useAccountSync());
      
      // Give more time for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      const assets = useStore.getState().assets;
      expect(assets).toHaveLength(1);
      
      unmount();
      
      const suiAsset = assets[0];
      expect(suiAsset.symbol).toBe('SUI');
      expect(suiAsset.name).toBe('Sui');
      expect(suiAsset.balance).toBe('2.5'); // 2500000000 / 1e9
      expect(suiAsset.priceUsd).toBe(1.2);
      expect(suiAsset.valueUsd).toBe(3); // 2.5 * 1.2
      expect(suiAsset.chain).toBe('SUI');
    });

    it.skip('should handle errors when fetching SUI balance', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock SuiClient to throw error
      const { SuiClient } = await import('@mysten/sui.js/client');
      (SuiClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        getBalance: vi.fn().mockRejectedValue(new Error('Network error'))
      }));

      const suiAccount: Account = {
        id: 'sui-account-1',
        type: 'wallet',
        platform: 'SUI',
        label: 'Sui Wallet',
        address: '0x1234',
        status: 'connected',
      };

      useStore.setState({ accounts: [suiAccount] });

      renderHook(() => useAccountSync());

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(useStore.getState().assets).toHaveLength(0);

      consoleErrorSpy.mockRestore();

      // Reset the mock back to successful response for subsequent tests
      (SuiClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        getBalance: vi.fn().mockResolvedValue({
          coinType: '0x2::sui::SUI',
          totalBalance: '2500000000',
        }),
      }));
    });
  });

  describe('Mixed Chain Accounts', () => {
    // Skipped: hook currently skips Solana/SUI platforms
    it.skip('should sync EVM, Solana, and SUI accounts together', async () => {
      // Reset SUI mock to return valid data
      const { SuiClient } = await import('@mysten/sui.js/client');
      (SuiClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        getBalance: vi.fn().mockResolvedValue({
          totalBalance: '2500000000', // 2.5 SUI in atomic units
        }),
      }));

      const accounts: Account[] = [
        {
          id: 'sol-account',
          type: 'wallet',
          platform: 'Solana',
          label: 'Phantom',
          address: '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs',
          status: 'connected',
        },
        {
          id: 'sui-account',
          type: 'wallet',
          platform: 'SUI',
          label: 'Sui Wallet',
          address: '0x1234567890abcdef1234567890abcdef12345678',
          status: 'connected',
        },
      ];

      useStore.setState({ accounts });

      renderHook(() => useAccountSync());
      
      await new Promise(resolve => setTimeout(resolve, 500));

      const assets = useStore.getState().assets;
      console.log('Assets found:', assets.map(a => ({ symbol: a.symbol, chain: a.chain })));
      expect(assets).toHaveLength(2);
      
      // Check we have one of each asset type
      const symbols = assets.map(a => a.symbol);
      expect(symbols).toContain('SOL');
      expect(symbols).toContain('SUI');
      
      // Check portfolio totals
      const portfolio = useStore.getState().portfolio;
      expect(portfolio.totalAssets).toBe(2);
      expect(portfolio.totalValue).toBeGreaterThan(0);
    });
  });

  describe('Portfolio Calculation', () => {
    it.skip('should calculate correct portfolio totals with SOL and SUI', async () => {
      // Reset SUI mock to return valid data
      const { SuiClient } = await import('@mysten/sui.js/client');
      (SuiClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        getBalance: vi.fn().mockResolvedValue({
          totalBalance: '2500000000', // 2.5 SUI in atomic units
        }),
      }));

      const accounts: Account[] = [
        {
          id: 'sol-account',
          type: 'wallet',
          platform: 'Solana',
          label: 'Phantom',
          address: '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs',
          status: 'connected',
        },
        {
          id: 'sui-account',
          type: 'wallet',
          platform: 'SUI',
          label: 'Sui Wallet',
          address: '0x1234567890abcdef1234567890abcdef12345678',
          status: 'connected',
        },
      ];

      useStore.setState({ accounts });

      renderHook(() => useAccountSync());
      
      await new Promise(resolve => setTimeout(resolve, 500));

      const portfolio = useStore.getState().portfolio;
      const assets = useStore.getState().assets;
      
      // Expect 1 asset per account since each has only the native token
      expect(assets).toHaveLength(2); 
      expect(portfolio.totalAssets).toBe(2);
      expect(portfolio.totalValue).toBe(78); // (1.5 * 50) + (2.5 * 1.2) = 75 + 3 = 78
      expect(portfolio.lastUpdated).toBeTruthy();
    });
  });
});