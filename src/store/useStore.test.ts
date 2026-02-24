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
    it('should persist accounts, assets, prices, portfolio and environment', () => {
      const account: Account = {
        id: 'test-account-1',
        type: 'wallet',
        platform: 'Ethereum',
        label: 'Test Wallet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'connected',
      };

      useStore.getState().addAccount(account);
      useStore.getState().addAsset({
        id: 'asset-1',
        accountId: 'test-account-1',
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '1.5',
        chain: 'Ethereum',
        source: 'wallet',
        priceUsd: 2000,
        valueUsd: 3000,
      });
      useStore.getState().updatePrice('ETH', 2000);
      useStore.getState().setIsLoading(true);
      useStore.getState().setError('Test error');

      const storeData = localStorage.getItem('cygnus-wealth-storage');
      if (storeData) {
        const parsed = JSON.parse(storeData);
        const state = parsed.state;
        expect(state.accounts).toBeDefined();
        expect(state.assets).toBeDefined();
        expect(state.prices).toBeDefined();
        expect(state.portfolio).toBeDefined();
        expect(state.networkEnvironment).toBeDefined();
        // Transient UI state should not be persisted
        expect(state.isLoading).toBeUndefined();
        expect(state.error).toBeUndefined();
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

  describe('Account Selection/Filtering', () => {
    it('should default selectedAccountIds to null (all selected)', () => {
      expect(useStore.getState().selectedAccountIds).toBeNull();
    });

    it('should set selectedAccountIds', () => {
      const ids = new Set(['acc-1', 'acc-2']);
      useStore.getState().setSelectedAccountIds(ids);
      expect(useStore.getState().selectedAccountIds).toEqual(ids);
    });

    it('should clear selectedAccountIds back to null', () => {
      useStore.getState().setSelectedAccountIds(new Set(['acc-1']));
      useStore.getState().setSelectedAccountIds(null);
      expect(useStore.getState().selectedAccountIds).toBeNull();
    });

    it('should toggle account selection from all-selected state', () => {
      // Add some accounts first
      useStore.getState().addAccount({
        id: 'acc-1',
        type: 'wallet',
        platform: 'Ethereum',
        label: 'Wallet 1',
        status: 'connected',
      });
      useStore.getState().addAccount({
        id: 'acc-2',
        type: 'wallet',
        platform: 'Solana',
        label: 'Wallet 2',
        status: 'connected',
      });

      useStore.getState().toggleAccountSelection('acc-1');
      const selected = useStore.getState().selectedAccountIds;
      // Should have acc-2 selected but not acc-1
      expect(selected).not.toBeNull();
      expect(selected?.has('acc-1')).toBe(false);
      expect(selected?.has('acc-2')).toBe(true);
    });

    it('should toggle account selection back on', () => {
      useStore.getState().addAccount({
        id: 'acc-1',
        type: 'wallet',
        platform: 'Ethereum',
        label: 'Wallet 1',
        status: 'connected',
      });
      useStore.getState().addAccount({
        id: 'acc-2',
        type: 'wallet',
        platform: 'Solana',
        label: 'Wallet 2',
        status: 'connected',
      });

      // Deselect acc-1
      useStore.getState().toggleAccountSelection('acc-1');
      expect(useStore.getState().selectedAccountIds?.has('acc-1')).toBe(false);

      // Re-select acc-1 (all now selected, should return to null)
      useStore.getState().toggleAccountSelection('acc-1');
      expect(useStore.getState().selectedAccountIds).toBeNull();
    });

    it('should persist selectedAccountIds', () => {
      useStore.getState().setSelectedAccountIds(new Set(['acc-1']));
      const storeData = localStorage.getItem('cygnus-wealth-storage');
      if (storeData) {
        const parsed = JSON.parse(storeData);
        // selectedAccountIds should be persisted as an array
        expect(parsed.state.selectedAccountIds).toBeDefined();
      }
    });
  });
});