import { describe, it, expect, beforeEach } from 'vitest';
import { buildRpcProviderConfig } from '../buildRpcProviderConfig';
import type { RpcProviderConfig } from '../rpc-provider-config.types';

/**
 * Helper: builds a mock env object with the given keys set.
 */
function makeEnv(keys: Record<string, string> = {}): Record<string, string> {
  return { ...keys };
}

describe('buildRpcProviderConfig', () => {
  // ---------------------------------------------------------------
  // All keys present
  // ---------------------------------------------------------------
  describe('when all provider API keys are present', () => {
    let config: RpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('production', makeEnv({
        VITE_CYGNUS_RPC_ALCHEMY_KEY: 'alchemy-key-123',
        VITE_CYGNUS_RPC_DRPC_KEY: 'drpc-key-456',
        VITE_CYGNUS_RPC_HELIUS_KEY: 'helius-key-789',
        VITE_CYGNUS_RPC_INFURA_KEY: 'infura-key-abc',
        VITE_CYGNUS_RPC_QUICKNODE_KEY: 'quicknode-key-def',
      }));
    });

    it('reports all providers as available', () => {
      expect(config.availableProviders).toContain('alchemy');
      expect(config.availableProviders).toContain('drpc');
      expect(config.availableProviders).toContain('helius');
      expect(config.availableProviders).toContain('infura');
      expect(config.availableProviders).toContain('quicknode');
    });

    it('sets the environment', () => {
      expect(config.environment).toBe('production');
    });

    it('creates EVM chain entries for ethereum, polygon, arbitrum, optimism, base', () => {
      expect(config.chains['1']).toBeDefined();
      expect(config.chains['137']).toBeDefined();
      expect(config.chains['42161']).toBeDefined();
      expect(config.chains['10']).toBeDefined();
      expect(config.chains['8453']).toBeDefined();
    });

    it('creates a solana chain entry', () => {
      expect(config.chains['solana-mainnet']).toBeDefined();
    });

    it('populates Ethereum endpoints with Alchemy as first in fallback chain', () => {
      const eth = config.chains['1'];
      expect(eth.endpoints.length).toBeGreaterThanOrEqual(3);
      expect(eth.endpoints[0].provider).toBe('alchemy');
      expect(eth.endpoints[0].url).toContain('alchemy-key-123');
      expect(eth.endpoints[0].type).toBe('http');
    });

    it('includes Infura endpoints for Ethereum', () => {
      const eth = config.chains['1'];
      const infura = eth.endpoints.find(e => e.provider === 'infura');
      expect(infura).toBeDefined();
      expect(infura!.url).toContain('infura-key-abc');
    });

    it('includes dRPC endpoints for EVM chains', () => {
      const eth = config.chains['1'];
      const drpc = eth.endpoints.find(e => e.provider === 'drpc');
      expect(drpc).toBeDefined();
      expect(drpc!.url).toContain('drpc-key-456');
    });

    it('includes QuickNode endpoints for EVM chains', () => {
      const eth = config.chains['1'];
      const qn = eth.endpoints.find(e => e.provider === 'quicknode');
      expect(qn).toBeDefined();
      expect(qn!.url).toContain('quicknode-key-def');
    });

    it('places Helius first in Solana fallback chain', () => {
      const sol = config.chains['solana-mainnet'];
      expect(sol.endpoints[0].provider).toBe('helius');
      expect(sol.endpoints[0].url).toContain('helius-key-789');
    });

    it('includes Alchemy for Solana when key is present', () => {
      const sol = config.chains['solana-mainnet'];
      const alchemy = sol.endpoints.find(e => e.provider === 'alchemy');
      expect(alchemy).toBeDefined();
      expect(alchemy!.url).toContain('alchemy-key-123');
    });

    it('always ends with public endpoints as last resort', () => {
      const eth = config.chains['1'];
      const lastEndpoint = eth.endpoints[eth.endpoints.length - 1];
      expect(lastEndpoint.provider).toBe('public');
    });

    it('constructs valid Alchemy URL for Ethereum', () => {
      const eth = config.chains['1'];
      const alchemy = eth.endpoints.find(e => e.provider === 'alchemy');
      expect(alchemy!.url).toBe('https://eth-mainnet.g.alchemy.com/v2/alchemy-key-123');
    });

    it('constructs valid Infura URL for Ethereum', () => {
      const eth = config.chains['1'];
      const infura = eth.endpoints.find(e => e.provider === 'infura');
      expect(infura!.url).toBe('https://mainnet.infura.io/v3/infura-key-abc');
    });

    it('constructs valid Helius URL for Solana', () => {
      const sol = config.chains['solana-mainnet'];
      const helius = sol.endpoints.find(e => e.provider === 'helius');
      expect(helius!.url).toBe('https://mainnet.helius-rpc.com/?api-key=helius-key-789');
    });
  });

  // ---------------------------------------------------------------
  // Partial keys — only Alchemy
  // ---------------------------------------------------------------
  describe('when only Alchemy key is present', () => {
    let config: RpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('production', makeEnv({
        VITE_CYGNUS_RPC_ALCHEMY_KEY: 'alchemy-only',
      }));
    });

    it('lists only alchemy as available provider', () => {
      expect(config.availableProviders).toContain('alchemy');
      expect(config.availableProviders).not.toContain('infura');
      expect(config.availableProviders).not.toContain('helius');
      expect(config.availableProviders).not.toContain('drpc');
      expect(config.availableProviders).not.toContain('quicknode');
    });

    it('Ethereum still has endpoints (alchemy + public)', () => {
      const eth = config.chains['1'];
      expect(eth.endpoints.length).toBeGreaterThanOrEqual(2);
      expect(eth.endpoints[0].provider).toBe('alchemy');
      expect(eth.endpoints[eth.endpoints.length - 1].provider).toBe('public');
    });

    it('omits Infura from Ethereum endpoints', () => {
      const eth = config.chains['1'];
      const infura = eth.endpoints.find(e => e.provider === 'infura');
      expect(infura).toBeUndefined();
    });

    it('Solana includes Alchemy but not Helius', () => {
      const sol = config.chains['solana-mainnet'];
      const alchemy = sol.endpoints.find(e => e.provider === 'alchemy');
      const helius = sol.endpoints.find(e => e.provider === 'helius');
      expect(alchemy).toBeDefined();
      expect(helius).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------
  // Partial keys — only Helius
  // ---------------------------------------------------------------
  describe('when only Helius key is present', () => {
    let config: RpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('production', makeEnv({
        VITE_CYGNUS_RPC_HELIUS_KEY: 'helius-only',
      }));
    });

    it('lists only helius as available provider', () => {
      expect(config.availableProviders).toEqual(['helius']);
    });

    it('EVM chains still have public endpoints', () => {
      const eth = config.chains['1'];
      expect(eth.endpoints.length).toBeGreaterThanOrEqual(1);
      expect(eth.endpoints.every(e => e.provider === 'public')).toBe(true);
    });

    it('Solana has Helius as primary endpoint', () => {
      const sol = config.chains['solana-mainnet'];
      expect(sol.endpoints[0].provider).toBe('helius');
      expect(sol.endpoints[0].url).toContain('helius-only');
    });
  });

  // ---------------------------------------------------------------
  // No keys — public-only mode
  // ---------------------------------------------------------------
  describe('when no API keys are provided (public-only mode)', () => {
    let config: RpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('production', makeEnv());
    });

    it('has empty available providers list', () => {
      expect(config.availableProviders).toEqual([]);
    });

    it('still provides public endpoints for all EVM chains', () => {
      const eth = config.chains['1'];
      expect(eth.endpoints.length).toBeGreaterThanOrEqual(1);
      expect(eth.endpoints[0].provider).toBe('public');
    });

    it('provides public endpoints for Polygon', () => {
      const polygon = config.chains['137'];
      expect(polygon.endpoints.length).toBeGreaterThanOrEqual(1);
      expect(polygon.endpoints[0].provider).toBe('public');
    });

    it('provides public endpoints for Solana', () => {
      const sol = config.chains['solana-mainnet'];
      expect(sol.endpoints.length).toBeGreaterThanOrEqual(1);
      expect(sol.endpoints[0].provider).toBe('public');
    });

    it('all endpoints are public', () => {
      for (const chain of Object.values(config.chains)) {
        for (const endpoint of chain.endpoints) {
          expect(endpoint.provider).toBe('public');
        }
      }
    });
  });

  // ---------------------------------------------------------------
  // Testnet environment
  // ---------------------------------------------------------------
  describe('when environment is testnet', () => {
    let config: RpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('testnet', makeEnv({
        VITE_CYGNUS_RPC_ALCHEMY_KEY: 'alchemy-test',
        VITE_CYGNUS_RPC_INFURA_KEY: 'infura-test',
      }));
    });

    it('sets environment to testnet', () => {
      expect(config.environment).toBe('testnet');
    });

    it('uses testnet chain IDs for EVM (Sepolia = 11155111)', () => {
      expect(config.chains['11155111']).toBeDefined();
      expect(config.chains['1']).toBeUndefined();
    });

    it('uses testnet Alchemy URLs for Sepolia', () => {
      const sepolia = config.chains['11155111'];
      const alchemy = sepolia.endpoints.find(e => e.provider === 'alchemy');
      expect(alchemy).toBeDefined();
      expect(alchemy!.url).toContain('eth-sepolia');
      expect(alchemy!.url).toContain('alchemy-test');
    });

    it('uses Solana devnet for testnet environment', () => {
      const sol = config.chains['solana-devnet'];
      expect(sol).toBeDefined();
      expect(sol.endpoints.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------
  // Fallback ordering
  // ---------------------------------------------------------------
  describe('fallback chain ordering', () => {
    it('EVM priority: alchemy > infura > drpc > quicknode > public', () => {
      const config = buildRpcProviderConfig('production', makeEnv({
        VITE_CYGNUS_RPC_ALCHEMY_KEY: 'a',
        VITE_CYGNUS_RPC_INFURA_KEY: 'i',
        VITE_CYGNUS_RPC_DRPC_KEY: 'd',
        VITE_CYGNUS_RPC_QUICKNODE_KEY: 'q',
      }));
      const eth = config.chains['1'];
      const providers = eth.endpoints.map(e => e.provider);
      const alchemyIdx = providers.indexOf('alchemy');
      const infuraIdx = providers.indexOf('infura');
      const drpcIdx = providers.indexOf('drpc');
      const qnIdx = providers.indexOf('quicknode');
      const publicIdx = providers.indexOf('public');

      expect(alchemyIdx).toBeLessThan(infuraIdx);
      expect(infuraIdx).toBeLessThan(drpcIdx);
      expect(drpcIdx).toBeLessThan(qnIdx);
      expect(qnIdx).toBeLessThan(publicIdx);
    });

    it('Solana priority: helius > alchemy > quicknode > public', () => {
      const config = buildRpcProviderConfig('production', makeEnv({
        VITE_CYGNUS_RPC_HELIUS_KEY: 'h',
        VITE_CYGNUS_RPC_ALCHEMY_KEY: 'a',
        VITE_CYGNUS_RPC_QUICKNODE_KEY: 'q',
      }));
      const sol = config.chains['solana-mainnet'];
      const providers = sol.endpoints.map(e => e.provider);
      const heliusIdx = providers.indexOf('helius');
      const alchemyIdx = providers.indexOf('alchemy');
      const qnIdx = providers.indexOf('quicknode');
      const publicIdx = providers.indexOf('public');

      expect(heliusIdx).toBeLessThan(alchemyIdx);
      expect(alchemyIdx).toBeLessThan(qnIdx);
      expect(qnIdx).toBeLessThan(publicIdx);
    });
  });

  // ---------------------------------------------------------------
  // URL template correctness
  // ---------------------------------------------------------------
  describe('URL template construction', () => {
    const config = buildRpcProviderConfig('production', makeEnv({
      VITE_CYGNUS_RPC_ALCHEMY_KEY: 'AKEY',
      VITE_CYGNUS_RPC_DRPC_KEY: 'DKEY',
      VITE_CYGNUS_RPC_HELIUS_KEY: 'HKEY',
      VITE_CYGNUS_RPC_INFURA_KEY: 'IKEY',
      VITE_CYGNUS_RPC_QUICKNODE_KEY: 'QKEY',
    }));

    it('Alchemy Polygon URL is correct', () => {
      const polygon = config.chains['137'];
      const alchemy = polygon.endpoints.find(e => e.provider === 'alchemy');
      expect(alchemy!.url).toBe('https://polygon-mainnet.g.alchemy.com/v2/AKEY');
    });

    it('Alchemy Arbitrum URL is correct', () => {
      const arb = config.chains['42161'];
      const alchemy = arb.endpoints.find(e => e.provider === 'alchemy');
      expect(alchemy!.url).toBe('https://arb-mainnet.g.alchemy.com/v2/AKEY');
    });

    it('Alchemy Optimism URL is correct', () => {
      const opt = config.chains['10'];
      const alchemy = opt.endpoints.find(e => e.provider === 'alchemy');
      expect(alchemy!.url).toBe('https://opt-mainnet.g.alchemy.com/v2/AKEY');
    });

    it('Alchemy Base URL is correct', () => {
      const base = config.chains['8453'];
      const alchemy = base.endpoints.find(e => e.provider === 'alchemy');
      expect(alchemy!.url).toBe('https://base-mainnet.g.alchemy.com/v2/AKEY');
    });

    it('Infura Polygon URL is correct', () => {
      const polygon = config.chains['137'];
      const infura = polygon.endpoints.find(e => e.provider === 'infura');
      expect(infura!.url).toBe('https://polygon-mainnet.infura.io/v3/IKEY');
    });

    it('dRPC Ethereum URL is correct', () => {
      const eth = config.chains['1'];
      const drpc = eth.endpoints.find(e => e.provider === 'drpc');
      expect(drpc!.url).toBe('https://lb.drpc.org/ogrpc?network=ethereum&dkey=DKEY');
    });

    it('Alchemy Solana URL is correct', () => {
      const sol = config.chains['solana-mainnet'];
      const alchemy = sol.endpoints.find(e => e.provider === 'alchemy');
      expect(alchemy!.url).toBe('https://solana-mainnet.g.alchemy.com/v2/AKEY');
    });
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------
  describe('edge cases', () => {
    it('empty string API keys are treated as missing', () => {
      const config = buildRpcProviderConfig('production', makeEnv({
        VITE_CYGNUS_RPC_ALCHEMY_KEY: '',
      }));
      expect(config.availableProviders).not.toContain('alchemy');
    });

    it('whitespace-only API keys are treated as missing', () => {
      const config = buildRpcProviderConfig('production', makeEnv({
        VITE_CYGNUS_RPC_ALCHEMY_KEY: '   ',
      }));
      expect(config.availableProviders).not.toContain('alchemy');
    });

    it('local environment returns minimal config', () => {
      const config = buildRpcProviderConfig('local', makeEnv());
      expect(config.environment).toBe('local');
      expect(config.chains['1337']).toBeDefined();
    });
  });
});
