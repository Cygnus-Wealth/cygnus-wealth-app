import { useState, useEffect } from 'react';
import { createPublicClient, http, formatEther, type Address } from 'viem';
import { mainnet, polygon, arbitrum, optimism } from 'viem/chains';
import type { Balance } from '@cygnus-wealth/data-models';
import { getRpcUrl } from '../config/rpc';

const chains = {
  1: mainnet,
  137: polygon,
  42161: arbitrum,
  10: optimism
} as const;

export function useEvmBalanceWithPublicRpc(
  address: Address | undefined,
  chainId: number = 1,
  options: { enabled?: boolean } = {}
) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const refetch = async () => {
    if (!address || !options.enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const chain = chains[chainId as keyof typeof chains] || mainnet;
      const rpcUrl = getRpcUrl(chainId, 'http');
      
      const client = createPublicClient({
        chain,
        transport: http(rpcUrl)
      });

      const balanceWei = await client.getBalance({ address });
      const balanceEth = formatEther(balanceWei);

      const newBalance: Balance = {
        assetId: `eth-${chainId}`,
        asset: {
          id: `eth-${chainId}`,
          symbol: chain.nativeCurrency.symbol,
          name: chain.nativeCurrency.name,
          decimals: chain.nativeCurrency.decimals,
          chain: chain.name as any,
          type: 'NATIVE' as any,
          contractAddress: '0x0000000000000000000000000000000000000000',
          metadata: {}
        },
        amount: balanceEth,
        value: undefined, // Price data would come from a separate service
        metadata: {
          lastUpdated: new Date().toISOString()
        }
      };

      setBalance(newBalance);
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      setError(err as Error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refetch();
    
    // Poll for updates every 15 seconds
    const interval = setInterval(refetch, 15000);
    
    return () => clearInterval(interval);
  }, [address, chainId, options.enabled]);

  return {
    balance,
    isLoading,
    error,
    isConnected,
    refetch
  };
}