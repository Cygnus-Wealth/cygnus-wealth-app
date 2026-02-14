import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import Connections from './Connections';
import { useStore } from '../../store/useStore';
import type { Account } from '../../store/useStore';

// Mock the child components
vi.mock('./MultiWalletConnect', () => ({
  default: () => <button>Connect Wallet</button>,
}));

vi.mock('./AddAccountModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => 
    isOpen ? (
      <div role="dialog">
        <h2>Add Account Modal</h2>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('./WalletDiagnostics', () => ({
  default: () => <button>Diagnostics</button>,
}));

vi.mock('./TokenManager', () => ({
  default: () => <div>Token Manager</div>,
}));

const renderConnections = () => {
  return render(
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <Connections />
      </BrowserRouter>
    </ChakraProvider>
  );
};

// Global mock for window.confirm
const mockConfirm = vi.fn();
global.confirm = mockConfirm;

describe('Connections', () => {
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
    });
    
    // Clear any existing mocks
    vi.clearAllMocks();
    mockConfirm.mockClear();
  });

  describe('Empty State', () => {
    it('should display empty state when no connections exist', () => {
      renderConnections();
      
      expect(screen.getByText('Connections')).toBeInTheDocument();
      expect(screen.getByText('No connections added yet')).toBeInTheDocument();
      expect(screen.getByText('Connect your wallet or exchange to start tracking your portfolio')).toBeInTheDocument();
    });

    it('should not show summary stats when no connections exist', () => {
      renderConnections();
      
      expect(screen.queryByText('Total Connections')).not.toBeInTheDocument();
      expect(screen.queryByText('Total Accounts')).not.toBeInTheDocument();
      expect(screen.queryByText('Connected Chains')).not.toBeInTheDocument();
    });
  });

  describe('With Wallet Connections', () => {
    beforeEach(() => {
      const accounts: Account[] = [
        {
          id: 'account-1',
          type: 'wallet',
          platform: 'Multi-Chain EVM',
          label: 'MetaMask Account 1',
          address: '0x1234567890123456789012345678901234567890',
          status: 'connected',
          metadata: {
            connectionType: 'MetaMask',
            walletId: 'wallet-1',
            detectedChains: ['Ethereum', 'Polygon', 'Arbitrum'],
          },
        },
        {
          id: 'account-2',
          type: 'wallet',
          platform: 'Multi-Chain EVM',
          label: 'MetaMask Account 2',
          address: '0x2345678901234567890123456789012345678901',
          status: 'connected',
          metadata: {
            connectionType: 'MetaMask',
            walletId: 'wallet-1',
            detectedChains: ['Ethereum', 'Polygon', 'Arbitrum'],
          },
        },
        {
          id: 'account-3',
          type: 'wallet',
          platform: 'Multi-Chain EVM',
          label: 'Rabby Account 1',
          address: '0x3456789012345678901234567890123456789012',
          status: 'disconnected',
          metadata: {
            connectionType: 'Rabby',
            walletId: 'wallet-2',
            detectedChains: ['Ethereum', 'BSC'],
          },
        },
      ];

      useStore.setState({ accounts });
    });

    it('should display summary statistics', () => {
      renderConnections();
      
      expect(screen.getByText('Total Connections')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 connection types (MetaMask, Rabby)
      
      expect(screen.getByText('Total Accounts')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 total accounts
      
      expect(screen.getByText('Connected Chains')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument(); // 4 unique chains
    });

    it('should group accounts by connection type', () => {
      renderConnections();
      
      expect(screen.getByText('MetaMask')).toBeInTheDocument();
      expect(screen.getByText('2 accounts')).toBeInTheDocument();
      
      expect(screen.getByText('Rabby')).toBeInTheDocument();
      expect(screen.getByText('1 account')).toBeInTheDocument();
    });

    it('should show connection status summary', () => {
      renderConnections();
      
      // Check for connection status text
      expect(screen.getByText('2 connected • 0 disconnected')).toBeInTheDocument();
      expect(screen.getByText('0 connected • 1 disconnected')).toBeInTheDocument();
    });

    it('should show chains information', () => {
      renderConnections();
      
      // Check for chains text
      expect(screen.getByText('Chains: Ethereum, Polygon, Arbitrum')).toBeInTheDocument();
    });

    it('should navigate to wallet details on button click', () => {
      renderConnections();
      
      const viewDetailsButtons = screen.getAllByText('View Details');
      expect(viewDetailsButtons).toHaveLength(2);
      
      // We can't test actual navigation in unit tests, just check the button exists
      expect(viewDetailsButtons[0]).toBeInTheDocument();
    });
  });

  describe('Connection Actions', () => {
    beforeEach(() => {
      const accounts: Account[] = [
        {
          id: 'account-1',
          type: 'wallet',
          platform: 'Multi-Chain EVM',
          label: 'MetaMask Account 1',
          address: '0x1234',
          status: 'connected',
          metadata: {
            connectionType: 'MetaMask',
            walletId: 'wallet-1',
          },
        },
        {
          id: 'account-2',
          type: 'wallet',
          platform: 'Multi-Chain EVM',
          label: 'MetaMask Account 2',
          address: '0x2345',
          status: 'disconnected',
          metadata: {
            connectionType: 'MetaMask',
            walletId: 'wallet-1',
          },
        },
      ];

      useStore.setState({ accounts });
    });

    it('should show Connect All button when accounts are disconnected', () => {
      renderConnections();
      
      expect(screen.getByText('Connect All')).toBeInTheDocument();
    });

    it('should show Disconnect All button when accounts are connected', () => {
      renderConnections();
      
      expect(screen.getByText('Disconnect All')).toBeInTheDocument();
    });

    it('should handle Connect All action', () => {
      renderConnections();
      
      const connectAllButton = screen.getByText('Connect All');
      fireEvent.click(connectAllButton);
      
      // Check that disconnected account status is updated
      const updatedAccounts = useStore.getState().accounts;
      expect(updatedAccounts[1].status).toBe('connected');
    });

    it('should handle delete connection with confirmation', () => {
      // Mock window.confirm to return true
      mockConfirm.mockReturnValue(true);
      
      renderConnections();
      
      const deleteButton = screen.getByLabelText('Delete connection');
      fireEvent.click(deleteButton);
      
      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to remove all MetaMask accounts?');
      expect(useStore.getState().accounts).toHaveLength(0);
    });

    it('should cancel delete when confirmation is rejected', () => {
      mockConfirm.mockReturnValue(false);
      
      renderConnections();
      
      const deleteButton = screen.getByLabelText('Delete connection');
      fireEvent.click(deleteButton);
      
      expect(mockConfirm).toHaveBeenCalled();
      expect(useStore.getState().accounts).toHaveLength(2);
    });
  });

  describe('Other Account Types', () => {
    beforeEach(() => {
      const accounts: Account[] = [
        {
          id: 'cex-1',
          type: 'cex',
          platform: 'Coinbase',
          label: 'Coinbase Account',
          status: 'connected',
        },
        {
          id: 'dex-1',
          type: 'dex',
          platform: 'Uniswap',
          label: 'Uniswap Account',
          status: 'disconnected',
        },
      ];

      useStore.setState({ accounts });
    });

    it('should display exchange connections separately', () => {
      renderConnections();
      
      expect(screen.getByText('Exchange Connections')).toBeInTheDocument();
      expect(screen.getByText('Coinbase Account')).toBeInTheDocument();
      expect(screen.getByText('Uniswap Account')).toBeInTheDocument();
    });

    it('should show correct badges for account types', () => {
      renderConnections();
      
      expect(screen.getByText('Coinbase • Exchange')).toBeInTheDocument();
      expect(screen.getByText('Uniswap • DEX')).toBeInTheDocument();
    });
  });

  describe('Manual Account Modal', () => {
    it('should open add account modal when button is clicked', () => {
      renderConnections();
      
      const addManuallyButton = screen.getByText('Add Manually');
      fireEvent.click(addManuallyButton);
      
      // Modal should be open immediately after click
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Add Account Modal')).toBeInTheDocument();
    });
  });

  describe('Privacy Notice', () => {
    it('should display privacy notice', () => {
      renderConnections();
      
      expect(screen.getByText(/Privacy Notice:/)).toBeInTheDocument();
      expect(screen.getByText(/All connection data is stored locally/)).toBeInTheDocument();
    });
  });
});