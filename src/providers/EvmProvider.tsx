import React, { createContext, useContext, useEffect, useState } from 'react';
import { getRpcUrl, getCustomRpcUrl } from '../config/rpc';

interface EvmProviderContextType {
  rpcUrls: Record<number, { http: string; ws: string }>;
  isConfigured: boolean;
}

const EvmProviderContext = createContext<EvmProviderContextType>({
  rpcUrls: {},
  isConfigured: false
});

export function EvmProvider({ children }: { children: React.ReactNode }) {
  const [rpcUrls, setRpcUrls] = useState<Record<number, { http: string; ws: string }>>({});
  
  useEffect(() => {
    // Configure RPC URLs for supported chains
    const chains = [1, 137, 42161, 10]; // Ethereum, Polygon, Arbitrum, Optimism
    const urls: Record<number, { http: string; ws: string }> = {};
    
    chains.forEach(chainId => {
      urls[chainId] = {
        http: getCustomRpcUrl(chainId, 'http') || getRpcUrl(chainId, 'http'),
        ws: getCustomRpcUrl(chainId, 'ws') || getRpcUrl(chainId, 'ws')
      };
    });
    
    setRpcUrls(urls);
    
    // Override the WebSocket URLs in the evm-integration library
    // This is a workaround until the library supports configuration
    if (window.__EVM_INTEGRATION_CONFIG__) {
      window.__EVM_INTEGRATION_CONFIG__.rpcUrls = urls;
    }
  }, []);
  
  return (
    <EvmProviderContext.Provider value={{ rpcUrls, isConfigured: true }}>
      {children}
    </EvmProviderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEvmProvider() {
  return useContext(EvmProviderContext);
}

// Global configuration object
declare global {
  interface Window {
    __EVM_INTEGRATION_CONFIG__?: {
      rpcUrls?: Record<number, { http: string; ws: string }>;
    };
  }
}

// Initialize global config
window.__EVM_INTEGRATION_CONFIG__ = window.__EVM_INTEGRATION_CONFIG__ || {};