import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RpcProviderConfig } from '../rpc-provider-config.types';

// Mock hoisted functions
const {
  mockUpdateChainConfig,
  mockIsChainSupported,
  mockGetEnvironment,
  mockGetChainConfig,
  mockGetHealthMetrics,
} = vi.hoisted(() => ({
  mockUpdateChainConfig: vi.fn(),
  mockIsChainSupported: vi.fn().mockReturnValue(true),
  mockGetEnvironment: vi.fn().mockReturnValue('production'),
  mockGetChainConfig: vi.fn().mockReturnValue({ endpoints: { http: [] } }),
  mockGetHealthMetrics: vi.fn().mockReturnValue({ endpoints: 2, requests: 0, failures: 0, avgResponseTime: 0 }),
}));

vi.mock('@cygnus-wealth/evm-integration', () => ({
  ChainRegistry: vi.fn().mockImplementation(() => ({
    updateChainConfig: mockUpdateChainConfig,
    isChainSupported: mockIsChainSupported,
    getEnvironment: mockGetEnvironment,
    getChainConfig: mockGetChainConfig,
  })),
}));

vi.mock('@cygnus-wealth/sol-integration', () => ({
  SolanaIntegrationFacade: vi.fn().mockImplementation(() => ({
    getHealthMetrics: mockGetHealthMetrics,
    getSolanaBalance: vi.fn(),
    getTokenBalances: vi.fn(),
  })),
}));

// Import after mocks
import { createEvmIntegration, createSolIntegration, extractEvmEndpoints, extractSolanaEndpoints } from '../integrationServices';
import { ChainRegistry } from '@cygnus-wealth/evm-integration';
import { SolanaIntegrationFacade } from '@cygnus-wealth/sol-integration';

function makeConfig(overrides: Partial<RpcProviderConfig> = {}): RpcProviderConfig {
  return {
    environment: 'production',
    availableProviders: ['alchemy'],
    chains: {
      '1': {
        chainId: '1',
        chainName: 'Ethereum',
        endpoints: [
          { url: 'https://eth-mainnet.g.alchemy.com/v2/test-key', provider: 'alchemy', type: 'http' },
          { url: 'https://cloudflare-eth.com', provider: 'public', type: 'http' },
        ],
      },
      '137': {
        chainId: '137',
        chainName: 'Polygon',
        endpoints: [
          { url: 'https://polygon-mainnet.g.alchemy.com/v2/test-key', provider: 'alchemy', type: 'http' },
          { url: 'https://polygon-rpc.com', provider: 'public', type: 'http' },
        ],
      },
      'solana-mainnet': {
        chainId: 'solana-mainnet',
        chainName: 'Solana',
        endpoints: [
          { url: 'https://mainnet.helius-rpc.com/?api-key=helius-key', provider: 'helius', type: 'http' },
          { url: 'https://solana.publicnode.com', provider: 'public', type: 'http' },
        ],
      },
    },
    ...overrides,
  };
}

