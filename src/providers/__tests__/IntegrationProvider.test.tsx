import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

// Hoisted mocks
const {
  mockBuildRpcProviderConfig,
  mockCreateEvmIntegration,
  mockCreateSolIntegration,
  mockRegistry,
  mockFacade,
} = vi.hoisted(() => {
  const mockRegistry = {
    getAdapterByName: vi.fn(),
    getEnvironment: vi.fn().mockReturnValue('production'),
    isChainSupported: vi.fn().mockReturnValue(true),
    updateChainConfig: vi.fn(),
  };
  const mockFacade = {
    getSolanaBalance: vi.fn(),
    getTokenBalances: vi.fn(),
    getHealthMetrics: vi.fn().mockReturnValue({ endpoints: 2, requests: 0, failures: 0, avgResponseTime: 0 }),
  };
  return {
    mockBuildRpcProviderConfig: vi.fn().mockReturnValue({
      environment: 'production',
      availableProviders: ['alchemy'],
      chains: {
        '1': { chainId: '1', chainName: 'Ethereum', endpoints: [] },
        'solana-mainnet': { chainId: 'solana-mainnet', chainName: 'Solana', endpoints: [] },
      },
    }),
    mockCreateEvmIntegration: vi.fn().mockReturnValue(mockRegistry),
    mockCreateSolIntegration: vi.fn().mockReturnValue(mockFacade),
    mockRegistry,
    mockFacade,
  };
});

vi.mock('../../config/buildRpcProviderConfig', () => ({
  buildRpcProviderConfig: mockBuildRpcProviderConfig,
}));

vi.mock('../../config/integrationServices', () => ({
  createEvmIntegration: mockCreateEvmIntegration,
  createSolIntegration: mockCreateSolIntegration,
}));

import { IntegrationProvider, useIntegration } from '../IntegrationProvider';

describe('IntegrationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <IntegrationProvider>{children}</IntegrationProvider>
  );

  it('provides evmRegistry via context', () => {
    const { result } = renderHook(() => useIntegration(), { wrapper });
    expect(result.current.evmRegistry).toBe(mockRegistry);
  });

  it('provides solanaFacade via context', () => {
    const { result } = renderHook(() => useIntegration(), { wrapper });
    expect(result.current.solanaFacade).toBe(mockFacade);
  });

  it('provides rpcConfig via context', () => {
    const { result } = renderHook(() => useIntegration(), { wrapper });
    expect(result.current.rpcConfig).toBeDefined();
    expect(result.current.rpcConfig.environment).toBe('production');
  });

  it('calls buildRpcProviderConfig on mount', () => {
    renderHook(() => useIntegration(), { wrapper });
    expect(mockBuildRpcProviderConfig).toHaveBeenCalled();
  });

  it('passes config to createEvmIntegration', () => {
    renderHook(() => useIntegration(), { wrapper });
    expect(mockCreateEvmIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'production' }),
    );
  });

  it('passes config to createSolIntegration', () => {
    renderHook(() => useIntegration(), { wrapper });
    expect(mockCreateSolIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'production' }),
    );
  });

  it('throws when useIntegration is used outside provider', () => {
    // Suppress console.error for expected React error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useIntegration());
    }).toThrow('useIntegration must be used within IntegrationProvider');
    spy.mockRestore();
  });
});
