import type { NetworkEnvironment } from '@cygnus-wealth/data-models';
import { detectEnvironment, getRpcEndpointsForEnv } from './environment';
import { getRpcUrl, getCustomRpcUrl } from './rpc';

export interface IntegrationConfig {
  environment: NetworkEnvironment;
  rpcEndpoints: Record<string, string>;
  evmRpcUrls: Record<number, { http: string; ws: string }>;
}

const EVM_CHAINS_BY_ENV: Record<NetworkEnvironment, number[]> = {
  production: [1, 137, 42161, 10],
  testnet: [11155111, 80002, 421614, 11155420],
  local: [1337],
};

/**
 * Central factory that builds a fully-resolved IntegrationConfig
 * for the current (or provided) environment.
 */
export function createIntegrationConfig(
  env?: NetworkEnvironment,
): IntegrationConfig {
  const environment = env ?? detectEnvironment();
  const rpcEndpoints = getRpcEndpointsForEnv(environment);

  const chainIds = EVM_CHAINS_BY_ENV[environment];
  const evmRpcUrls: Record<number, { http: string; ws: string }> = {};

  for (const chainId of chainIds) {
    try {
      evmRpcUrls[chainId] = {
        http: getCustomRpcUrl(chainId, 'http') ?? getRpcUrl(chainId, 'http'),
        ws: getCustomRpcUrl(chainId, 'ws') ?? getRpcUrl(chainId, 'ws'),
      };
    } catch {
      // Chain not configured in rpc.ts — use the environment-level endpoint if available
      const fallbackHttp = rpcEndpoints['ethereum'] ?? '';
      if (fallbackHttp) {
        evmRpcUrls[chainId] = { http: fallbackHttp, ws: '' };
      }
    }
  }

  return { environment, rpcEndpoints, evmRpcUrls };
}
