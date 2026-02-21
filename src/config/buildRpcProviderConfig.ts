/**
 * buildRpcProviderConfig — Phase 2: Decentralized-first RPC defaults (per en-tfkn directive)
 *
 * Builds a per-chain RPC fallback configuration with decentralized providers
 * as primary. POKT F-Chains (keyless) is the primary provider for all chains.
 * dRPC is secondary, Lava Network tertiary. Managed providers (Alchemy, Infura,
 * QuickNode, Helius) are demoted to emergency fallback tier.
 *
 * The app works on first launch without any API keys configured.
 */

import type { NetworkEnvironment } from '@cygnus-wealth/data-models';
import {
  RpcProviderRole,
  RpcProviderType,
} from './rpc-provider-config.types';
import type {
  RpcEndpointConfig,
  ChainRpcConfig,
  AppRpcProviderConfig,
  BuildRpcConfigOptions,
} from './rpc-provider-config.types';
import { RPC_ENV_KEYS } from './rpc-provider-config.types';

// ---------------------------------------------------------------------------
// Chain definitions
// ---------------------------------------------------------------------------

interface ChainDef {
  chainId: string;
  numericId: number;
  chainName: string;
}

const MAINNET_EVM_CHAINS: ChainDef[] = [
  { chainId: '1', numericId: 1, chainName: 'Ethereum' },
  { chainId: '137', numericId: 137, chainName: 'Polygon' },
  { chainId: '42161', numericId: 42161, chainName: 'Arbitrum' },
  { chainId: '10', numericId: 10, chainName: 'Optimism' },
  { chainId: '8453', numericId: 8453, chainName: 'Base' },
];

const TESTNET_EVM_CHAINS: ChainDef[] = [
  { chainId: '11155111', numericId: 11155111, chainName: 'Sepolia' },
  { chainId: '80002', numericId: 80002, chainName: 'Polygon Amoy' },
  { chainId: '421614', numericId: 421614, chainName: 'Arbitrum Sepolia' },
  { chainId: '11155420', numericId: 11155420, chainName: 'Optimism Sepolia' },
  { chainId: '84532', numericId: 84532, chainName: 'Base Sepolia' },
];

const LOCAL_EVM_CHAINS: ChainDef[] = [
  { chainId: '1337', numericId: 1337, chainName: 'Localhost' },
];

// ---------------------------------------------------------------------------
// POKT Gateway F-Chains endpoints (keyless, decentralized)
// ---------------------------------------------------------------------------

const POKT_ENDPOINTS: Record<string, string> = {
  // Mainnet
  '1': 'https://eth-mainnet.gateway.pokt.network/v1/lb/libre',
  '137': 'https://poly-mainnet.gateway.pokt.network/v1/lb/libre',
  '42161': 'https://arbitrum-one.gateway.pokt.network/v1/lb/libre',
  '10': 'https://optimism-mainnet.gateway.pokt.network/v1/lb/libre',
  '8453': 'https://base-mainnet.gateway.pokt.network/v1/lb/libre',
  // Testnet
  '11155111': 'https://eth-sepolia.gateway.pokt.network/v1/lb/libre',
  '80002': 'https://polygon-amoy.gateway.pokt.network/v1/lb/libre',
  '421614': 'https://arbitrum-sepolia.gateway.pokt.network/v1/lb/libre',
  '11155420': 'https://optimism-sepolia.gateway.pokt.network/v1/lb/libre',
  '84532': 'https://base-sepolia.gateway.pokt.network/v1/lb/libre',
  // Solana
  'solana-mainnet': 'https://solana-mainnet.gateway.pokt.network/v1/lb/libre',
  'solana-devnet': 'https://solana-devnet.gateway.pokt.network/v1/lb/libre',
};

// ---------------------------------------------------------------------------
// Lava Network endpoints (keyless, decentralized)
// ---------------------------------------------------------------------------

