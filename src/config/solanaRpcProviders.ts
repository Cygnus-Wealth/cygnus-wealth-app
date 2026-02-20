// Configuration for Solana RPC providers that work from browsers

export interface RpcProvider {
  name: string;
  url: string;
  requiresApiKey: boolean;
  cors: boolean;
  docs: string;
}

export const SOLANA_RPC_PROVIDERS: RpcProvider[] = [
  {
    name: 'Helius',
    url: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
    requiresApiKey: true,
    cors: true,
    docs: 'https://docs.helius.dev/solana-rpc-nodes/api-access'
  },
  {
    name: 'Alchemy',
    url: 'https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    requiresApiKey: true,
    cors: true,
    docs: 'https://docs.alchemy.com/reference/solana-api-quickstart'
  },
  {
    name: 'QuickNode',
    url: 'https://YOUR_ENDPOINT.solana-mainnet.quiknode.pro/YOUR_API_KEY',
    requiresApiKey: true,
    cors: true,
    docs: 'https://www.quicknode.com/chains/sol'
  },
  {
    name: 'Ankr',
    url: 'https://rpc.ankr.com/solana',
    requiresApiKey: true, // Free tier blocked (403), requires premium API key
    cors: false, // Limited CORS support
    docs: 'https://www.ankr.com/rpc/solana/'
  },
  {
    name: 'GetBlock',
    url: 'https://sol.getblock.io/YOUR_API_KEY/mainnet/',
    requiresApiKey: true,
    cors: true,
    docs: 'https://getblock.io/nodes/sol/'
  }
];

export const FREE_LIMITED_ENDPOINTS = [
  'https://api.devnet.solana.com', // Devnet only, allows browser access
  'https://api.testnet.solana.com', // Testnet only, allows browser access
  // Mainnet public endpoints generally block browsers
];

// Example configuration for user settings
export interface UserRpcConfig {
  provider: 'helius' | 'alchemy' | 'quicknode' | 'custom';
  apiKey?: string;
  customUrl?: string;
}

export function getRpcUrl(config: UserRpcConfig): string {
  switch (config.provider) {
    case 'helius':
      return `https://mainnet.helius-rpc.com/?api-key=${config.apiKey || 'demo'}`;
    case 'alchemy':
      return `https://solana-mainnet.g.alchemy.com/v2/${config.apiKey}`;
    case 'quicknode':
      return config.customUrl || '';
    case 'custom':
      return config.customUrl || '';
    default:
      // Fallback - will likely fail from browser
      return 'https://api.mainnet-beta.solana.com';
  }
}