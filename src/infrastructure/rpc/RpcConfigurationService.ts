/**
 * RPC Configuration Service
 * 
 * Centralized management of RPC endpoints for all supported chains.
 * Provides default configurations, custom endpoint management, health tracking,
 * and persistence to localStorage.
 */

export interface RpcEndpoint {
  url: string;
  name: string;
  isHealthy: boolean;
  lastChecked?: number;
  responseTime?: number;
}

export interface ChainRpcConfig {
  chainId: string;
  defaultEndpoints: RpcEndpoint[];
  customEndpoints: RpcEndpoint[];
  activeEndpoint: string;
}

export type SupportedChain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'bsc' | 'avalanche' | 'base' | 'solana' | 'sui';

export class RpcConfigurationService {
  private static instance: RpcConfigurationService;
  private configs: Map<SupportedChain, ChainRpcConfig>;
  private readonly STORAGE_KEY = 'rpc-configurations';
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.configs = new Map();
    this.initializeDefaultConfigurations();
    this.loadCustomConfigurations();
  }

  public static getInstance(): RpcConfigurationService {
    if (!RpcConfigurationService.instance) {
      RpcConfigurationService.instance = new RpcConfigurationService();
    }
    return RpcConfigurationService.instance;
  }

  /**
   * Initialize default RPC configurations for all supported chains
   */
  private initializeDefaultConfigurations(): void {
    // Ethereum
    this.configs.set('ethereum', {
      chainId: '1',
      defaultEndpoints: [
        { url: 'https://eth-mainnet.g.alchemy.com/v2/demo', name: 'Alchemy', isHealthy: true },
        { url: 'https://rpc.ankr.com/eth', name: 'Ankr', isHealthy: true },
        { url: 'https://cloudflare-eth.com', name: 'Cloudflare', isHealthy: true }
      ],
      customEndpoints: [],
      activeEndpoint: 'https://eth-mainnet.g.alchemy.com/v2/demo'
    });

    // Polygon
    this.configs.set('polygon', {
      chainId: '137',
      defaultEndpoints: [
        { url: 'https://polygon-rpc.com', name: 'Polygon Official', isHealthy: true },
        { url: 'https://rpc.ankr.com/polygon', name: 'Ankr', isHealthy: true }
      ],
      customEndpoints: [],
      activeEndpoint: 'https://polygon-rpc.com'
    });

    // Arbitrum
    this.configs.set('arbitrum', {
      chainId: '42161',
      defaultEndpoints: [
        { url: 'https://arb1.arbitrum.io/rpc', name: 'Arbitrum Official', isHealthy: true },
        { url: 'https://rpc.ankr.com/arbitrum', name: 'Ankr', isHealthy: true }
      ],
      customEndpoints: [],
      activeEndpoint: 'https://arb1.arbitrum.io/rpc'
    });

    // Optimism
    this.configs.set('optimism', {
      chainId: '10',
      defaultEndpoints: [
        { url: 'https://mainnet.optimism.io', name: 'Optimism Official', isHealthy: true },
        { url: 'https://rpc.ankr.com/optimism', name: 'Ankr', isHealthy: true }
      ],
      customEndpoints: [],
      activeEndpoint: 'https://mainnet.optimism.io'
    });

    // BSC
    this.configs.set('bsc', {
      chainId: '56',
      defaultEndpoints: [
        { url: 'https://bsc-dataseed1.binance.org', name: 'Binance', isHealthy: true },
        { url: 'https://rpc.ankr.com/bsc', name: 'Ankr', isHealthy: true }
      ],
      customEndpoints: [],
      activeEndpoint: 'https://bsc-dataseed1.binance.org'
    });

    // Avalanche
    this.configs.set('avalanche', {
      chainId: '43114',
      defaultEndpoints: [
        { url: 'https://api.avax.network/ext/bc/C/rpc', name: 'Avalanche Official', isHealthy: true },
        { url: 'https://rpc.ankr.com/avalanche', name: 'Ankr', isHealthy: true }
      ],
      customEndpoints: [],
      activeEndpoint: 'https://api.avax.network/ext/bc/C/rpc'
    });

    // Base
    this.configs.set('base', {
      chainId: '8453',
      defaultEndpoints: [
        { url: 'https://mainnet.base.org', name: 'Base Official', isHealthy: true },
        { url: 'https://rpc.ankr.com/base', name: 'Ankr', isHealthy: true }
      ],
      customEndpoints: [],
      activeEndpoint: 'https://mainnet.base.org'
    });

    // Solana - with QuickNode endpoint
    this.configs.set('solana', {
      chainId: 'solana-mainnet',
      defaultEndpoints: [
        { 
          url: 'https://wiser-lingering-gas.solana-mainnet.quiknode.pro/160ecd1c42f82d449445981bd36df3db377abc66/', 
          name: 'QuickNode', 
          isHealthy: true 
        },
        { url: 'https://solana.publicnode.com', name: 'PublicNode', isHealthy: true },
        { url: 'https://api.mainnet-beta.solana.com', name: 'Solana Official', isHealthy: true }
      ],
      customEndpoints: [],
      activeEndpoint: 'https://wiser-lingering-gas.solana-mainnet.quiknode.pro/160ecd1c42f82d449445981bd36df3db377abc66/'
    });

    // SUI
    this.configs.set('sui', {
      chainId: 'sui-mainnet',
      defaultEndpoints: [
        { url: 'https://fullnode.mainnet.sui.io', name: 'SUI Official', isHealthy: true },
        { url: 'https://rpc.ankr.com/sui', name: 'Ankr', isHealthy: true },
        { url: 'https://sui-mainnet.nodeinfra.com', name: 'NodeInfra', isHealthy: true }
      ],
      customEndpoints: [],
      activeEndpoint: 'https://fullnode.mainnet.sui.io'
    });
  }

  /**
   * Load custom configurations from localStorage
   */
  private loadCustomConfigurations(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const customConfigs = JSON.parse(stored);
        
        // Merge custom configurations with defaults
        for (const [chain, config] of Object.entries(customConfigs) as Array<[SupportedChain, { customEndpoints?: Array<{ url: string; name: string; isHealthy?: boolean }>; activeEndpoint?: string }]>) {
          const existingConfig = this.configs.get(chain);
          if (existingConfig && config.customEndpoints) {
            existingConfig.customEndpoints = config.customEndpoints.map((endpoint: { url: string; name: string; isHealthy?: boolean }) => ({
              ...endpoint,
              isHealthy: endpoint.isHealthy ?? true
            }));
            
            // Update active endpoint if specified
            if (config.activeEndpoint) {
              existingConfig.activeEndpoint = config.activeEndpoint;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load custom RPC configurations:', error);
    }
  }

  /**
   * Save current configurations to localStorage
   */
  private saveConfigurations(): void {
    try {
      const configsToSave: Record<string, { customEndpoints: RpcEndpoint[]; activeEndpoint: string }> = {};
      
      for (const [chain, config] of this.configs.entries()) {
        configsToSave[chain] = {
          customEndpoints: config.customEndpoints,
          activeEndpoint: config.activeEndpoint
        };
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configsToSave));
    } catch (error) {
      console.warn('Failed to save RPC configurations:', error);
    }
  }

  /**
   * Get the active RPC endpoint for a chain
   */
  public getActiveEndpoint(chain: SupportedChain): string {
    const config = this.configs.get(chain);
    if (!config) {
      throw new Error(`Chain ${chain} is not supported`);
    }
    return config.activeEndpoint;
  }

  /**
   * Get all available endpoints for a chain (default + custom)
   */
  public getAllEndpoints(chain: SupportedChain): RpcEndpoint[] {
    const config = this.configs.get(chain);
    if (!config) {
      throw new Error(`Chain ${chain} is not supported`);
    }
    return [...config.defaultEndpoints, ...config.customEndpoints];
  }

  /**
   * Get healthy endpoints for a chain
   */
  public getHealthyEndpoints(chain: SupportedChain): RpcEndpoint[] {
    return this.getAllEndpoints(chain).filter(endpoint => endpoint.isHealthy);
  }

  /**
   * Set the active endpoint for a chain
   */
  public setActiveEndpoint(chain: SupportedChain, url: string): void {
    const config = this.configs.get(chain);
    if (!config) {
      throw new Error(`Chain ${chain} is not supported`);
    }

    // Verify the endpoint exists
    const allEndpoints = this.getAllEndpoints(chain);
    const endpoint = allEndpoints.find(ep => ep.url === url);
    if (!endpoint) {
      throw new Error(`Endpoint ${url} not found for chain ${chain}`);
    }

    config.activeEndpoint = url;
    this.saveConfigurations();
  }

  /**
   * Add a custom endpoint for a chain
   */
  public addCustomEndpoint(chain: SupportedChain, endpoint: Omit<RpcEndpoint, 'isHealthy'>): void {
    const config = this.configs.get(chain);
    if (!config) {
      throw new Error(`Chain ${chain} is not supported`);
    }

    const newEndpoint: RpcEndpoint = {
      ...endpoint,
      isHealthy: true
    };

    config.customEndpoints.push(newEndpoint);
    this.saveConfigurations();
  }

  /**
   * Remove a custom endpoint
   */
  public removeCustomEndpoint(chain: SupportedChain, url: string): void {
    const config = this.configs.get(chain);
    if (!config) {
      throw new Error(`Chain ${chain} is not supported`);
    }

    config.customEndpoints = config.customEndpoints.filter(ep => ep.url !== url);
    
    // If the removed endpoint was active, switch to default
    if (config.activeEndpoint === url && config.defaultEndpoints.length > 0) {
      config.activeEndpoint = config.defaultEndpoints[0].url;
    }

    this.saveConfigurations();
  }

  /**
   * Update endpoint health status
   */
  public updateEndpointHealth(chain: SupportedChain, url: string, isHealthy: boolean, responseTime?: number): void {
    const config = this.configs.get(chain);
    if (!config) return;

    const updateEndpoint = (endpoints: RpcEndpoint[]) => {
      const endpoint = endpoints.find(ep => ep.url === url);
      if (endpoint) {
        endpoint.isHealthy = isHealthy;
        endpoint.lastChecked = Date.now();
        if (responseTime !== undefined) {
          endpoint.responseTime = responseTime;
        }
      }
    };

    updateEndpoint(config.defaultEndpoints);
    updateEndpoint(config.customEndpoints);
  }

  /**
   * Get the next healthy endpoint for fallback
   */
  public getNextHealthyEndpoint(chain: SupportedChain, currentUrl?: string): string | null {
    const healthyEndpoints = this.getHealthyEndpoints(chain);

    if (healthyEndpoints.length === 0) {
      return null;
    }

    if (!currentUrl) {
      return healthyEndpoints[0].url;
    }

    // If only one healthy endpoint and it's the current one, no fallback available
    if (healthyEndpoints.length === 1 && healthyEndpoints[0].url === currentUrl) {
      return null;
    }

    const currentIndex = healthyEndpoints.findIndex(ep => ep.url === currentUrl);
    if (currentIndex === -1) {
      return healthyEndpoints[0].url;
    }
    if (currentIndex === healthyEndpoints.length - 1) {
      return healthyEndpoints[0].url; // Wrap around to first healthy endpoint
    }

    return healthyEndpoints[currentIndex + 1].url;
  }

  /**
   * Get RPC configuration for a specific chain
   */
  public getChainConfig(chain: SupportedChain): ChainRpcConfig | undefined {
    return this.configs.get(chain);
  }

  /**
   * Get all supported chains
   */
  public getSupportedChains(): SupportedChain[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Health check for an endpoint
   */
  public async checkEndpointHealth(url: string): Promise<{ isHealthy: boolean; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: url.includes('solana') ? 'getHealth' : 'eth_blockNumber',
          params: []
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: response.ok && response.status === 200,
        responseTime
      };
    } catch {
      return {
        isHealthy: false,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Run health checks for all endpoints of a chain
   */
  public async runHealthChecks(chain: SupportedChain): Promise<void> {
    const config = this.configs.get(chain);
    if (!config) return;

    const allEndpoints = this.getAllEndpoints(chain);
    const healthPromises = allEndpoints.map(async (endpoint) => {
      const { isHealthy, responseTime } = await this.checkEndpointHealth(endpoint.url);
      this.updateEndpointHealth(chain, endpoint.url, isHealthy, responseTime);
    });

    await Promise.allSettled(healthPromises);
  }

  /**
   * Start periodic health checks for all chains
   */
  public startPeriodicHealthChecks(): void {
    setInterval(async () => {
      const chains = this.getSupportedChains();
      for (const chain of chains) {
        await this.runHealthChecks(chain);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }
}

// Export singleton instance
export const rpcConfigService = RpcConfigurationService.getInstance();