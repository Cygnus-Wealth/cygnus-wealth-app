import type { NetworkEnvironment } from '@cygnus-wealth/data-models';

/**
 * Detects the current network environment from env vars and runtime context.
 *
 * Priority:
 *   1. VITE_NETWORK_ENV (explicit override)
 *   2. CI env var detected → defaults to 'testnet'
 *   3. Falls back to 'production'
 */
export function detectEnvironment(): NetworkEnvironment {
  const explicit = import.meta.env.VITE_NETWORK_ENV as string | undefined;
  if (explicit === 'testnet' || explicit === 'local' || explicit === 'production') {
    return explicit;
  }

  if (import.meta.env.VITE_CI === 'true' || import.meta.env.CI === 'true') {
    return 'testnet';
  }

  return 'production';
}

/** Whether the app is running in a CI pipeline */
export function isCI(): boolean {
  return import.meta.env.VITE_CI === 'true' || import.meta.env.CI === 'true';
}

/** Testnet RPC endpoints per chain for validation */
export const TESTNET_RPC_ENDPOINTS: Record<string, string> = {
  ethereum: 'https://rpc.sepolia.org',
  polygon: 'https://rpc-amoy.polygon.technology',
  arbitrum: 'https://sepolia-rollup.arbitrum.io/rpc',
  optimism: 'https://sepolia.optimism.io',
  solana: 'https://api.devnet.solana.com',
  sui: 'https://fullnode.testnet.sui.io',
};

/** Local dev RPC endpoints */
export const LOCAL_RPC_ENDPOINTS: Record<string, string> = {
  ethereum: 'http://localhost:8545',
};

/** Returns the RPC map for a given environment */
export function getRpcEndpointsForEnv(
  env: NetworkEnvironment,
): Record<string, string> {
  switch (env) {
    case 'testnet':
      return TESTNET_RPC_ENDPOINTS;
    case 'local':
      return LOCAL_RPC_ENDPOINTS;
    case 'production':
      // Production RPCs are handled by the existing rpc.ts config
      return {};
  }
}
