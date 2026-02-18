import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { DeFiPositions } from '../DeFiPositions';
import type { DeFiPosition } from '../../../domain/defi/DeFiPosition';
import type { Chain } from '@cygnus-wealth/data-models';

const mockPositions: DeFiPosition[] = [
  {
    id: 'lp-1',
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
  {
    id: 'stk-1',
    protocol: 'Lido',
    positionType: 'staking',
    label: 'ETH Staking',
    chain: 'ETHEREUM' as Chain,
    underlyingAssets: [{ symbol: 'ETH', name: 'Ethereum', amount: '32' }],
    valueUsd: 64000,
    apy: 4.2,
    discoverySource: 'on-chain',
  },
  {
    id: 'lnd-1',
    protocol: 'Aave V3',
    positionType: 'lending',
    label: 'USDC SUPPLY',
    chain: 'ARBITRUM' as Chain,
    underlyingAssets: [{ symbol: 'USDC', name: 'USD Coin', amount: '50000' }],
    valueUsd: 50000,
    apy: 3.5,
    discoverySource: 'subgraph',
  },
  {
    id: 'vlt-1',
    protocol: 'Yearn V3',
    positionType: 'vault',
    label: 'USDC yVault',
    chain: 'ETHEREUM' as Chain,
    underlyingAssets: [{ symbol: 'USDC', name: 'USD Coin', amount: '10000' }],
    valueUsd: 10000,
    apy: 8.5,
    discoverySource: 'on-chain',
  },
];

const renderComponent = (props: {
  positions: DeFiPosition[];
  isLoading?: boolean;
}) => {
  return render(
    <ChakraProvider value={defaultSystem}>
      <DeFiPositions
        positions={props.positions}
        isLoading={props.isLoading ?? false}
      />
    </ChakraProvider>
  );
};

describe('DeFiPositions', () => {
  describe('Empty State', () => {
    it('should show empty state when no positions exist', () => {
      renderComponent({ positions: [] });
      expect(screen.getByText('No DeFi positions found')).toBeInTheDocument();
    });

    it('should show loading skeletons when loading', () => {
      renderComponent({ positions: [], isLoading: true });
      expect(screen.queryByText('No DeFi positions found')).not.toBeInTheDocument();
    });
  });

  describe('Position Display', () => {
    it('should display all positions', () => {
      renderComponent({ positions: mockPositions });

      expect(screen.getByText('Uniswap V3')).toBeInTheDocument();
      expect(screen.getByText('Lido')).toBeInTheDocument();
      expect(screen.getByText('Aave V3')).toBeInTheDocument();
      expect(screen.getByText('Yearn V3')).toBeInTheDocument();
    });

    it('should display position types', () => {
      renderComponent({ positions: mockPositions });

      expect(screen.getByText('LP')).toBeInTheDocument();
      expect(screen.getByText('Staking')).toBeInTheDocument();
      expect(screen.getByText('Lending')).toBeInTheDocument();
      expect(screen.getByText('Vault')).toBeInTheDocument();
    });

    it('should display position labels', () => {
      renderComponent({ positions: mockPositions });

      expect(screen.getByText('ETH/USDC')).toBeInTheDocument();
      expect(screen.getByText('ETH Staking')).toBeInTheDocument();
      expect(screen.getByText('USDC SUPPLY')).toBeInTheDocument();
      expect(screen.getByText('USDC yVault')).toBeInTheDocument();
    });

    it('should display underlying asset symbols', () => {
      renderComponent({ positions: mockPositions });

      // ETH/USDC LP has "ETH, USDC" as underlying
      expect(screen.getByText('ETH, USDC')).toBeInTheDocument();
    });

    it('should display chain badges', () => {
      renderComponent({ positions: mockPositions });

      const ethereumBadges = screen.getAllByText('ETHEREUM');
      expect(ethereumBadges.length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText('ARBITRUM')).toBeInTheDocument();
    });

    it('should display USD values', () => {
      renderComponent({ positions: mockPositions });

      expect(screen.getByText('$20,000.00')).toBeInTheDocument();
      expect(screen.getByText('$64,000.00')).toBeInTheDocument();
      expect(screen.getByText('$50,000.00')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    });

    it('should display APY when available', () => {
      renderComponent({ positions: mockPositions });

      expect(screen.getByText('4.20%')).toBeInTheDocument();
      expect(screen.getByText('3.50%')).toBeInTheDocument();
      expect(screen.getByText('8.50%')).toBeInTheDocument();
    });

    it('should display discovery source', () => {
      renderComponent({ positions: mockPositions });

      const subgraphBadges = screen.getAllByText('subgraph');
      expect(subgraphBadges.length).toBeGreaterThanOrEqual(1);
      const onChainBadges = screen.getAllByText('on-chain');
      expect(onChainBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Grouping', () => {
    it('should group by protocol by default', () => {
      renderComponent({ positions: mockPositions });

      // The section header "DeFi Positions" should be present
      expect(screen.getByText('DeFi Positions')).toBeInTheDocument();
    });

    it('should toggle between group-by-protocol and group-by-chain', async () => {
      renderComponent({ positions: mockPositions });

      // Find the chain toggle button
      const chainButton = screen.getByRole('button', { name: /chain/i });

      await act(async () => {
        chainButton.click();
      });

      // After clicking chain, the grouping context should change
      // Protocol button should exist for toggling back
      expect(screen.getByRole('button', { name: /protocol/i })).toBeInTheDocument();
    });
  });
});
