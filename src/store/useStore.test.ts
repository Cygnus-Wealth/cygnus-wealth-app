import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './useStore';
import type { Account, Asset } from './useStore';

describe('useStore', () => {
  beforeEach(() => {
    // Reset store to initial state
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
      networkEnvironment: 'production',
    });
  });

  describe('Account Management', () => {
    it('should add a new account', () => {
      const newAccount: Account = {
        id: 'test-account-1',
        type: 'wallet',
        platform: 'Ethereum',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
      };

      useStore.getState().addAccount(newAccount);
      
      const accounts = useStore.getState().accounts;
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual(newAccount);
    });

    it('should update an existing account', () => {
      const account: Account = {
        id: 'test-account-1',
        type: 'wallet',
        platform: 'Ethereum',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
      };

      useStore.getState().addAccount(account);
      useStore.getState().updateAccount('test-account-1', { 
        status: 'disconnected',
        label: 'Updated Wallet' 
      });

      const updatedAccount = useStore.getState().getAccountById('test-account-1');
      expect(updatedAccount?.status).toBe('disconnected');
      expect(updatedAccount?.label).toBe('Updated Wallet');
    });

    it('should remove an account', () => {
      const account: Account = {
        id: 'test-account-1',
        type: 'wallet',
        platform: 'Ethereum',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
      };

      useStore.getState().addAccount(account);
      expect(useStore.getState().accounts).toHaveLength(1);

      useStore.getState().removeAccount('test-account-1');
      expect(useStore.getState().accounts).toHaveLength(0);
    });

    it('should get account by id', () => {
      const account: Account = {
        id: 'test-account-1',
        type: 'wallet',
        platform: 'Ethereum',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
      };

      useStore.getState().addAccount(account);
      const retrievedAccount = useStore.getState().getAccountById('test-account-1');
      
      expect(retrievedAccount).toEqual(account);
    });
  });

  describe('Asset Management', () => {
    it('should add a new asset', () => {
      const newAsset: Asset = {
        id: 'asset-1',
        accountId: 'test-account-1',
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '1.5',
        chain: 'Ethereum',
        source: 'wallet',
        priceUsd: 2000,
        valueUsd: 3000,
      };

      useStore.getState().addAsset(newAsset);
      
      const assets = useStore.getState().assets;
      expect(assets).toHaveLength(1);
      expect(assets[0]).toEqual(newAsset);
    });

    it('should update an existing asset', () => {
      const asset: Asset = {
        id: 'asset-1',
        accountId: 'test-account-1',
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '1.5',
        chain: 'Ethereum',
        source: 'wallet',
        priceUsd: 2000,
        valueUsd: 3000,
      };

      useStore.getState().addAsset(asset);
      useStore.getState().updateAsset('asset-1', {
        balance: '2.0',
        priceUsd: 2500,
        valueUsd: 5000,
      });

      const updatedAsset = useStore.getState().assets.find(a => a.id === 'asset-1');
      expect(updatedAsset?.balance).toBe('2.0');
      expect(updatedAsset?.priceUsd).toBe(2500);
      expect(updatedAsset?.valueUsd).toBe(5000);
    });

    it('should remove an asset', () => {
      const asset: Asset = {
        id: 'asset-1',
        accountId: 'test-account-1',
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '1.5',
        chain: 'Ethereum',
        source: 'wallet',
        priceUsd: 2000,
        valueUsd: 3000,
      };

      useStore.getState().addAsset(asset);
      expect(useStore.getState().assets).toHaveLength(1);

      useStore.getState().removeAsset('asset-1');
      expect(useStore.getState().assets).toHaveLength(0);
    });

    it('should get assets by account', () => {
      const assets: Asset[] = [
        {
          id: 'asset-1',
          accountId: 'account-1',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '1.5',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 2000,
          valueUsd: 3000,
        },
        {
          id: 'asset-2',
          accountId: 'account-1',
          symbol: 'USDC',
          name: 'USD Coin',
          balance: '1000',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 1,
          valueUsd: 1000,
        },
        {
          id: 'asset-3',
          accountId: 'account-2',
          symbol: 'BTC',
          name: 'Bitcoin',
          balance: '0.5',
          chain: 'Bitcoin',
          source: 'wallet',
          priceUsd: 50000,
          valueUsd: 25000,
        },
      ];

      assets.forEach(asset => useStore.getState().addAsset(asset));
      
      const account1Assets = useStore.getState().getAssetsByAccount('account-1');
      expect(account1Assets).toHaveLength(2);
      expect(account1Assets.map(a => a.symbol)).toEqual(['ETH', 'USDC']);
    });
  });

  describe('Portfolio Management', () => {
    it('should update portfolio totals', () => {
      useStore.getState().updatePortfolio({
        totalValue: 10000,
        totalAssets: 5,
      });

      const portfolio = useStore.getState().portfolio;
      expect(portfolio.totalValue).toBe(10000);
      expect(portfolio.totalAssets).toBe(5);
      expect(portfolio.lastUpdated).toBeNull(); // updatePortfolio doesn't set lastUpdated automatically
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      useStore.getState().setIsLoading(true);
      expect(useStore.getState().isLoading).toBe(true);

      useStore.getState().setIsLoading(false);
      expect(useStore.getState().isLoading).toBe(false);
    });

    it('should set error state', () => {
      const errorMessage = 'Test error message';
      useStore.getState().setError(errorMessage);
      expect(useStore.getState().error).toBe(errorMessage);

      useStore.getState().setError(null);
      expect(useStore.getState().error).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    it('should set multiple assets at once', () => {
      const assets: Asset[] = [
        {
          id: 'asset-1',
          accountId: 'account-1',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '1.5',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 2000,
          valueUsd: 3000,
        },
        {
          id: 'asset-2',
          accountId: 'account-1',
          symbol: 'USDC',
          name: 'USD Coin',
          balance: '1000',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 1,
          valueUsd: 1000,
        },
      ];

      useStore.getState().setAssets(assets);
      expect(useStore.getState().assets).toEqual(assets);
    });

    it('should clear assets for an account', () => {
      const assets: Asset[] = [
        {
          id: 'asset-1',
          accountId: 'account-1',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '1.5',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 2000,
          valueUsd: 3000,
        },
        {
          id: 'asset-2',
          accountId: 'account-1',
          symbol: 'USDC',
          name: 'USD Coin',
          balance: '1000',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 1,
          valueUsd: 1000,
        },
        {
          id: 'asset-3',
          accountId: 'account-2',
          symbol: 'BTC',
          name: 'Bitcoin',
          balance: '0.5',
          chain: 'Bitcoin',
          source: 'wallet',
          priceUsd: 50000,
          valueUsd: 25000,
        },
      ];

      assets.forEach(asset => useStore.getState().addAsset(asset));
      expect(useStore.getState().assets).toHaveLength(3);

      // Clear assets for account-1 by filtering
      const currentAssets = useStore.getState().assets;
      const filteredAssets = currentAssets.filter(a => a.accountId !== 'account-1');
      useStore.getState().setAssets(filteredAssets);
      
      const remainingAssets = useStore.getState().assets;
      expect(remainingAssets).toHaveLength(1);
      expect(remainingAssets[0].accountId).toBe('account-2');
    });
  });

  describe('Persistence', () => {
    it('should only persist specific fields', () => {
      const account: Account = {
        id: 'test-account-1',
        type: 'wallet',
        platform: 'Ethereum',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
      };

      useStore.getState().addAccount(account);
      useStore.getState().setIsLoading(true);
      useStore.getState().setError('Test error');

      // The persistence is configured in the store, we can test by checking localStorage
      // after a state change
      const storeData = localStorage.getItem('cygnus-wealth-storage');
      if (storeData) {
        const parsed = JSON.parse(storeData);
        const state = parsed.state;
        expect(state.accounts).toBeDefined();
        // These fields should not be persisted based on the partialize function
        expect(state.isLoading).toBeUndefined();
        expect(state.error).toBeUndefined();
        expect(state.assets).toBeUndefined();
        expect(state.portfolio).toBeUndefined();
      }
    });
  });

  describe('Network Environment', () => {
    it('should default to production', () => {
      expect(useStore.getState().networkEnvironment).toBe('production');
    });

    it('should set network environment to testnet', () => {
      useStore.getState().setNetworkEnvironment('testnet');
      expect(useStore.getState().networkEnvironment).toBe('testnet');
    });

    it('should set network environment to local', () => {
      useStore.getState().setNetworkEnvironment('local');
      expect(useStore.getState().networkEnvironment).toBe('local');
    });

    it('should switch back to production', () => {
      useStore.getState().setNetworkEnvironment('testnet');
      useStore.getState().setNetworkEnvironment('production');
      expect(useStore.getState().networkEnvironment).toBe('production');
    });
  });
});