describe('integrationServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsChainSupported.mockReturnValue(true);
    mockGetEnvironment.mockReturnValue('production');
  });

  describe('extractEvmEndpoints', () => {
    it('returns HTTP URLs for a given chain ID', () => {
      const config = makeConfig();
      const urls = extractEvmEndpoints(config, '1');
      expect(urls).toEqual([
        'https://eth-mainnet.g.alchemy.com/v2/test-key',
        'https://cloudflare-eth.com',
      ]);
    });

    it('returns empty array for unknown chain', () => {
      const config = makeConfig();
      const urls = extractEvmEndpoints(config, '999');
      expect(urls).toEqual([]);
    });

    it('filters to HTTP endpoints only', () => {
      const config: RpcProviderConfig = {
        environment: 'production',
        availableProviders: ['alchemy'],
        chains: {
          '1': {
            chainId: '1',
            chainName: 'Ethereum',
            endpoints: [
              { url: 'https://eth.alchemy.com/v2/key', provider: 'alchemy', type: 'http' },
              { url: 'wss://eth.alchemy.com/v2/key', provider: 'alchemy', type: 'ws' },
            ],
          },
        },
      };
      const urls = extractEvmEndpoints(config, '1');
      expect(urls).toEqual(['https://eth.alchemy.com/v2/key']);
    });
  });

  describe('extractSolanaEndpoints', () => {
    it('returns Solana endpoint URLs from config', () => {
      const config = makeConfig();
      const urls = extractSolanaEndpoints(config);
      expect(urls).toEqual([
        'https://mainnet.helius-rpc.com/?api-key=helius-key',
        'https://solana.publicnode.com',
      ]);
    });

    it('returns devnet endpoints for testnet environment', () => {
      const config: RpcProviderConfig = {
        environment: 'testnet',
        availableProviders: [],
        chains: {
          'solana-devnet': {
            chainId: 'solana-devnet',
            chainName: 'Solana Devnet',
            endpoints: [
              { url: 'https://api.devnet.solana.com', provider: 'public', type: 'http' },
            ],
          },
        },
      };
      const urls = extractSolanaEndpoints(config);
      expect(urls).toEqual(['https://api.devnet.solana.com']);
    });

    it('returns empty array when no Solana chain in config', () => {
      const config: RpcProviderConfig = {
        environment: 'production',
        availableProviders: [],
        chains: {},
      };
      const urls = extractSolanaEndpoints(config);
      expect(urls).toEqual([]);
    });
  });

  describe('createEvmIntegration', () => {
    it('creates ChainRegistry with the given environment', () => {
      const config = makeConfig();
      createEvmIntegration(config);
      expect(ChainRegistry).toHaveBeenCalledWith('production');
    });

    it('creates registry with testnet environment', () => {
      const config = makeConfig({ environment: 'testnet' });
      mockGetEnvironment.mockReturnValue('testnet');
      const registry = createEvmIntegration(config);
      expect(ChainRegistry).toHaveBeenCalledWith('testnet');
      expect(registry.getEnvironment()).toBe('testnet');
    });

    it('updates chain endpoints with config URLs', () => {
      const config = makeConfig();
      createEvmIntegration(config);
      expect(mockUpdateChainConfig).toHaveBeenCalledWith(1, {
        endpoints: {
          http: [
            'https://eth-mainnet.g.alchemy.com/v2/test-key',
            'https://cloudflare-eth.com',
          ],
        },
      });
    });

    it('skips chains not supported by registry', () => {
      mockIsChainSupported.mockReturnValue(false);
      const config = makeConfig();
      createEvmIntegration(config);
      expect(mockUpdateChainConfig).not.toHaveBeenCalled();
    });
  });

  describe('createSolIntegration', () => {
    it('creates SolanaIntegrationFacade with configured endpoints', () => {
      const config = makeConfig();
      createSolIntegration(config);
      expect(SolanaIntegrationFacade).toHaveBeenCalledWith({
        environment: 'production',
        rpcEndpoints: [
          'https://mainnet.helius-rpc.com/?api-key=helius-key',
          'https://solana.publicnode.com',
        ],
      });
    });

    it('passes correct environment to facade', () => {
      const config = makeConfig({ environment: 'testnet' });
      createSolIntegration(config);
      expect(SolanaIntegrationFacade).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'testnet' }),
      );
    });

    it('omits rpcEndpoints when no Solana chains in config', () => {
      const config: RpcProviderConfig = {
        environment: 'production',
        availableProviders: [],
        chains: {},
      };
      createSolIntegration(config);
      expect(SolanaIntegrationFacade).toHaveBeenCalledWith({
        environment: 'production',
        rpcEndpoints: undefined,
      });
    });

    it('returns a facade with working getHealthMetrics', () => {
      const config = makeConfig();
      const facade = createSolIntegration(config);
      const metrics = facade.getHealthMetrics();
      expect(metrics).toHaveProperty('endpoints');
    });
  });
});