const LAVA_ENDPOINTS: Record<string, string> = {
  // Mainnet
  '1': 'https://eth1.lava.build',
  '137': 'https://polygon1.lava.build',
  '42161': 'https://arbitrum1.lava.build',
  '10': 'https://optimism1.lava.build',
  '8453': 'https://base1.lava.build',
  // Testnet
  '11155111': 'https://eth-sepolia.lava.build',
  '80002': 'https://polygon-amoy.lava.build',
  '421614': 'https://arbitrum-sepolia.lava.build',
  '11155420': 'https://optimism-sepolia.lava.build',
  '84532': 'https://base-sepolia.lava.build',
  // Solana
  'solana-mainnet': 'https://solana1.lava.build',
  'solana-devnet': 'https://solana-devnet.lava.build',
};

// ---------------------------------------------------------------------------
// dRPC network names (requires API key)
// ---------------------------------------------------------------------------

const DRPC_NETWORK_NAMES: Record<string, string> = {
  '1': 'ethereum',
  '137': 'polygon',
  '42161': 'arbitrum',
  '10': 'optimism',
  '8453': 'base',
  '11155111': 'sepolia',
  '80002': 'polygon-amoy',
  '421614': 'arbitrum-sepolia',
  '11155420': 'optimism-sepolia',
  '84532': 'base-sepolia',
};

// ---------------------------------------------------------------------------
// Managed provider URL templates (require API keys — demoted to emergency)
// ---------------------------------------------------------------------------

const ALCHEMY_URLS: Record<string, string> = {
  '1': 'https://eth-mainnet.g.alchemy.com/v2/',
  '137': 'https://polygon-mainnet.g.alchemy.com/v2/',
  '42161': 'https://arb-mainnet.g.alchemy.com/v2/',
  '10': 'https://opt-mainnet.g.alchemy.com/v2/',
  '8453': 'https://base-mainnet.g.alchemy.com/v2/',
  '11155111': 'https://eth-sepolia.g.alchemy.com/v2/',
  '80002': 'https://polygon-amoy.g.alchemy.com/v2/',
  '421614': 'https://arb-sepolia.g.alchemy.com/v2/',
  '11155420': 'https://opt-sepolia.g.alchemy.com/v2/',
  '84532': 'https://base-sepolia.g.alchemy.com/v2/',
  'solana-mainnet': 'https://solana-mainnet.g.alchemy.com/v2/',
  'solana-devnet': 'https://solana-devnet.g.alchemy.com/v2/',
};

const INFURA_URLS: Record<string, string> = {
  '1': 'https://mainnet.infura.io/v3/',
  '137': 'https://polygon-mainnet.infura.io/v3/',
  '42161': 'https://arbitrum-mainnet.infura.io/v3/',
  '10': 'https://optimism-mainnet.infura.io/v3/',
  '8453': 'https://base-mainnet.infura.io/v3/',
  '11155111': 'https://sepolia.infura.io/v3/',
  '80002': 'https://polygon-amoy.infura.io/v3/',
  '421614': 'https://arbitrum-sepolia.infura.io/v3/',
  '11155420': 'https://optimism-sepolia.infura.io/v3/',
  '84532': 'https://base-sepolia.infura.io/v3/',
};

const QUICKNODE_CHAIN_SLUGS: Record<string, string> = {
  '1': 'eth-mainnet',
  '137': 'matic-mainnet',
  '42161': 'arbitrum-mainnet',
  '10': 'optimism',
  '8453': 'base-mainnet',
  '11155111': 'eth-sepolia',
  'solana-mainnet': 'solana-mainnet',
  'solana-devnet': 'solana-devnet',
};

/** Public fallback endpoints (free, no key required) */
const PUBLIC_ENDPOINTS: Record<string, string[]> = {
  '1': ['https://cloudflare-eth.com', 'https://rpc.ankr.com/eth'],
  '137': ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
  '42161': ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
  '10': ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'],
  '8453': ['https://mainnet.base.org', 'https://rpc.ankr.com/base'],
  '11155111': ['https://rpc.sepolia.org'],
  '80002': ['https://rpc-amoy.polygon.technology'],
  '421614': ['https://sepolia-rollup.arbitrum.io/rpc'],
  '11155420': ['https://sepolia.optimism.io'],
  '84532': ['https://sepolia.base.org'],
  'solana-mainnet': ['https://solana.publicnode.com', 'https://api.mainnet-beta.solana.com'],
  'solana-devnet': ['https://api.devnet.solana.com'],
  '1337': ['http://localhost:8545'],
};

