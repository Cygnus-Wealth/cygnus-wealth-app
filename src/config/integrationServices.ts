/**
 * Integration service factories for RPC wiring.
 *
 * Takes an AppRpcProviderConfig and creates properly configured
 * ChainRegistry (EVM) and SolanaIntegrationFacade instances.
 */

import { ChainRegistry } from '@cygnus-wealth/evm-integration';
import { SolanaIntegrationFacade } from '@cygnus-wealth/sol-integration';
import type { AppRpcProviderConfig } from './rpc-provider-config.types';

/** EVM chain IDs (numeric strings) that are supported */
const EVM_CHAIN_IDS = ['1', '137', '42161', '10', '8453', '11155111', '80002', '421614', '11155420', '84532', '1337'];

/**
 * Extract HTTP endpoint URLs for a given EVM chain from config.
 */
export function extractEvmEndpoints(config: AppRpcProviderConfig, chainId: string): string[] {
  const chainConfig = config.chains[chainId];
  if (!chainConfig) return [];
  return chainConfig.endpoints.map(e => e.url);
}

/**
 * Extract Solana endpoint URLs from config (matches solana-mainnet or solana-devnet).
 */
export function extractSolanaEndpoints(config: AppRpcProviderConfig): string[] {
  const solanaKey = Object.keys(config.chains).find(k => k.startsWith('solana-'));
  if (!solanaKey) return [];
  return config.chains[solanaKey].endpoints.map(e => e.url);
}

/**
 * Creates a ChainRegistry configured with RPC endpoints from the provider config.
 * Updates each chain's endpoints to use the fallback URLs from buildRpcProviderConfig.
 */
export function createEvmIntegration(config: AppRpcProviderConfig): InstanceType<typeof ChainRegistry> {
  const registry = new ChainRegistry(config.environment);

  for (const chainId of EVM_CHAIN_IDS) {
    const urls = extractEvmEndpoints(config, chainId);
    if (urls.length > 0) {
      const numericId = parseInt(chainId, 10);
      if (registry.isChainSupported(numericId)) {
        registry.updateChainConfig(numericId, {
          endpoints: { http: urls },
        });
      }
    }
  }

  return registry;
}

/**
 * Creates a SolanaIntegrationFacade configured with RPC endpoints from the provider config.
 */
export function createSolIntegration(config: AppRpcProviderConfig): InstanceType<typeof SolanaIntegrationFacade> {
  const endpoints = extractSolanaEndpoints(config);
  return new SolanaIntegrationFacade({
    environment: config.environment,
    rpcEndpoints: endpoints.length > 0 ? endpoints : undefined,
  });
}
