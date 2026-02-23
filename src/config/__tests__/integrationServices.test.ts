import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RpcProviderRole, RpcProviderType } from '../rpc-provider-config.types';
import type { AppRpcProviderConfig } from '../rpc-provider-config.types';

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

function makeConfig(overrides: Partial<AppRpcProviderConfig> = {}): AppRpcProviderConfig {
  return {
    environment: 'production',
    chains: {
      '1': {
        chainId: 1,
        chainName: 'Ethereum',
        endpoints: [
          {
            url: 'https://eth-mainnet.gateway.pokt.network/v1/lb/libre',
            provider: 'POKT Gateway',
            role: RpcProviderRole.PRIMARY,
            type: RpcProviderType.DECENTRALIZED,
            rateLimitRps: 50,
            timeoutMs: 5000,
          },
          {
            url: 'https://cloudflare-eth.com',
            provider: 'Public',
            role: RpcProviderRole.EMERGENCY,
            type: RpcProviderType.PUBLIC,
            rateLimitRps: 10,
            timeoutMs: 10000,
          },
        ],
        totalOperationTimeoutMs: 30000,
        cacheStaleAcceptanceMs: 60000,
      },
      '137': {
        chainId: 137,
        chainName: 'Polygon',
        endpoints: [
          {
            url: 'https://poly-mainnet.gateway.pokt.network/v1/lb/libre',
            provider: 'POKT Gateway',
            role: RpcProviderRole.PRIMARY,
            type: RpcProviderType.DECENTRALIZED,
            rateLimitRps: 50,
            timeoutMs: 5000,
          },
          {
            url: 'https://polygon-rpc.com',
            provider: 'Public',
            role: RpcProviderRole.EMERGENCY,
            type: RpcProviderType.PUBLIC,
            rateLimitRps: 10,
            timeoutMs: 10000,
          },
        ],
        totalOperationTimeoutMs: 30000,
        cacheStaleAcceptanceMs: 60000,
      },
      'solana-mainnet': {
        chainId: 101,
        chainName: 'Solana',
        endpoints: [
          {
            url: 'https://solana-mainnet.gateway.pokt.network/v1/lb/libre',
            provider: 'POKT Gateway',
            role: RpcProviderRole.PRIMARY,
            type: RpcProviderType.DECENTRALIZED,
            rateLimitRps: 50,
            timeoutMs: 5000,
          },
          {
            url: 'https://solana.publicnode.com',
            provider: 'Public',
            role: RpcProviderRole.EMERGENCY,
            type: RpcProviderType.PUBLIC,
            rateLimitRps: 10,
            timeoutMs: 10000,
          },
        ],
        totalOperationTimeoutMs: 30000,
        cacheStaleAcceptanceMs: 60000,
      },
    },
    circuitBreaker: {
      failureThreshold: 5,
      openDurationMs: 30000,
      halfOpenMaxAttempts: 2,
      monitorWindowMs: 60000,
    },
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    },
    healthCheck: {
      intervalMs: 30000,
      timeoutMs: 5000,
      method: 'eth_blockNumber',
    },
    privacy: {
      rotateWithinTier: true,
      privacyMode: false,
      queryJitterMs: 100,
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
    it('returns all endpoint URLs for a given chain ID', () => {
      const config = makeConfig();
      const urls = extractEvmEndpoints(config, '1');
      expect(urls).toEqual([
        'https://eth-mainnet.gateway.pokt.network/v1/lb/libre',
        'https://cloudflare-eth.com',
      ]);
    });

    it('returns empty array for unknown chain', () => {
      const config = makeConfig();
      const urls = extractEvmEndpoints(config, '999');
      expect(urls).toEqual([]);
    });
  });

  describe('extractSolanaEndpoints', () => {
    it('returns Solana endpoint URLs from config', () => {
      const config = makeConfig();
      const urls = extractSolanaEndpoints(config);
      expect(urls).toEqual([
        'https://solana-mainnet.gateway.pokt.network/v1/lb/libre',
        'https://solana.publicnode.com',
      ]);
    });

    it('returns devnet endpoints for testnet environment', () => {
      const config: AppRpcProviderConfig = {
        ...makeConfig(),
        environment: 'testnet',
        chains: {
          'solana-devnet': {
            chainId: 103,
            chainName: 'Solana Devnet',
            endpoints: [
              {
                url: 'https://api.devnet.solana.com',
                provider: 'Public',
                role: RpcProviderRole.EMERGENCY,
                type: RpcProviderType.PUBLIC,
                rateLimitRps: 10,
                timeoutMs: 10000,
              },
            ],
            totalOperationTimeoutMs: 30000,
            cacheStaleAcceptanceMs: 60000,
          },
        },
      };
      const urls = extractSolanaEndpoints(config);
      expect(urls).toEqual(['https://api.devnet.solana.com']);
    });

    it('returns empty array when no Solana chain in config', () => {
      const config: AppRpcProviderConfig = {
        ...makeConfig(),
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
            'https://eth-mainnet.gateway.pokt.network/v1/lb/libre',
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
          'https://solana-mainnet.gateway.pokt.network/v1/lb/libre',
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
      const config: AppRpcProviderConfig = {
        ...makeConfig(),
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