// ---------------------------------------------------------------------------
// Default operational configs
// ---------------------------------------------------------------------------

const DEFAULT_CIRCUIT_BREAKER = {
  failureThreshold: 5,
  openDurationMs: 30_000,
  halfOpenMaxAttempts: 2,
  monitorWindowMs: 60_000,
};

const DEFAULT_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
};

const DEFAULT_HEALTH_CHECK = {
  intervalMs: 30_000,
  timeoutMs: 5_000,
  method: 'eth_blockNumber',
};

const DEFAULT_PRIVACY = {
  rotateWithinTier: true,
  privacyMode: false,
  queryJitterMs: 100,
};

const DEFAULT_CHAIN_TIMEOUT_MS = 30_000;
const DEFAULT_CACHE_STALE_MS = 60_000;

// ---------------------------------------------------------------------------
// Rate limits and timeouts per provider type
// ---------------------------------------------------------------------------

const PROVIDER_LIMITS = {
  pokt: { rateLimitRps: 50, timeoutMs: 5_000 },
  drpc: { rateLimitRps: 50, timeoutMs: 5_000 },
  lava: { rateLimitRps: 50, timeoutMs: 5_000 },
  alchemy: { rateLimitRps: 100, timeoutMs: 5_000 },
  infura: { rateLimitRps: 100, timeoutMs: 5_000 },
  quicknode: { rateLimitRps: 100, timeoutMs: 5_000 },
  helius: { rateLimitRps: 100, timeoutMs: 5_000 },
  public: { rateLimitRps: 10, timeoutMs: 10_000 },
} as const;

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Builds a complete RPC provider config with decentralized-first defaults.
 *
 * Priority: POKT (primary) > dRPC (secondary) > Lava (tertiary) > Managed (emergency) > Public (emergency)
 *
 * Works keyless on first launch — no API keys or configuration needed.
 *
 * @param env - Target network environment
 * @param options - Optional env vars and user config overrides
 */
