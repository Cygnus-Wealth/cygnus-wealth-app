/**
 * buildRpcProviderConfig — Phase 2 of RPC fallback chain (per en-25w5 directive)
 *
 * Reads CYGNUS_RPC_* env vars, constructs provider endpoint URLs from templates,
 * and assembles a per-chain fallback configuration. Missing API keys gracefully
 * degrade to public endpoints.
 */

import type { NetworkEnvironment } from '@cygnus-wealth/data-models';
import type {
  RpcProviderConfig,
  RpcProviderName,
  ProviderEndpoint,
  ChainEndpoints,
} from './rpc-provider-config.types';
import { RPC_ENV_KEYS } from './rpc-provider-config.types';

// ---------------------------------------------------------------------------
// Provider URL templates — key is interpolated at the placeholder
// ---------------------------------------------------------------------------

interface ChainDef {
  chainId: string;
  chainName: string;
}

/** Production EVM chains */
const MAINNET_EVM_CHAINS: ChainDef[] = [
  { chainId: '1', chainName: 'Ethereum' },
  { chainId: '137', chainName: 'Polygon' },
  { chainId: '42161', chainName: 'Arbitrum' },
  { chainId: '10', chainName: 'Optimism' },
  { chainId: '8453', chainName: 'Base' },
];

/** Testnet EVM chains */
const TESTNET_EVM_CHAINS: ChainDef[] = [
  { chainId: '11155111', chainName: 'Sepolia' },
  { chainId: '80002', chainName: 'Polygon Amoy' },
  { chainId: '421614', chainName: 'Arbitrum Sepolia' },
  { chainId: '11155420', chainName: 'Optimism Sepolia' },
  { chainId: '84532', chainName: 'Base Sepolia' },
];

/** Local dev chain */
const LOCAL_EVM_CHAINS: ChainDef[] = [
  { chainId: '1337', chainName: 'Localhost' },
];

// ---------------------------------------------------------------------------
// Alchemy URL templates per chain ID (mainnet + testnet)
// ---------------------------------------------------------------------------

const ALCHEMY_URLS: Record<string, string> = {
  // Mainnet
  '1': 'https://eth-mainnet.g.alchemy.com/v2/',
  '137': 'https://polygon-mainnet.g.alchemy.com/v2/',
  '42161': 'https://arb-mainnet.g.alchemy.com/v2/',
  '10': 'https://opt-mainnet.g.alchemy.com/v2/',
  '8453': 'https://base-mainnet.g.alchemy.com/v2/',
  // Testnet
  '11155111': 'https://eth-sepolia.g.alchemy.com/v2/',
  '80002': 'https://polygon-amoy.g.alchemy.com/v2/',
  '421614': 'https://arb-sepolia.g.alchemy.com/v2/',
  '11155420': 'https://opt-sepolia.g.alchemy.com/v2/',
  '84532': 'https://base-sepolia.g.alchemy.com/v2/',
  // Solana
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
  // Mainnet EVM
  '1': ['https://cloudflare-eth.com', 'https://rpc.ankr.com/eth'],
  '137': ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
  '42161': ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
  '10': ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'],
  '8453': ['https://mainnet.base.org', 'https://rpc.ankr.com/base'],
  // Testnet EVM
  '11155111': ['https://rpc.sepolia.org'],
  '80002': ['https://rpc-amoy.polygon.technology'],
  '421614': ['https://sepolia-rollup.arbitrum.io/rpc'],
  '11155420': ['https://sepolia.optimism.io'],
  '84532': ['https://sepolia.base.org'],
  // Solana
  'solana-mainnet': ['https://rpc.ankr.com/solana', 'https://solana.publicnode.com', 'https://api.mainnet-beta.solana.com'],
  'solana-devnet': ['https://api.devnet.solana.com'],
  // Local
  '1337': ['http://localhost:8545'],
};

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Reads CYGNUS_RPC env vars and assembles a complete RpcProviderConfig
 * with per-chain fallback chains. Missing keys gracefully skip that provider tier.
 *
 * @param env - Target network environment
 * @param envVars - Object with env vars (defaults to import.meta.env at runtime).
 *                  Accepting it as a parameter makes the function pure & testable.
 */
