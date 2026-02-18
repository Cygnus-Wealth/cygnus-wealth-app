/**
 * RPC Provider Configuration Types
 *
 * Defines the shape of multi-provider, per-chain RPC fallback configuration.
 * These types will migrate to @cygnus-wealth/data-models once Phase 1 publishes them.
 */

import type { NetworkEnvironment } from '@cygnus-wealth/data-models';

/** Supported RPC provider identifiers */
export type RpcProviderName =
  | 'alchemy'
  | 'drpc'
  | 'helius'
  | 'infura'
  | 'quicknode'
  | 'ankr'
  | 'public';

/** A single RPC endpoint with its provider metadata */
export interface ProviderEndpoint {
  /** Full URL ready for use (API key already interpolated) */
  url: string;
  /** Which provider this endpoint belongs to */
  provider: RpcProviderName;
  /** Connection type */
  type: 'http' | 'ws';
}

/** Per-chain endpoint list ordered by fallback priority (index 0 = highest priority) */
export interface ChainEndpoints {
  /** Numeric chain ID for EVM chains, or string identifier for non-EVM (e.g. 'solana-mainnet') */
  chainId: string;
  /** Human-readable chain name */
  chainName: string;
  /** Ordered fallback list — first healthy endpoint wins */
  endpoints: ProviderEndpoint[];
}

/** Top-level config returned by buildRpcProviderConfig */
export interface RpcProviderConfig {
  /** Environment this config was built for */
  environment: NetworkEnvironment;
  /** Per-chain fallback chains keyed by chain identifier */
  chains: Record<string, ChainEndpoints>;
  /** Which provider API keys were detected at build time */
  availableProviders: RpcProviderName[];
}

/** Environment variable names we read */
export const RPC_ENV_KEYS = {
  ALCHEMY: 'VITE_CYGNUS_RPC_ALCHEMY_KEY',
  DRPC: 'VITE_CYGNUS_RPC_DRPC_KEY',
  HELIUS: 'VITE_CYGNUS_RPC_HELIUS_KEY',
  INFURA: 'VITE_CYGNUS_RPC_INFURA_KEY',
  QUICKNODE: 'VITE_CYGNUS_RPC_QUICKNODE_KEY',
} as const;
