import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../../store/useStore';
import { AccountFilter } from '../AccountFilter';
import type { Account } from '../../../store/useStore';

const makeAccount = (overrides: Partial<Account> & { id: string }): Account => ({
  type: 'wallet',
  platform: 'Multi-Chain EVM',
  label: 'Test Wallet',
  status: 'connected',
  ...overrides,
});

const accounts: Account[] = [
  makeAccount({
    id: 'mm-1',
    label: 'MetaMask Account 1',
    address: '0xaaa1',
    metadata: {
      connectionType: 'MetaMask',
      walletId: 'wallet-metamask-1000',
      walletLabel: 'MetaMask Wallet',
    },
  }),
  makeAccount({
    id: 'mm-2',
    label: 'MetaMask Account 2',
    address: '0xaaa2',
    metadata: {
      connectionType: 'MetaMask',
      walletId: 'wallet-metamask-1000',
      walletLabel: 'MetaMask Wallet',
    },
  }),
  makeAccount({
    id: 'phantom-1',
    platform: 'Solana',
    label: 'Phantom Account 1',
    address: 'Sol111',
    metadata: {
      connectionType: 'Phantom',
      walletId: 'wallet-phantom-2000',
      walletLabel: 'Phantom Wallet',
    },
  }),
];

describe('AccountFilter', () => {
  beforeEach(() => {
    useStore.setState({
      accounts,
      selectedAccountIds: null,
    });
  });

  it('should render wallet provider group headers', () => {
    render(<AccountFilter />);
    expect(screen.getByText('MetaMask')).toBeTruthy();
    expect(screen.getByText('Phantom')).toBeTruthy();
  });

  it('should show account count summary', () => {
    render(<AccountFilter />);
    expect(screen.getByText(/3 of 3/)).toBeTruthy();
  });

  it('should show individual account labels', () => {
    render(<AccountFilter />);
    expect(screen.getByText('MetaMask Account 1')).toBeTruthy();
    expect(screen.getByText('MetaMask Account 2')).toBeTruthy();
    expect(screen.getByText('Phantom Account 1')).toBeTruthy();
  });

  it('should show truncated addresses', () => {
    render(<AccountFilter />);
    // 0xaaa1 should show as 0xaaa1 (short enough to not truncate) or truncated
    expect(screen.getByText(/0xaaa1/)).toBeTruthy();
  });

  it('should toggle individual account when clicked', () => {
    render(<AccountFilter />);

    const account1Label = screen.getByText('MetaMask Account 1');
    // Click the account label row to toggle
    fireEvent.click(account1Label.closest('[data-testid="account-toggle-mm-1"]')!);

    // After toggling, store should have selectedAccountIds set
    const state = useStore.getState();
    expect(state.selectedAccountIds).not.toBeNull();
    expect(state.selectedAccountIds?.has('mm-1')).toBe(false);
  });

  it('should show "All" button that selects all accounts', () => {
    // First deselect one
    useStore.setState({
      selectedAccountIds: new Set(['mm-2', 'phantom-1']),
    });

    render(<AccountFilter />);

    const allButton = screen.getByTestId('select-all-accounts');
    fireEvent.click(allButton);

    expect(useStore.getState().selectedAccountIds).toBeNull();
  });

  it('should update selected count when accounts are toggled', () => {
    useStore.setState({
      selectedAccountIds: new Set(['mm-1', 'phantom-1']),
    });

    render(<AccountFilter />);
    expect(screen.getByText(/2 of 3/)).toBeTruthy();
  });

  it('should not render when there are no wallet accounts', () => {
    useStore.setState({
      accounts: [
        makeAccount({
          id: 'cex-1',
          type: 'cex',
          platform: 'Kraken',
          label: 'Kraken',
        }),
      ],
    });

    const { container } = render(<AccountFilter />);
    expect(container.firstChild).toBeNull();
  });

  it('should toggle entire group when group header is clicked', () => {
    render(<AccountFilter />);

    const groupToggle = screen.getByTestId('group-toggle-MetaMask');
    fireEvent.click(groupToggle);

    const state = useStore.getState();
    // MetaMask accounts should be deselected
    expect(state.selectedAccountIds?.has('mm-1')).toBe(false);
    expect(state.selectedAccountIds?.has('mm-2')).toBe(false);
    // Phantom should still be selected
    expect(state.selectedAccountIds?.has('phantom-1')).toBe(true);
  });
});
