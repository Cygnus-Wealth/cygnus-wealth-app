import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../../store/useStore';
import { useAccountFilter } from '../useAccountFilter';
import type { Account } from '../../store/useStore';

const makeAccount = (overrides: Partial<Account> & { id: string }): Account => ({
  type: 'wallet',
  platform: 'Multi-Chain EVM',
  label: 'Test Wallet',
  status: 'connected',
  ...overrides,
});

const metamaskAccount1 = makeAccount({
  id: 'mm-acc-1',
  label: 'MetaMask Account 1',
  address: '0xaaa1',
  metadata: {
    connectionType: 'MetaMask',
    walletId: 'wallet-metamask-1000',
    walletLabel: 'MetaMask Wallet',
  },
});

const metamaskAccount2 = makeAccount({
  id: 'mm-acc-2',
  label: 'MetaMask Account 2',
  address: '0xaaa2',
  metadata: {
    connectionType: 'MetaMask',
    walletId: 'wallet-metamask-1000',
    walletLabel: 'MetaMask Wallet',
  },
});

const phantomAccount = makeAccount({
  id: 'phantom-acc-1',
  platform: 'Solana',
  label: 'Phantom Account 1',
  address: 'Sol111',
  metadata: {
    connectionType: 'Phantom',
    walletId: 'wallet-phantom-2000',
    walletLabel: 'Phantom Wallet',
  },
});

const slushAccount = makeAccount({
  id: 'slush-acc-1',
  platform: 'SUI',
  label: 'Slush Account 1',
  address: '0xsui1',
  metadata: {
    connectionType: 'Slush',
    walletId: 'wallet-slush-3000',
    walletLabel: 'Slush Wallet',
  },
});

const cexAccount = makeAccount({
  id: 'cex-1',
  type: 'cex',
  platform: 'Kraken',
  label: 'Kraken',
});

