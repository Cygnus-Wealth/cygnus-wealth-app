import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import Dashboard from './Dashboard';
import { useStore } from '../store/useStore';
import type { Account, Asset } from '../store/useStore';
import type { Chain } from '@cygnus-wealth/data-models';

// Mock the useAccountSync hook
vi.mock('../hooks/useAccountSync', () => ({
  useAccountSync: vi.fn(),
}));

// Mock the DeFi position service (needed by useDeFiPositions hook)
vi.mock('../domain/defi/DeFiPositionService', () => ({
  getDeFiPositions: vi.fn(() => []),
}));

const renderDashboard = () => {
  return render(
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    </ChakraProvider>
  );
};

describe('Dashboard', () => {
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
      defiPositions: [],
      isLoadingDeFi: false,
      defiError: null,
      isLoading: false,
      error: null,
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no accounts are connected', () => {
      renderDashboard();

      expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument();
      expect(screen.getByText('No assets to display')).toBeInTheDocument();
      expect(screen.getByText('Add accounts to start tracking your portfolio')).toBeInTheDocument();
      expect(screen.getByText('Go to Settings → Connections')).toBeInTheDocument();
    });

    it('should show zero values in portfolio summary', () => {
      renderDashboard();

      // Total portfolio value and DeFi value both show $0.00
      const zeroValues = screen.getAllByText('$0.00');
      expect(zeroValues.length).toBeGreaterThanOrEqual(2);
      // Total assets and connected accounts show 0
      expect(screen.getAllByText('0')).toHaveLength(2);
    });
  });

  describe('With Connected Accounts', () => {
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
            detectedChains: ['Ethereum', 'Polygon'],
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
            detectedChains: ['Ethereum', 'Polygon'],
          },
        },
      ];

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
          accountId: 'account-2',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '0.5',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 2000,
          valueUsd: 1000,
        },
        {
          id: 'asset-3',
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

      useStore.setState({
        accounts,
        assets,
        portfolio: {
          totalValue: 5000,
          totalAssets: 3,
          lastUpdated: new Date().toISOString(),
        },
      });
    });

    it('should display portfolio summary correctly', () => {
      renderDashboard();

      expect(screen.getByText('$5000.00')).toBeInTheDocument(); // Total value
      expect(screen.getByText('3')).toBeInTheDocument(); // Total assets
      // Use getAllByText to handle multiple "2" texts and check for connected accounts
      const twoTexts = screen.getAllByText('2');
      expect(twoTexts.length).toBeGreaterThan(0); // Connected accounts
    });

    it('should aggregate assets by symbol and connection', () => {
      renderDashboard();

      // Check for aggregated ETH
      expect(screen.getByText('ETH')).toBeInTheDocument();
      // Use getAllByText since "2" appears multiple times
      const twoTexts = screen.getAllByText('2');
      expect(twoTexts.length).toBeGreaterThan(0); // Balance (1.5 + 0.5)
      expect(screen.getByText('MetaMask (2 accounts)')).toBeInTheDocument();

      // Check for USDC - balance is formatted with .toFixed(4)
      expect(screen.getByText('USDC')).toBeInTheDocument();
      expect(screen.getByText('1000.0000')).toBeInTheDocument();
    });

    it('should display asset details correctly', () => {
      renderDashboard();

      // Check ETH row
      const ethRow = screen.getByText('ETH').closest('tr');
      expect(ethRow).toHaveTextContent('$2000.00'); // Price
      expect(ethRow).toHaveTextContent('$4000.00'); // Total value

      // Check USDC row
      const usdcRow = screen.getByText('USDC').closest('tr');
      expect(usdcRow).toHaveTextContent('$1.00'); // Price
      expect(usdcRow).toHaveTextContent('$1000.00'); // Value
    });

    it('should display chain badges', () => {
      renderDashboard();

      const chainBadges = screen.getAllByText('Ethereum');
      expect(chainBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Token Filtering', () => {
    beforeEach(() => {
      useStore.setState({
        accounts: [{
          id: 'account-1',
          type: 'wallet',
          platform: 'Ethereum',
          label: 'Test Wallet',
          address: '0x1234',
          status: 'connected',
        }],
      });
    });

    it('should hide zero balance assets by default', () => {
      useStore.setState({
        assets: [
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
            balance: '0',
            chain: 'Ethereum',
            source: 'wallet',
            priceUsd: 1,
            valueUsd: 0,
          },
        ],
      });

      renderDashboard();

      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.queryByText('USDC')).not.toBeInTheDocument();
    });

    it('should hide unpriced tokens (priceUsd=0) by default', () => {
      useStore.setState({
        assets: [
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
            id: 'asset-spam',
            accountId: 'account-1',
            symbol: 'SPAM',
            name: 'SpamToken',
            balance: '0',
            chain: 'Ethereum',
            source: 'wallet',
            priceUsd: 0,
            valueUsd: 0,
          },
        ],
      });

      renderDashboard();

      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.queryByText('SPAM')).not.toBeInTheDocument();
    });

    it('should show unpriced tokens with positive balance', () => {
      useStore.setState({
        assets: [
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
            id: 'asset-null',
            accountId: 'account-1',
            symbol: 'NULLPRICE',
            name: 'NullPriceToken',
            balance: '100',
            chain: 'Ethereum',
            source: 'wallet',
            priceUsd: null,
            valueUsd: null,
          },
        ],
      });

      renderDashboard();

      expect(screen.getByText('ETH')).toBeInTheDocument();
      // Unpriced tokens with positive balance should now be visible
      expect(screen.getByText('NULLPRICE')).toBeInTheDocument();
    });

    it('should hide spam-named tokens by default', () => {
      useStore.setState({
        assets: [
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
            id: 'asset-scam',
            accountId: 'account-1',
            symbol: 'SCAM',
            name: 'Visit ethgift.org to claim',
            balance: '10000',
            chain: 'Ethereum',
            source: 'wallet',
            priceUsd: 1,
            valueUsd: 10000,
          },
        ],
      });

      renderDashboard();

      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.queryByText('SCAM')).not.toBeInTheDocument();
    });

    it('should show hidden token count', () => {
      useStore.setState({
        assets: [
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
            id: 'asset-spam1',
            accountId: 'account-1',
            symbol: 'SPAM1',
            name: 'Visit scam1.com',
            balance: '100',
            chain: 'Ethereum',
            source: 'wallet',
            priceUsd: 0,
            valueUsd: 0,
          },
          {
            id: 'asset-spam2',
            accountId: 'account-1',
            symbol: 'SPAM2',
            name: 'Claim your free airdrop',
            balance: '200',
            chain: 'Ethereum',
            source: 'wallet',
            priceUsd: 0,
            valueUsd: 0,
          },
        ],
      });

      renderDashboard();

      // The toggle label should show hidden count
      expect(screen.getByText(/2 hidden/)).toBeInTheDocument();
    });

    it('should show all tokens when toggle is checked', async () => {
      useStore.setState({
        assets: [
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
            id: 'asset-spam',
            accountId: 'account-1',
            symbol: 'SPAM',
            name: 'Visit scamsite.com',
            balance: '999999',
            chain: 'Ethereum',
            source: 'wallet',
            priceUsd: 0,
            valueUsd: 0,
          },
        ],
      });

      renderDashboard();

      // Spam-named token should be hidden initially
      expect(screen.queryByText('SPAM')).not.toBeInTheDocument();

      // Toggle to show all
      const checkbox = screen.getByRole('checkbox');
      await act(async () => {
        checkbox.click();
      });

      // Now SPAM should be visible
      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.getByText('SPAM')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render assets that are still loading prices', () => {
      const assets: Asset[] = [
        {
          id: 'asset-1',
          accountId: 'account-1',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '0.1',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 2000,
          valueUsd: 200,
        },
      ];

      useStore.setState({
        accounts: [{
          id: 'account-1',
          type: 'wallet',
          platform: 'Ethereum',
          label: 'Test Wallet',
          address: '0x1234',
          status: 'connected',
        }],
        assets,
      });

      renderDashboard();

      expect(screen.getByText('Assets')).toBeInTheDocument();
      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.getByText('0.1000')).toBeInTheDocument();
    });

    it('should show skeleton rows when loading with no assets', () => {
      useStore.setState({
        accounts: [{
          id: 'account-1',
          type: 'wallet',
          platform: 'Ethereum',
          label: 'Test Wallet',
          address: '0x1234',
          status: 'connected',
        }],
        assets: [],
        isLoading: true,
      });

      renderDashboard();

      // Should NOT show the empty state message
      expect(screen.queryByText('No assets to display')).not.toBeInTheDocument();
      // Should show the assets header
      expect(screen.getByText('Assets')).toBeInTheDocument();
    });

    it('should show refreshing indicator when loading with cached assets', () => {
      useStore.setState({
        accounts: [{
          id: 'account-1',
          type: 'wallet',
          platform: 'Ethereum',
          label: 'Test Wallet',
          address: '0x1234',
          status: 'connected',
        }],
        assets: [{
          id: 'asset-1',
          accountId: 'account-1',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '1.5',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 2000,
          valueUsd: 3000,
        }],
        isLoading: true,
      });

      renderDashboard();

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });

    it('should show last updated time when not loading', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      useStore.setState({
        accounts: [{
          id: 'account-1',
          type: 'wallet',
          platform: 'Ethereum',
          label: 'Test Wallet',
          address: '0x1234',
          status: 'connected',
        }],
        assets: [{
          id: 'asset-1',
          accountId: 'account-1',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '1.5',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 2000,
          valueUsd: 3000,
        }],
        portfolio: {
          totalValue: 3000,
          totalAssets: 1,
          lastUpdated: fiveMinutesAgo,
        },
        isLoading: false,
      });

      renderDashboard();

      expect(screen.getByText('Updated 5m ago')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should have correct links to connections page', () => {
      renderDashboard();

      const manageLink = screen.getByText('Add accounts');
      expect(manageLink.closest('a')).toHaveAttribute('href', '/settings/connections');
    });

    it('should show manage link when accounts exist', () => {
      useStore.setState({
        accounts: [{
          id: 'account-1',
          type: 'wallet',
          platform: 'Ethereum',
          label: 'Test Wallet',
          address: '0x1234',
          status: 'connected',
        }],
      });

      renderDashboard();

      const manageLink = screen.getByText('Manage');
      expect(manageLink.closest('a')).toHaveAttribute('href', '/settings/connections');
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      // Create 15 assets to test pagination - all with valid prices to pass spam filter
      const assets: Asset[] = Array.from({ length: 15 }, (_, i) => ({
        id: `asset-${i}`,
        accountId: 'account-1',
        symbol: `TOKEN${i}`,
        name: `Token ${i}`,
        balance: '100',
        chain: 'Ethereum',
        source: 'wallet',
        priceUsd: 1,
        valueUsd: 100,
      }));

      useStore.setState({
        accounts: [{
          id: 'account-1',
          type: 'wallet',
          platform: 'Ethereum',
          label: 'Test Wallet',
          address: '0x1234',
          status: 'connected',
        }],
        assets,
      });
    });

    it('should show pagination controls when more than 10 items', () => {
      renderDashboard();

      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(screen.getByText('Showing 1-10 of 15 assets')).toBeInTheDocument();
    });

    it('should navigate between pages', async () => {
      renderDashboard();

      // Should show first 10 items
      expect(screen.getByText('TOKEN0')).toBeInTheDocument();
      expect(screen.queryByText('TOKEN10')).not.toBeInTheDocument();

      // Click next page
      const nextButton = screen.getByLabelText('Next page');

      await act(async () => {
        nextButton.click();
      });

      // Check the results synchronously
      expect(screen.queryByText('TOKEN0')).not.toBeInTheDocument();
      expect(screen.getByText('TOKEN10')).toBeInTheDocument();
    });
  });

  describe('DeFi Positions Section', () => {
    it('should render DeFi Positions section', () => {
      renderDashboard();
      expect(screen.getByText('DeFi Positions')).toBeInTheDocument();
    });

    it('should show empty state when no DeFi positions', () => {
      renderDashboard();
      expect(screen.getByText('No DeFi positions found')).toBeInTheDocument();
    });

    it('should display DeFi Value stat in portfolio summary', () => {
      renderDashboard();
      expect(screen.getByText('DeFi Value')).toBeInTheDocument();
      expect(screen.getByText('0 positions')).toBeInTheDocument();
    });

    it('should include DeFi value in total portfolio value', () => {
      useStore.setState({
        portfolio: {
          totalValue: 5000,
          totalAssets: 2,
          lastUpdated: null,
        },
        defiPositions: [
          {
            id: 'defi-1',
            protocol: 'Lido',
            positionType: 'staking',
            label: 'ETH Staking',
            chain: 'ETHEREUM' as Chain,
            underlyingAssets: [{ symbol: 'ETH', name: 'Ethereum', amount: '10' }],
            valueUsd: 20000,
            apy: 4.2,
            discoverySource: 'on-chain',
          },
        ],
      });

      renderDashboard();

      // Total should be 5000 + 20000 = 25000
      expect(screen.getByText('$25000.00')).toBeInTheDocument();
      // DeFi value stat
      expect(screen.getByText('$20000.00')).toBeInTheDocument();
      expect(screen.getByText('1 positions')).toBeInTheDocument();
    });

    it('should display DeFi positions when present in store', () => {
      useStore.setState({
        defiPositions: [
          {
            id: 'defi-1',
            protocol: 'Uniswap V3',
            positionType: 'lp',
            label: 'ETH/USDC',
            chain: 'ETHEREUM' as Chain,
            underlyingAssets: [
              { symbol: 'ETH', name: 'Ethereum', amount: '5' },
              { symbol: 'USDC', name: 'USD Coin', amount: '10000' },
            ],
            valueUsd: 20000,
            discoverySource: 'subgraph',
          },
        ],
      });

      renderDashboard();

      expect(screen.getByText('Uniswap V3')).toBeInTheDocument();
      expect(screen.getByText('ETH/USDC')).toBeInTheDocument();
    });
  });
});
