/**
 * RPC endpoint configuration for different blockchain networks
 * 
 * NOTE: Solana and SUI RPC management is handled by @cygnus-wealth/wallet-integration-system
 * which provides WebSocket connections with automatic fallback to HTTP and built-in rate limiting.
 * The configurations below are kept for reference and EVM chain support.
 */

export const RPC_ENDPOINTS = {
  // Solana RPC endpoints (handled by wallet-integration-system)
  // NOTE: Only use HTTPS URLs - the wallet-integration-system will handle WebSocket conversion internally
  solana: [
    'https://solana.publicnode.com',
    'https://api.mainnet-beta.solana.com', // Official Solana RPC
    'https://solana-mainnet.rpc.extrnode.com' // Alternative public RPC
  ],
  
  // SUI RPC endpoints (handled by wallet-integration-system)
  sui: [
    'https://fullnode.mainnet.sui.io',
    'https://rpc.ankr.com/sui',
    'https://sui-mainnet.nodeinfra.com'
  ],
  
  // EVM RPC endpoints (can be expanded per chain if needed)
  ethereum: [
    'https://eth-mainnet.g.alchemy.com/v2/demo',
    'https://rpc.ankr.com/eth',
    'https://cloudflare-eth.com'
  ]
};

// EVM chain-specific RPC endpoints
const EVM_RPC_URLS: Record<number, { http: string; ws: string }> = {
  // Ethereum Mainnet
  1: {
    http: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    ws: 'wss://eth-mainnet.g.alchemy.com/v2/demo'
  },
  // Polygon
  137: {
    http: 'https://polygon-rpc.com',
    ws: 'wss://polygon-rpc.com'
  },
  // Arbitrum
  42161: {
    http: 'https://arb1.arbitrum.io/rpc',
    ws: 'wss://arb1.arbitrum.io/ws'
  },
  // Optimism
  10: {
    http: 'https://mainnet.optimism.io',
    ws: 'wss://mainnet.optimism.io'
  }
};

/**
 * Get the preferred RPC endpoint for a given network
 */
export function getPreferredRpcEndpoint(network: 'solana' | 'sui' | 'ethereum'): string {
  return RPC_ENDPOINTS[network][0];
}

/**
 * Get all RPC endpoints for a given network (for fallback)
 */
export function getRpcEndpoints(network: 'solana' | 'sui' | 'ethereum'): string[] {
  return RPC_ENDPOINTS[network];
}

/**
 * Get RPC URL for a specific EVM chain
 */
export function getRpcUrl(chainId: number, type: 'http' | 'ws' = 'http'): string {
  const urls = EVM_RPC_URLS[chainId];
  if (!urls) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
  return urls[type];
}

/**
 * Get custom RPC URL from environment or local storage
 */
export function getCustomRpcUrl(chainId: number, type: 'http' | 'ws' = 'http'): string | null {
  // Check environment variables first
  const envKey = `VITE_RPC_${chainId}_${type.toUpperCase()}`;
  const envValue = import.meta.env[envKey];
  if (envValue) {
    return envValue;
  }
  
  // Check local storage for user-configured URLs
  try {
    const stored = localStorage.getItem(`rpc_${chainId}_${type}`);
    if (stored) {
      return stored;
    }
  } catch {
    // Local storage might not be available
  }
  
  return null;
}

/**
 * Get next RPC endpoint for fallback
 */
export function getNextRpcEndpoint(network: 'solana' | 'sui' | 'ethereum', currentUrl?: string): string | null {
  const endpoints = RPC_ENDPOINTS[network];
  if (!currentUrl) {
    return endpoints[0];
  }
  
  const currentIndex = endpoints.indexOf(currentUrl);
  if (currentIndex === -1 || currentIndex === endpoints.length - 1) {
    return null; // No more endpoints to try
  }
  
  return endpoints[currentIndex + 1];
}