import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeFiPositions } from './useDeFiPositions';
import { useStore } from '../store/useStore';
import type { DeFiPosition } from '../domain/defi/DeFiPosition';
import type { Chain } from '@cygnus-wealth/data-models';

vi.mock('../domain/defi/DeFiPositionService', () => ({
  getDeFiPositions: vi.fn(() => []),
}));

import { getDeFiPositions } from '../domain/defi/DeFiPositionService';

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
];

describe('useDeFiPositions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      accounts: [],
      defiPositions: [],
      isLoadingDeFi: false,
      defiError: null,
    });
  });

  it('should not fetch when no accounts are connected', () => {
    renderHook(() => useDeFiPositions());
    expect(getDeFiPositions).not.toHaveBeenCalled();
  });

  it('should fetch DeFi positions when connected accounts exist', () => {
    vi.mocked(getDeFiPositions).mockReturnValue(mockPositions);

    useStore.setState({
      accounts: [
        {
          id: 'acc-1',
          type: 'wallet',
          platform: 'Multi-Chain EVM',
          label: 'MetaMask',
          address: '0x123',
          status: 'connected',
        },
      ],
    });

    renderHook(() => useDeFiPositions());

    const state = useStore.getState();
    expect(state.defiPositions).toHaveLength(2);
    expect(state.defiPositions[0].protocol).toBe('Uniswap V3');
  });

  it('should compute total DeFi value', () => {
    vi.mocked(getDeFiPositions).mockReturnValue(mockPositions);

    useStore.setState({
      accounts: [
        {
          id: 'acc-1',
          type: 'wallet',
          platform: 'Ethereum',
          label: 'Test',
          address: '0x123',
          status: 'connected',
        },
      ],
    });

    const { result } = renderHook(() => useDeFiPositions());

    expect(result.current.totalDeFiValue).toBe(84000);
  });

  it('should handle errors gracefully', () => {
    vi.mocked(getDeFiPositions).mockImplementation(() => {
      throw new Error('Failed to fetch');
    });

    useStore.setState({
      accounts: [
        {
          id: 'acc-1',
          type: 'wallet',
          platform: 'Ethereum',
          label: 'Test',
          address: '0x123',
          status: 'connected',
        },
      ],
    });

    renderHook(() => useDeFiPositions());

    expect(useStore.getState().defiError).toBe('Failed to fetch');
  });

  it('should return loading state', () => {
    useStore.setState({ isLoadingDeFi: true });
    const { result } = renderHook(() => useDeFiPositions());
    expect(result.current.isLoadingDeFi).toBe(true);
  });

  it('should update positions when accounts change', () => {
    vi.mocked(getDeFiPositions).mockReturnValue([]);

    const { rerender } = renderHook(() => useDeFiPositions());

    expect(getDeFiPositions).not.toHaveBeenCalled();

    // Add an account
    act(() => {
      useStore.setState({
        accounts: [
          {
            id: 'acc-1',
            type: 'wallet',
            platform: 'Ethereum',
            label: 'Test',
            address: '0x123',
            status: 'connected',
          },
        ],
      });
    });

    rerender();

    expect(getDeFiPositions).toHaveBeenCalled();
  });
});
