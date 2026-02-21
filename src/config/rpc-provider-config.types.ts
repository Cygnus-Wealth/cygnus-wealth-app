/**
 * RPC Provider Configuration Types
 *
 * Re-exports canonical types from @cygnus-wealth/rpc-infrastructure
 * and defines app-specific extensions.
 */

import type { NetworkEnvironment } from '@cygnus-wealth/data-models';

// Re-export enums (value + type)
export { RpcProviderRole, RpcProviderType } from '@cygnus-wealth/rpc-infrastructure';

// Re-export interfaces (type-only)
export type {
  RpcEndpointConfig,
  ChainRpcConfig,
  RpcProviderConfig,
  CircuitBreakerConfig,
  RetryConfig,
  HealthCheckConfig,
  UserRpcEndpoint,
  UserRpcConfig,
  PrivacyConfig,
} from '@cygnus-wealth/rpc-infrastructure';

import type { RpcProviderConfig } from '@cygnus-wealth/rpc-infrastructure';

/** Extended config with environment context for downstream consumers */
export interface AppRpcProviderConfig extends RpcProviderConfig {
  /** Network environment this config was built for */
  environment: NetworkEnvironment;
}

/** Options for buildRpcProviderConfig */
export interface BuildRpcConfigOptions {
  /** Env vars containing API keys (defaults to import.meta.env at runtime) */
  envVars?: Record<string, string | undefined>;
  /** Optional user-provided RPC endpoint overrides */
  userConfig?: import('@cygnus-wealth/rpc-infrastructure').UserRpcConfig;
}

/** Environment variable names we read for managed provider API keys */
export const RPC_ENV_KEYS = {
  ALCHEMY: 'VITE_CYGNUS_RPC_ALCHEMY_KEY',
  DRPC: 'VITE_CYGNUS_RPC_DRPC_KEY',
  HELIUS: 'VITE_CYGNUS_RPC_HELIUS_KEY',
  INFURA: 'VITE_CYGNUS_RPC_INFURA_KEY',
  QUICKNODE: 'VITE_CYGNUS_RPC_QUICKNODE_KEY',
} as const;
