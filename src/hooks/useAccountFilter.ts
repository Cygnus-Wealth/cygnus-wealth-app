import { useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import type { Account, Asset } from '../store/useStore';

export interface AccountGroup {
  connectionType: string;
  accounts: Account[];
}

export function useAccountFilter() {
  const accounts = useStore(state => state.accounts);
  const selectedAccountIds = useStore(state => state.selectedAccountIds);
  const setSelectedAccountIds = useStore(state => state.setSelectedAccountIds);
  const toggleAccountSelection = useStore(state => state.toggleAccountSelection);

  const walletAccounts = useMemo(
    () => accounts.filter(a => a.type === 'wallet'),
    [accounts],
  );

  const accountGroups = useMemo(() => {
    const groups = new Map<string, AccountGroup>();

    walletAccounts.forEach(account => {
      const connectionType = account.metadata?.connectionType || 'Unknown';

      if (!groups.has(connectionType)) {
        groups.set(connectionType, { connectionType, accounts: [] });
      }
      groups.get(connectionType)!.accounts.push(account);
    });

    return Array.from(groups.values());
  }, [walletAccounts]);

  const isAllSelected = selectedAccountIds === null;

  const isAccountSelected = useCallback(
    (accountId: string): boolean => {
      if (selectedAccountIds === null) return true;
      return selectedAccountIds.has(accountId);
    },
    [selectedAccountIds],
  );

  const isGroupSelected = useCallback(
    (connectionType: string): boolean => {
      const group = accountGroups.find(g => g.connectionType === connectionType);
      if (!group) return false;
      return group.accounts.every(a => isAccountSelected(a.id));
    },
    [accountGroups, isAccountSelected],
  );

  const isGroupPartiallySelected = useCallback(
    (connectionType: string): boolean => {
      const group = accountGroups.find(g => g.connectionType === connectionType);
      if (!group) return false;
      const selectedInGroup = group.accounts.filter(a => isAccountSelected(a.id));
      return selectedInGroup.length > 0 && selectedInGroup.length < group.accounts.length;
    },
    [accountGroups, isAccountSelected],
  );

  const toggleGroup = useCallback(
    (connectionType: string) => {
      const group = accountGroups.find(g => g.connectionType === connectionType);
      if (!group) return;

      const allGroupSelected = group.accounts.every(a => isAccountSelected(a.id));

      if (allGroupSelected) {
        // Deselect all in group
        if (selectedAccountIds === null) {
          // Currently all selected → create set with all wallet accounts minus this group
          const newSet = new Set(walletAccounts.map(a => a.id));
          group.accounts.forEach(a => newSet.delete(a.id));
          setSelectedAccountIds(newSet);
        } else {
          const newSet = new Set(selectedAccountIds);
          group.accounts.forEach(a => newSet.delete(a.id));
          setSelectedAccountIds(newSet);
        }
      } else {
        // Select all in group
        if (selectedAccountIds === null) return; // Already all selected
        const newSet = new Set(selectedAccountIds);
        group.accounts.forEach(a => newSet.add(a.id));
        // Check if all wallet accounts are now selected
        const allSelected = walletAccounts.every(a => newSet.has(a.id));
        setSelectedAccountIds(allSelected ? null : newSet);
      }
    },
    [accountGroups, isAccountSelected, selectedAccountIds, walletAccounts, setSelectedAccountIds],
  );

  const selectAll = useCallback(() => {
    setSelectedAccountIds(null);
  }, [setSelectedAccountIds]);

  const deselectAll = useCallback(() => {
    setSelectedAccountIds(new Set());
  }, [setSelectedAccountIds]);

  const toggleAccount = useCallback(
    (accountId: string) => {
      toggleAccountSelection(accountId);
    },
    [toggleAccountSelection],
  );

  const selectedCount = useMemo(() => {
    if (selectedAccountIds === null) return walletAccounts.length;
    return walletAccounts.filter(a => selectedAccountIds.has(a.id)).length;
  }, [selectedAccountIds, walletAccounts]);

  const totalWalletCount = walletAccounts.length;

  const filterAssets = useCallback(
    (assets: Asset[]): Asset[] => {
      if (selectedAccountIds === null) return assets;
      return assets.filter(a => selectedAccountIds.has(a.accountId));
    },
    [selectedAccountIds],
  );

  return {
    accountGroups,
    isAllSelected,
    isAccountSelected,
    isGroupSelected,
    isGroupPartiallySelected,
    toggleAccount,
    toggleGroup,
    selectAll,
    deselectAll,
    selectedCount,
    totalWalletCount,
    filterAssets,
  };
}