describe('useAccountFilter', () => {
  beforeEach(() => {
    useStore.setState({
      accounts: [metamaskAccount1, metamaskAccount2, phantomAccount, slushAccount, cexAccount],
      selectedAccountIds: null,
    });
  });

  describe('initial state', () => {
    it('should default to all accounts selected (null)', () => {
      const { result } = renderHook(() => useAccountFilter());
      expect(result.current.isAllSelected).toBe(true);
    });

    it('should return only wallet accounts grouped by connectionType', () => {
      const { result } = renderHook(() => useAccountFilter());
      const groups = result.current.accountGroups;

      expect(groups).toHaveLength(3);
      const groupNames = groups.map(g => g.connectionType);
      expect(groupNames).toContain('MetaMask');
      expect(groupNames).toContain('Phantom');
      expect(groupNames).toContain('Slush');
    });

    it('should not include CEX accounts in wallet groups', () => {
      const { result } = renderHook(() => useAccountFilter());
      const groups = result.current.accountGroups;
      const allAccounts = groups.flatMap(g => g.accounts);
      expect(allAccounts.find(a => a.id === 'cex-1')).toBeUndefined();
    });

    it('should group MetaMask accounts together', () => {
      const { result } = renderHook(() => useAccountFilter());
      const mmGroup = result.current.accountGroups.find(g => g.connectionType === 'MetaMask');
      expect(mmGroup?.accounts).toHaveLength(2);
    });
  });

  describe('toggleAccount', () => {
    it('should deselect a single account when toggling from all-selected', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });

      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isAccountSelected('mm-acc-1')).toBe(false);
      expect(result.current.isAccountSelected('mm-acc-2')).toBe(true);
      expect(result.current.isAccountSelected('phantom-acc-1')).toBe(true);
    });

    it('should re-select a deselected account', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });
      expect(result.current.isAccountSelected('mm-acc-1')).toBe(false);

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });
      expect(result.current.isAccountSelected('mm-acc-1')).toBe(true);
    });

    it('should return to all-selected (null) when all accounts are toggled back on', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });
      expect(result.current.isAllSelected).toBe(false);

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });
      expect(result.current.isAllSelected).toBe(true);
    });
  });

  describe('selectAll / deselectAll', () => {
    it('should select all accounts', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });
      expect(result.current.isAllSelected).toBe(false);

      act(() => {
        result.current.selectAll();
      });
      expect(result.current.isAllSelected).toBe(true);
    });

    it('should deselect all accounts', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.deselectAll();
      });
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isAccountSelected('mm-acc-1')).toBe(false);
      expect(result.current.isAccountSelected('phantom-acc-1')).toBe(false);
    });
  });

  describe('toggleGroup', () => {
    it('should deselect all accounts in a group when group is fully selected', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.toggleGroup('MetaMask');
      });

      expect(result.current.isAccountSelected('mm-acc-1')).toBe(false);
      expect(result.current.isAccountSelected('mm-acc-2')).toBe(false);
      expect(result.current.isAccountSelected('phantom-acc-1')).toBe(true);
    });

    it('should select all accounts in a group when group is partially selected', () => {
      const { result } = renderHook(() => useAccountFilter());

      // First deselect one MetaMask account
      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });
      expect(result.current.isAccountSelected('mm-acc-1')).toBe(false);
      expect(result.current.isAccountSelected('mm-acc-2')).toBe(true);

      // Toggle group should re-select all
      act(() => {
        result.current.toggleGroup('MetaMask');
      });
      expect(result.current.isAccountSelected('mm-acc-1')).toBe(true);
      expect(result.current.isAccountSelected('mm-acc-2')).toBe(true);
    });

    it('should select all accounts in a group when group is fully deselected', () => {
      const { result } = renderHook(() => useAccountFilter());

      // Deselect both MetaMask accounts
      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });
      act(() => {
        result.current.toggleAccount('mm-acc-2');
      });

      // Toggle group should re-select all
      act(() => {
        result.current.toggleGroup('MetaMask');
      });
      expect(result.current.isAccountSelected('mm-acc-1')).toBe(true);
      expect(result.current.isAccountSelected('mm-acc-2')).toBe(true);
    });
  });

  describe('isGroupSelected / isGroupPartiallySelected', () => {
    it('should report group as fully selected when all accounts selected', () => {
      const { result } = renderHook(() => useAccountFilter());
      expect(result.current.isGroupSelected('MetaMask')).toBe(true);
      expect(result.current.isGroupPartiallySelected('MetaMask')).toBe(false);
    });

    it('should report group as partially selected when some accounts selected', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });

      expect(result.current.isGroupSelected('MetaMask')).toBe(false);
      expect(result.current.isGroupPartiallySelected('MetaMask')).toBe(true);
    });

    it('should report group as not selected when no accounts selected', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });
      act(() => {
        result.current.toggleAccount('mm-acc-2');
      });

      expect(result.current.isGroupSelected('MetaMask')).toBe(false);
      expect(result.current.isGroupPartiallySelected('MetaMask')).toBe(false);
    });
  });

  describe('selectedCount', () => {
    it('should return total wallet account count when all selected', () => {
      const { result } = renderHook(() => useAccountFilter());
      // 4 wallet accounts (excludes CEX)
      expect(result.current.selectedCount).toBe(4);
      expect(result.current.totalWalletCount).toBe(4);
    });

    it('should return correct count when some deselected', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });

      expect(result.current.selectedCount).toBe(3);
    });

    it('should return 0 when all deselected', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.deselectAll();
      });

      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('filteredAssetIds', () => {
    beforeEach(() => {
      useStore.setState({
        assets: [
          {
            id: 'eth-mm1',
            symbol: 'ETH',
            name: 'Ethereum',
            balance: '1.0',
            source: 'MetaMask',
            chain: 'Ethereum',
            accountId: 'mm-acc-1',
            priceUsd: 2000,
            valueUsd: 2000,
          },
          {
            id: 'eth-mm2',
            symbol: 'ETH',
            name: 'Ethereum',
            balance: '2.0',
            source: 'MetaMask',
            chain: 'Ethereum',
            accountId: 'mm-acc-2',
            priceUsd: 2000,
            valueUsd: 4000,
          },
          {
            id: 'sol-phantom',
            symbol: 'SOL',
            name: 'Solana',
            balance: '10',
            source: 'Phantom',
            chain: 'Solana',
            accountId: 'phantom-acc-1',
            priceUsd: 100,
            valueUsd: 1000,
          },
        ],
      });
    });

    it('should return all assets when all accounts selected', () => {
      const { result } = renderHook(() => useAccountFilter());
      expect(result.current.filterAssets(useStore.getState().assets)).toHaveLength(3);
    });

    it('should filter assets to only selected accounts', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.toggleAccount('mm-acc-1');
      });

      const filtered = result.current.filterAssets(useStore.getState().assets);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(a => a.id)).toEqual(['eth-mm2', 'sol-phantom']);
    });

    it('should return no assets when all deselected', () => {
      const { result } = renderHook(() => useAccountFilter());

      act(() => {
        result.current.deselectAll();
      });

      const filtered = result.current.filterAssets(useStore.getState().assets);
      expect(filtered).toHaveLength(0);
    });
  });
});