export function buildRpcProviderConfig(
  env: NetworkEnvironment,
  options?: BuildRpcConfigOptions,
): AppRpcProviderConfig {
  const envVars = options?.envVars ?? (typeof import.meta !== 'undefined' ? import.meta.env : {}) as Record<string, string | undefined>;
  const userConfig = options?.userConfig;

  const keys = readApiKeys(envVars);
  const evmChains = getEvmChains(env);
  const chains: Record<string, ChainRpcConfig> = {};

  // Build EVM chain entries
  for (const chain of evmChains) {
    chains[chain.chainId] = buildEvmChainConfig(chain, keys);
  }

  // Build Solana chain entry
  const solChain = getSolanaChain(env);
  chains[solChain.chainId] = buildSolanaChainConfig(solChain, keys);

  return {
    environment: env,
    chains,
    circuitBreaker: DEFAULT_CIRCUIT_BREAKER,
    retry: DEFAULT_RETRY,
    healthCheck: DEFAULT_HEALTH_CHECK,
    privacy: DEFAULT_PRIVACY,
    ...(userConfig ? { userOverrides: userConfig } : {}),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ApiKeys {
  alchemy?: string;
  drpc?: string;
  helius?: string;
  infura?: string;
  quicknode?: string;
}

function readApiKeys(envVars: Record<string, string | undefined>): ApiKeys {
  const clean = (v: string | undefined): string | undefined => {
    if (!v || v.trim() === '') return undefined;
    return v.trim();
  };
  return {
    alchemy: clean(envVars[RPC_ENV_KEYS.ALCHEMY]),
    drpc: clean(envVars[RPC_ENV_KEYS.DRPC]),
    helius: clean(envVars[RPC_ENV_KEYS.HELIUS]),
    infura: clean(envVars[RPC_ENV_KEYS.INFURA]),
    quicknode: clean(envVars[RPC_ENV_KEYS.QUICKNODE]),
  };
}

function getEvmChains(env: NetworkEnvironment): ChainDef[] {
  switch (env) {
    case 'production': return MAINNET_EVM_CHAINS;
    case 'testnet': return TESTNET_EVM_CHAINS;
    case 'local': return LOCAL_EVM_CHAINS;
  }
}

function getSolanaChain(env: NetworkEnvironment): ChainDef {
  switch (env) {
    case 'production': return { chainId: 'solana-mainnet', numericId: 101, chainName: 'Solana' };
    case 'testnet': return { chainId: 'solana-devnet', numericId: 103, chainName: 'Solana Devnet' };
    case 'local': return { chainId: 'solana-devnet', numericId: 103, chainName: 'Solana Devnet (local)' };
  }
}

/**
 * Build EVM chain config with decentralized-first priority:
 *   POKT (PRIMARY) > dRPC (SECONDARY) > Lava (TERTIARY) > Alchemy/Infura/QuickNode (EMERGENCY) > Public (EMERGENCY)
 */
function buildEvmChainConfig(chain: ChainDef, keys: ApiKeys): ChainRpcConfig {
  const endpoints: RpcEndpointConfig[] = [];

  // PRIMARY: POKT Gateway (keyless)
  if (POKT_ENDPOINTS[chain.chainId]) {
    endpoints.push({
      url: POKT_ENDPOINTS[chain.chainId],
      provider: 'POKT Gateway',
      role: RpcProviderRole.PRIMARY,
      type: RpcProviderType.DECENTRALIZED,
      rateLimitRps: PROVIDER_LIMITS.pokt.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.pokt.timeoutMs,
    });
  }

  // SECONDARY: dRPC (requires key)
  if (keys.drpc && DRPC_NETWORK_NAMES[chain.chainId]) {
    endpoints.push({
      url: `https://lb.drpc.org/ogrpc?network=${DRPC_NETWORK_NAMES[chain.chainId]}&dkey=${keys.drpc}`,
      provider: 'dRPC',
      role: RpcProviderRole.SECONDARY,
      type: RpcProviderType.DECENTRALIZED,
      rateLimitRps: PROVIDER_LIMITS.drpc.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.drpc.timeoutMs,
    });
  }

  // TERTIARY: Lava Network (keyless)
  if (LAVA_ENDPOINTS[chain.chainId]) {
    endpoints.push({
      url: LAVA_ENDPOINTS[chain.chainId],
      provider: 'Lava Network',
      role: RpcProviderRole.TERTIARY,
      type: RpcProviderType.DECENTRALIZED,
      rateLimitRps: PROVIDER_LIMITS.lava.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.lava.timeoutMs,
    });
  }

  // EMERGENCY: Managed providers (demoted)
  if (keys.alchemy && ALCHEMY_URLS[chain.chainId]) {
    endpoints.push({
      url: ALCHEMY_URLS[chain.chainId] + keys.alchemy,
      provider: 'Alchemy',
      role: RpcProviderRole.EMERGENCY,
      type: RpcProviderType.MANAGED,
      rateLimitRps: PROVIDER_LIMITS.alchemy.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.alchemy.timeoutMs,
    });
  }

  if (keys.infura && INFURA_URLS[chain.chainId]) {
    endpoints.push({
      url: INFURA_URLS[chain.chainId] + keys.infura,
      provider: 'Infura',
      role: RpcProviderRole.EMERGENCY,
      type: RpcProviderType.MANAGED,
      rateLimitRps: PROVIDER_LIMITS.infura.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.infura.timeoutMs,
    });
  }

  if (keys.quicknode && QUICKNODE_CHAIN_SLUGS[chain.chainId]) {
    endpoints.push({
      url: `https://${QUICKNODE_CHAIN_SLUGS[chain.chainId]}.quiknode.pro/${keys.quicknode}`,
      provider: 'QuickNode',
      role: RpcProviderRole.EMERGENCY,
      type: RpcProviderType.MANAGED,
      rateLimitRps: PROVIDER_LIMITS.quicknode.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.quicknode.timeoutMs,
    });
  }

  // EMERGENCY: Public fallbacks (always present)
  const publicUrls = PUBLIC_ENDPOINTS[chain.chainId] ?? [];
  for (const url of publicUrls) {
    endpoints.push({
      url,
      provider: 'Public',
      role: RpcProviderRole.EMERGENCY,
      type: RpcProviderType.PUBLIC,
      rateLimitRps: PROVIDER_LIMITS.public.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.public.timeoutMs,
    });
  }

  return {
    chainId: chain.numericId,
    chainName: chain.chainName,
    endpoints,
    totalOperationTimeoutMs: DEFAULT_CHAIN_TIMEOUT_MS,
    cacheStaleAcceptanceMs: DEFAULT_CACHE_STALE_MS,
  };
}

/**
 * Build Solana chain config with dual-path support:
 *   Standard RPC: POKT (PRIMARY) > Helius (SECONDARY, DAS-capable) > Lava (TERTIARY) > Alchemy/QuickNode (EMERGENCY) > Public (EMERGENCY)
 */
function buildSolanaChainConfig(chain: ChainDef, keys: ApiKeys): ChainRpcConfig {
  const endpoints: RpcEndpointConfig[] = [];

  // PRIMARY: POKT Gateway for standard RPC (keyless)
  if (POKT_ENDPOINTS[chain.chainId]) {
    endpoints.push({
      url: POKT_ENDPOINTS[chain.chainId],
      provider: 'POKT Gateway',
      role: RpcProviderRole.PRIMARY,
      type: RpcProviderType.DECENTRALIZED,
      rateLimitRps: PROVIDER_LIMITS.pokt.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.pokt.timeoutMs,
    });
  }

  // SECONDARY: Helius for DAS API + standard RPC (requires key)
  if (keys.helius) {
    const isDevnet = chain.chainId === 'solana-devnet';
    const base = isDevnet
      ? 'https://devnet.helius-rpc.com/?api-key='
      : 'https://mainnet.helius-rpc.com/?api-key=';
    endpoints.push({
      url: base + keys.helius,
      provider: 'Helius',
      role: RpcProviderRole.SECONDARY,
      type: RpcProviderType.MANAGED,
      rateLimitRps: PROVIDER_LIMITS.helius.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.helius.timeoutMs,
    });
  }

  // TERTIARY: Lava Network (keyless)
  if (LAVA_ENDPOINTS[chain.chainId]) {
    endpoints.push({
      url: LAVA_ENDPOINTS[chain.chainId],
      provider: 'Lava Network',
      role: RpcProviderRole.TERTIARY,
      type: RpcProviderType.DECENTRALIZED,
      rateLimitRps: PROVIDER_LIMITS.lava.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.lava.timeoutMs,
    });
  }

  // EMERGENCY: Managed providers (demoted)
  if (keys.alchemy && ALCHEMY_URLS[chain.chainId]) {
    endpoints.push({
      url: ALCHEMY_URLS[chain.chainId] + keys.alchemy,
      provider: 'Alchemy',
      role: RpcProviderRole.EMERGENCY,
      type: RpcProviderType.MANAGED,
      rateLimitRps: PROVIDER_LIMITS.alchemy.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.alchemy.timeoutMs,
    });
  }

  if (keys.quicknode && QUICKNODE_CHAIN_SLUGS[chain.chainId]) {
    endpoints.push({
      url: `https://${QUICKNODE_CHAIN_SLUGS[chain.chainId]}.quiknode.pro/${keys.quicknode}`,
      provider: 'QuickNode',
      role: RpcProviderRole.EMERGENCY,
      type: RpcProviderType.MANAGED,
      rateLimitRps: PROVIDER_LIMITS.quicknode.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.quicknode.timeoutMs,
    });
  }

  // EMERGENCY: Public fallbacks
  const publicUrls = PUBLIC_ENDPOINTS[chain.chainId] ?? [];
  for (const url of publicUrls) {
    endpoints.push({
      url,
      provider: 'Public',
      role: RpcProviderRole.EMERGENCY,
      type: RpcProviderType.PUBLIC,
      rateLimitRps: PROVIDER_LIMITS.public.rateLimitRps,
      timeoutMs: PROVIDER_LIMITS.public.timeoutMs,
    });
  }

  return {
    chainId: chain.numericId,
    chainName: chain.chainName,
    endpoints,
    totalOperationTimeoutMs: DEFAULT_CHAIN_TIMEOUT_MS,
    cacheStaleAcceptanceMs: DEFAULT_CACHE_STALE_MS,
  };
}