export function buildRpcProviderConfig(
  env: NetworkEnvironment,
  envVars: Record<string, string | undefined> = (typeof import.meta !== 'undefined' ? import.meta.env : {}),
): RpcProviderConfig {
  const keys = readApiKeys(envVars);
  const availableProviders = detectAvailableProviders(keys);
  const evmChains = getEvmChains(env);
  const chains: Record<string, ChainEndpoints> = {};

  // Build EVM chain entries
  for (const chain of evmChains) {
    chains[chain.chainId] = buildEvmChainEndpoints(chain, keys);
  }

  // Build Solana chain entry
  const solChain = getSolanaChain(env);
  chains[solChain.chainId] = buildSolanaChainEndpoints(solChain, keys);

  return { environment: env, chains, availableProviders };
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

function detectAvailableProviders(keys: ApiKeys): RpcProviderName[] {
  const providers: RpcProviderName[] = [];
  if (keys.alchemy) providers.push('alchemy');
  if (keys.drpc) providers.push('drpc');
  if (keys.helius) providers.push('helius');
  if (keys.infura) providers.push('infura');
  if (keys.quicknode) providers.push('quicknode');
  return providers;
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
    case 'production': return { chainId: 'solana-mainnet', chainName: 'Solana' };
    case 'testnet': return { chainId: 'solana-devnet', chainName: 'Solana Devnet' };
    case 'local': return { chainId: 'solana-devnet', chainName: 'Solana Devnet (local)' };
  }
}

/**
 * Build EVM chain endpoints in priority order:
 *   Alchemy > Infura > dRPC > QuickNode > Public
 */
function buildEvmChainEndpoints(chain: ChainDef, keys: ApiKeys): ChainEndpoints {
  const endpoints: ProviderEndpoint[] = [];

  // Alchemy
  if (keys.alchemy && ALCHEMY_URLS[chain.chainId]) {
    endpoints.push({
      url: ALCHEMY_URLS[chain.chainId] + keys.alchemy,
      provider: 'alchemy',
      type: 'http',
    });
  }

  // Infura
  if (keys.infura && INFURA_URLS[chain.chainId]) {
    endpoints.push({
      url: INFURA_URLS[chain.chainId] + keys.infura,
      provider: 'infura',
      type: 'http',
    });
  }

  // dRPC
  if (keys.drpc && DRPC_NETWORK_NAMES[chain.chainId]) {
    endpoints.push({
      url: `https://lb.drpc.org/ogrpc?network=${DRPC_NETWORK_NAMES[chain.chainId]}&dkey=${keys.drpc}`,
      provider: 'drpc',
      type: 'http',
    });
  }

  // QuickNode (generic endpoint pattern — user can override with full URL)
  if (keys.quicknode && QUICKNODE_CHAIN_SLUGS[chain.chainId]) {
    endpoints.push({
      url: `https://${QUICKNODE_CHAIN_SLUGS[chain.chainId]}.quiknode.pro/${keys.quicknode}`,
      provider: 'quicknode',
      type: 'http',
    });
  }

  // Public fallbacks (always present)
  const publicUrls = PUBLIC_ENDPOINTS[chain.chainId] ?? [];
  for (const url of publicUrls) {
    endpoints.push({ url, provider: 'public', type: 'http' });
  }

  return { chainId: chain.chainId, chainName: chain.chainName, endpoints };
}

/**
 * Build Solana chain endpoints in priority order:
 *   Helius > Alchemy > QuickNode > Public
 */
function buildSolanaChainEndpoints(chain: ChainDef, keys: ApiKeys): ChainEndpoints {
  const endpoints: ProviderEndpoint[] = [];

  // Helius (Solana-specific)
  if (keys.helius) {
    const isDevnet = chain.chainId === 'solana-devnet';
    const base = isDevnet
      ? 'https://devnet.helius-rpc.com/?api-key='
      : 'https://mainnet.helius-rpc.com/?api-key=';
    endpoints.push({
      url: base + keys.helius,
      provider: 'helius',
      type: 'http',
    });
  }

  // Alchemy (Solana)
  if (keys.alchemy && ALCHEMY_URLS[chain.chainId]) {
    endpoints.push({
      url: ALCHEMY_URLS[chain.chainId] + keys.alchemy,
      provider: 'alchemy',
      type: 'http',
    });
  }

  // QuickNode (Solana)
  if (keys.quicknode && QUICKNODE_CHAIN_SLUGS[chain.chainId]) {
    endpoints.push({
      url: `https://${QUICKNODE_CHAIN_SLUGS[chain.chainId]}.quiknode.pro/${keys.quicknode}`,
      provider: 'quicknode',
      type: 'http',
    });
  }

  // Public fallbacks
  const publicUrls = PUBLIC_ENDPOINTS[chain.chainId] ?? [];
  for (const url of publicUrls) {
    endpoints.push({ url, provider: 'public', type: 'http' });
  }

  return { chainId: chain.chainId, chainName: chain.chainName, endpoints };
}
