import { describe, it, expect, beforeEach } from 'vitest';
import { buildRpcProviderConfig } from '../buildRpcProviderConfig';
import { RpcProviderRole, RpcProviderType } from '../rpc-provider-config.types';
import type { AppRpcProviderConfig } from '../rpc-provider-config.types';

function makeEnv(keys: Record<string, string> = {}): Record<string, string> {
  return { ...keys };
}

describe('buildRpcProviderConfig', () => {
  // -------------------------------------------------------------------
  // Default keyless mode — app works on first launch without any config
  // -------------------------------------------------------------------
  describe('keyless default mode (no API keys)', () => {
    let config: AppRpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('production', { envVars: makeEnv() });
    });

    it('sets environment', () => {
      expect(config.environment).toBe('production');
    });

    it('creates EVM chain entries for ethereum, polygon, arbitrum, optimism, base', () => {
      expect(config.chains['1']).toBeDefined();
      expect(config.chains['137']).toBeDefined();
      expect(config.chains['42161']).toBeDefined();
      expect(config.chains['10']).toBeDefined();
      expect(config.chains['8453']).toBeDefined();
    });

    it('creates a Solana chain entry', () => {
      expect(config.chains['solana-mainnet']).toBeDefined();
    });

    it('uses POKT as PRIMARY for EVM chains', () => {
      const eth = config.chains['1'];
      const primary = eth.endpoints.filter(e => e.role === RpcProviderRole.PRIMARY);
      expect(primary.length).toBeGreaterThanOrEqual(1);
      expect(primary[0].provider).toBe('POKT Gateway');
      expect(primary[0].type).toBe(RpcProviderType.DECENTRALIZED);
    });

    it('uses Lava as TERTIARY for EVM chains', () => {
      const eth = config.chains['1'];
      const tertiary = eth.endpoints.filter(e => e.role === RpcProviderRole.TERTIARY);
      expect(tertiary.length).toBeGreaterThanOrEqual(1);
      expect(tertiary[0].provider).toBe('Lava Network');
      expect(tertiary[0].type).toBe(RpcProviderType.DECENTRALIZED);
    });

    it('uses public endpoints as EMERGENCY fallback', () => {
      const eth = config.chains['1'];
      const emergency = eth.endpoints.filter(e => e.role === RpcProviderRole.EMERGENCY);
      expect(emergency.length).toBeGreaterThanOrEqual(1);
      expect(emergency.some(e => e.type === RpcProviderType.PUBLIC)).toBe(true);
    });

    it('has no SECONDARY endpoints when no dRPC key is provided', () => {
      const eth = config.chains['1'];
      const secondary = eth.endpoints.filter(e => e.role === RpcProviderRole.SECONDARY);
      expect(secondary).toEqual([]);
    });

    it('POKT endpoints are keyless (no API key in URL)', () => {
      const eth = config.chains['1'];
      const pokt = eth.endpoints.find(e => e.provider === 'POKT Gateway');
      expect(pokt).toBeDefined();
      expect(pokt!.url).not.toContain('VITE_');
      expect(pokt!.url).not.toContain('undefined');
    });

    it('Lava endpoints are keyless', () => {
      const eth = config.chains['1'];
      const lava = eth.endpoints.find(e => e.provider === 'Lava Network');
      expect(lava).toBeDefined();
      expect(lava!.url).not.toContain('undefined');
    });

    it('uses POKT as PRIMARY for Solana standard RPC', () => {
      const sol = config.chains['solana-mainnet'];
      const primary = sol.endpoints.filter(e => e.role === RpcProviderRole.PRIMARY);
      expect(primary.length).toBeGreaterThanOrEqual(1);
      expect(primary[0].provider).toBe('POKT Gateway');
    });

    it('provides operational configs with sane defaults', () => {
      expect(config.circuitBreaker).toBeDefined();
      expect(config.circuitBreaker.failureThreshold).toBeGreaterThan(0);
      expect(config.retry).toBeDefined();
      expect(config.retry.maxAttempts).toBeGreaterThan(0);
      expect(config.healthCheck).toBeDefined();
      expect(config.healthCheck.intervalMs).toBeGreaterThan(0);
      expect(config.privacy).toBeDefined();
    });

    it('each chain has totalOperationTimeoutMs and cacheStaleAcceptanceMs', () => {
      for (const chain of Object.values(config.chains)) {
        expect(chain.totalOperationTimeoutMs).toBeGreaterThan(0);
        expect(chain.cacheStaleAcceptanceMs).toBeGreaterThan(0);
      }
    });

    it('each endpoint has rateLimitRps and timeoutMs', () => {
      for (const chain of Object.values(config.chains)) {
        for (const ep of chain.endpoints) {
          expect(ep.rateLimitRps).toBeGreaterThan(0);
          expect(ep.timeoutMs).toBeGreaterThan(0);
        }
      }
    });
  });

  // -------------------------------------------------------------------
  // With dRPC key — adds SECONDARY tier
  // -------------------------------------------------------------------
  describe('with dRPC key (secondary tier)', () => {
    let config: AppRpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('production', {
        envVars: makeEnv({ VITE_CYGNUS_RPC_DRPC_KEY: 'drpc-key-123' }),
      });
    });

    it('adds dRPC as SECONDARY for EVM chains', () => {
      const eth = config.chains['1'];
      const secondary = eth.endpoints.filter(e => e.role === RpcProviderRole.SECONDARY);
      expect(secondary.length).toBe(1);
      expect(secondary[0].provider).toBe('dRPC');
      expect(secondary[0].url).toContain('drpc-key-123');
    });

    it('dRPC is classified as DECENTRALIZED', () => {
      const eth = config.chains['1'];
      const drpc = eth.endpoints.find(e => e.provider === 'dRPC');
      expect(drpc!.type).toBe(RpcProviderType.DECENTRALIZED);
    });

    it('maintains POKT as PRIMARY', () => {
      const eth = config.chains['1'];
      expect(eth.endpoints[0].role).toBe(RpcProviderRole.PRIMARY);
      expect(eth.endpoints[0].provider).toBe('POKT Gateway');
    });
  });

  // -------------------------------------------------------------------
  // With managed provider keys — demoted to EMERGENCY
  // -------------------------------------------------------------------
  describe('with managed provider keys (Alchemy, Infura)', () => {
    let config: AppRpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('production', {
        envVars: makeEnv({
          VITE_CYGNUS_RPC_ALCHEMY_KEY: 'alchemy-key',
          VITE_CYGNUS_RPC_INFURA_KEY: 'infura-key',
          VITE_CYGNUS_RPC_DRPC_KEY: 'drpc-key',
        }),
      });
    });

    it('demotes Alchemy to EMERGENCY', () => {
      const eth = config.chains['1'];
      const alchemy = eth.endpoints.find(e => e.provider === 'Alchemy');
      expect(alchemy).toBeDefined();
      expect(alchemy!.role).toBe(RpcProviderRole.EMERGENCY);
      expect(alchemy!.type).toBe(RpcProviderType.MANAGED);
    });

    it('demotes Infura to EMERGENCY', () => {
      const eth = config.chains['1'];
      const infura = eth.endpoints.find(e => e.provider === 'Infura');
      expect(infura).toBeDefined();
      expect(infura!.role).toBe(RpcProviderRole.EMERGENCY);
      expect(infura!.type).toBe(RpcProviderType.MANAGED);
    });

    it('maintains decentralized-first priority order', () => {
      const eth = config.chains['1'];
      const providers = eth.endpoints.map(e => e.provider);
      const poktIdx = providers.indexOf('POKT Gateway');
      const drpcIdx = providers.indexOf('dRPC');
      const lavaIdx = providers.indexOf('Lava Network');
      const alchemyIdx = providers.indexOf('Alchemy');
      const infuraIdx = providers.indexOf('Infura');

      expect(poktIdx).toBeLessThan(drpcIdx);
      expect(drpcIdx).toBeLessThan(lavaIdx);
      expect(lavaIdx).toBeLessThan(alchemyIdx);
      expect(lavaIdx).toBeLessThan(infuraIdx);
    });
  });

  // -------------------------------------------------------------------
  // Full provider set
  // -------------------------------------------------------------------
  describe('with all provider keys present', () => {
    let config: AppRpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('production', {
        envVars: makeEnv({
          VITE_CYGNUS_RPC_ALCHEMY_KEY: 'alchemy-key',
          VITE_CYGNUS_RPC_DRPC_KEY: 'drpc-key',
          VITE_CYGNUS_RPC_HELIUS_KEY: 'helius-key',
          VITE_CYGNUS_RPC_INFURA_KEY: 'infura-key',
          VITE_CYGNUS_RPC_QUICKNODE_KEY: 'quicknode-key',
        }),
      });
    });

    it('EVM priority: POKT > dRPC > Lava > Alchemy > Infura > QuickNode > Public', () => {
      const eth = config.chains['1'];
      const roles = eth.endpoints.map(e => e.role);

      expect(roles[0]).toBe(RpcProviderRole.PRIMARY);     // POKT
      expect(roles[1]).toBe(RpcProviderRole.SECONDARY);    // dRPC
      expect(roles[2]).toBe(RpcProviderRole.TERTIARY);     // Lava

      const emergencyEndpoints = eth.endpoints.filter(e => e.role === RpcProviderRole.EMERGENCY);
      const emergencyProviders = emergencyEndpoints.map(e => e.provider);
      expect(emergencyProviders).toContain('Alchemy');
      expect(emergencyProviders).toContain('Infura');
      expect(emergencyProviders).toContain('QuickNode');
    });

    it('Solana includes Helius when key present', () => {
      const sol = config.chains['solana-mainnet'];
      const helius = sol.endpoints.find(e => e.provider === 'Helius');
      expect(helius).toBeDefined();
      expect(helius!.url).toContain('helius-key');
    });

    it('Solana priority: POKT > Helius > Lava > Public', () => {
      const sol = config.chains['solana-mainnet'];
      const providers = sol.endpoints.map(e => e.provider);
      const poktIdx = providers.indexOf('POKT Gateway');
      const heliusIdx = providers.indexOf('Helius');
      const lavaIdx = providers.indexOf('Lava Network');

      expect(poktIdx).toBeLessThan(heliusIdx);
      expect(heliusIdx).toBeLessThan(lavaIdx);
    });

    it('constructs valid Alchemy URL for Ethereum', () => {
      const eth = config.chains['1'];
      const alchemy = eth.endpoints.find(e => e.provider === 'Alchemy');
      expect(alchemy!.url).toBe('https://eth-mainnet.g.alchemy.com/v2/alchemy-key');
    });

    it('constructs valid dRPC URL for Ethereum', () => {
      const eth = config.chains['1'];
      const drpc = eth.endpoints.find(e => e.provider === 'dRPC');
      expect(drpc!.url).toBe('https://lb.drpc.org/ogrpc?network=ethereum&dkey=drpc-key');
    });

    it('constructs valid Helius URL for Solana', () => {
      const sol = config.chains['solana-mainnet'];
      const helius = sol.endpoints.find(e => e.provider === 'Helius');
      expect(helius!.url).toBe('https://mainnet.helius-rpc.com/?api-key=helius-key');
    });
  });

  // -------------------------------------------------------------------
  // Solana dual-path: Helius for DAS, POKT for standard RPC
  // -------------------------------------------------------------------
  describe('Solana dual-path', () => {
    it('uses POKT as PRIMARY for standard Solana RPC', () => {
      const config = buildRpcProviderConfig('production', {
        envVars: makeEnv({ VITE_CYGNUS_RPC_HELIUS_KEY: 'helius-key' }),
      });
      const sol = config.chains['solana-mainnet'];
      expect(sol.endpoints[0].provider).toBe('POKT Gateway');
      expect(sol.endpoints[0].role).toBe(RpcProviderRole.PRIMARY);
    });

    it('places Helius as SECONDARY for Solana when key present', () => {
      const config = buildRpcProviderConfig('production', {
        envVars: makeEnv({ VITE_CYGNUS_RPC_HELIUS_KEY: 'helius-key' }),
      });
      const sol = config.chains['solana-mainnet'];
      const helius = sol.endpoints.find(e => e.provider === 'Helius');
      expect(helius).toBeDefined();
      expect(helius!.role).toBe(RpcProviderRole.SECONDARY);
    });

    it('Helius is classified as MANAGED', () => {
      const config = buildRpcProviderConfig('production', {
        envVars: makeEnv({ VITE_CYGNUS_RPC_HELIUS_KEY: 'helius-key' }),
      });
      const sol = config.chains['solana-mainnet'];
      const helius = sol.endpoints.find(e => e.provider === 'Helius');
      expect(helius!.type).toBe(RpcProviderType.MANAGED);
    });

    it('excludes Helius from Solana when no key', () => {
      const config = buildRpcProviderConfig('production', { envVars: makeEnv() });
      const sol = config.chains['solana-mainnet'];
      const helius = sol.endpoints.find(e => e.provider === 'Helius');
      expect(helius).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // UserRpcConfig overrides
  // -------------------------------------------------------------------
  describe('UserRpcConfig overrides', () => {
    it('prepend mode: user endpoints appear before managed endpoints', () => {
      const config = buildRpcProviderConfig('production', {
        envVars: makeEnv(),
        userConfig: {
          endpoints: [
            { chainId: '1', url: 'https://my-eth-node.example.com/rpc', label: 'My Node' },
          ],
          mode: 'prepend',
        },
      });

      expect(config.userOverrides).toBeDefined();
      expect(config.userOverrides!.mode).toBe('prepend');
      expect(config.userOverrides!.endpoints).toHaveLength(1);
      expect(config.userOverrides!.endpoints[0].url).toBe('https://my-eth-node.example.com/rpc');
    });

    it('override mode: passes through to config', () => {
      const config = buildRpcProviderConfig('production', {
        envVars: makeEnv(),
        userConfig: {
          endpoints: [
            { chainId: '1', url: 'https://my-node.example.com' },
          ],
          mode: 'override',
        },
      });

      expect(config.userOverrides).toBeDefined();
      expect(config.userOverrides!.mode).toBe('override');
    });
  });

  // -------------------------------------------------------------------
  // Testnet environment
  // -------------------------------------------------------------------
  describe('testnet environment', () => {
    let config: AppRpcProviderConfig;

    beforeEach(() => {
      config = buildRpcProviderConfig('testnet', { envVars: makeEnv() });
    });

    it('sets environment to testnet', () => {
      expect(config.environment).toBe('testnet');
    });

    it('uses testnet chain IDs (Sepolia = 11155111)', () => {
      expect(config.chains['11155111']).toBeDefined();
      expect(config.chains['1']).toBeUndefined();
    });

    it('uses Solana devnet for testnet environment', () => {
      expect(config.chains['solana-devnet']).toBeDefined();
      expect(config.chains['solana-mainnet']).toBeUndefined();
    });

    it('still uses POKT as PRIMARY for testnet chains', () => {
      const sepolia = config.chains['11155111'];
      expect(sepolia.endpoints[0].role).toBe(RpcProviderRole.PRIMARY);
      expect(sepolia.endpoints[0].provider).toBe('POKT Gateway');
    });
  });

  // -------------------------------------------------------------------
  // Local environment
  // -------------------------------------------------------------------
  describe('local environment', () => {
    it('returns localhost config', () => {
      const config = buildRpcProviderConfig('local', { envVars: makeEnv() });
      expect(config.environment).toBe('local');
      expect(config.chains['1337']).toBeDefined();
    });

    it('localhost uses PUBLIC endpoints only', () => {
      const config = buildRpcProviderConfig('local', { envVars: makeEnv() });
      const local = config.chains['1337'];
      expect(local.endpoints.every(e => e.type === RpcProviderType.PUBLIC)).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------
  describe('edge cases', () => {
    it('empty string API keys are treated as missing', () => {
      const config = buildRpcProviderConfig('production', {
        envVars: makeEnv({ VITE_CYGNUS_RPC_DRPC_KEY: '' }),
      });
      const eth = config.chains['1'];
      const drpc = eth.endpoints.find(e => e.provider === 'dRPC');
      expect(drpc).toBeUndefined();
    });

    it('whitespace-only API keys are treated as missing', () => {
      const config = buildRpcProviderConfig('production', {
        envVars: makeEnv({ VITE_CYGNUS_RPC_DRPC_KEY: '   ' }),
      });
      const eth = config.chains['1'];
      const drpc = eth.endpoints.find(e => e.provider === 'dRPC');
      expect(drpc).toBeUndefined();
    });

    it('calling with no options uses defaults', () => {
      const config = buildRpcProviderConfig('production');
      expect(config.chains['1']).toBeDefined();
      expect(config.chains['1'].endpoints.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------
  // Fallback chain ordering
  // -------------------------------------------------------------------
  describe('fallback chain ordering', () => {
    it('EVM endpoints are ordered: PRIMARY < SECONDARY < TERTIARY < EMERGENCY', () => {
      const config = buildRpcProviderConfig('production', {
        envVars: makeEnv({
          VITE_CYGNUS_RPC_DRPC_KEY: 'd',
          VITE_CYGNUS_RPC_ALCHEMY_KEY: 'a',
          VITE_CYGNUS_RPC_INFURA_KEY: 'i',
        }),
      });
      const eth = config.chains['1'];
      const roles = eth.endpoints.map(e => e.role);
      const roleOrder = [
        RpcProviderRole.PRIMARY,
        RpcProviderRole.SECONDARY,
        RpcProviderRole.TERTIARY,
        RpcProviderRole.EMERGENCY,
      ];

      let lastRoleIdx = -1;
      for (const role of roles) {
        const idx = roleOrder.indexOf(role);
        expect(idx).toBeGreaterThanOrEqual(lastRoleIdx);
        lastRoleIdx = idx;
      }
    });
  });

  // -------------------------------------------------------------------
  // URL template construction
  // -------------------------------------------------------------------
  describe('URL template construction', () => {
    const config = buildRpcProviderConfig('production', {
      envVars: makeEnv({
        VITE_CYGNUS_RPC_ALCHEMY_KEY: 'AKEY',
        VITE_CYGNUS_RPC_DRPC_KEY: 'DKEY',
        VITE_CYGNUS_RPC_HELIUS_KEY: 'HKEY',
        VITE_CYGNUS_RPC_INFURA_KEY: 'IKEY',
        VITE_CYGNUS_RPC_QUICKNODE_KEY: 'QKEY',
      }),
    });

    it('Alchemy Polygon URL is correct', () => {
      const polygon = config.chains['137'];
      const alchemy = polygon.endpoints.find(e => e.provider === 'Alchemy');
      expect(alchemy!.url).toBe('https://polygon-mainnet.g.alchemy.com/v2/AKEY');
    });

    it('Infura Polygon URL is correct', () => {
      const polygon = config.chains['137'];
      const infura = polygon.endpoints.find(e => e.provider === 'Infura');
      expect(infura!.url).toBe('https://polygon-mainnet.infura.io/v3/IKEY');
    });

    it('dRPC Ethereum URL is correct', () => {
      const eth = config.chains['1'];
      const drpc = eth.endpoints.find(e => e.provider === 'dRPC');
      expect(drpc!.url).toBe('https://lb.drpc.org/ogrpc?network=ethereum&dkey=DKEY');
    });

    it('Helius Solana devnet URL uses devnet base', () => {
      const testConfig = buildRpcProviderConfig('testnet', {
        envVars: makeEnv({ VITE_CYGNUS_RPC_HELIUS_KEY: 'HKEY' }),
      });
      const sol = testConfig.chains['solana-devnet'];
      const helius = sol.endpoints.find(e => e.provider === 'Helius');
      expect(helius!.url).toBe('https://devnet.helius-rpc.com/?api-key=HKEY');
    });
  });
});
