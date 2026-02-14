import { useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AssetValuator } from '@cygnus-wealth/asset-valuator';
import { formatBalance } from '../utils/formatters';
import type { Asset } from '../store/useStore';
import type { NetworkEnvironment } from '@cygnus-wealth/data-models';
import {
  WalletManager,
  Chain
} from '@cygnus-wealth/wallet-integration-system';
// Note: ConnectionManager doesn't exist in evm-integration
// import {
//   mapChainToChainId,
//   mapEvmBalanceToBalance,
//   mapTokenToAsset
// } from '@cygnus-wealth/evm-integration';
import { createPublicClient, http, type Address, erc20Abi } from 'viem';
import { mainnet, polygon, arbitrum, optimism, sepolia, polygonAmoy, arbitrumSepolia, optimismSepolia } from 'viem/chains';
import { localhost } from 'viem/chains';

const assetValuator = new AssetValuator();

// Chain mapping for EVM chains
interface ChainMapEntry {
  chain: any;
  chainId: number;
  symbol: string;
  name: string;
}

const productionChainMap: Record<string, ChainMapEntry> = {
  'Ethereum': { chain: mainnet, chainId: 1, symbol: 'ETH', name: 'Ethereum' },
  'Polygon': { chain: polygon, chainId: 137, symbol: 'MATIC', name: 'Polygon' },
  'Arbitrum': { chain: arbitrum, chainId: 42161, symbol: 'ETH', name: 'Arbitrum Ethereum' },
  'Optimism': { chain: optimism, chainId: 10, symbol: 'ETH', name: 'Optimism Ethereum' }
};

const testnetChainMap: Record<string, ChainMapEntry> = {
  'Ethereum': { chain: sepolia, chainId: 11155111, symbol: 'ETH', name: 'Sepolia ETH' },
  'Polygon': { chain: polygonAmoy, chainId: 80002, symbol: 'MATIC', name: 'Polygon Amoy' },
  'Arbitrum': { chain: arbitrumSepolia, chainId: 421614, symbol: 'ETH', name: 'Arbitrum Sepolia' },
  'Optimism': { chain: optimismSepolia, chainId: 11155420, symbol: 'ETH', name: 'Optimism Sepolia' }
};

const localChainMap: Record<string, ChainMapEntry> = {
  'Ethereum': { chain: localhost, chainId: 1337, symbol: 'ETH', name: 'Localhost' },
};

function getChainMap(env: NetworkEnvironment): Record<string, ChainMapEntry> {
  switch (env) {
    case 'testnet': return testnetChainMap;
    case 'local': return localChainMap;
    default: return productionChainMap;
  }
}

// Chain enum mapping for wallet-integration-system compatibility
const chainEnumMap: Record<string, Chain> = {
  'Ethereum': Chain.ETHEREUM,
  'Polygon': Chain.POLYGON,
  'Arbitrum': Chain.ARBITRUM,
  'Optimism': Chain.OPTIMISM
};

export function useAccountSync() {
  const {
    accounts,
    setAssets,
    calculateTotalValue,
    setIsLoading,
    updatePrice,
    networkEnvironment
  } = useStore();

  const chainMap = useMemo(() => getChainMap(networkEnvironment), [networkEnvironment]);

  // ConnectionManager not available - will create clients directly

  // Helper to create EVM client
  const createEvmClient = (chainName: string) => {
    const chainConfig = chainMap[chainName];
    if (!chainConfig) {
      console.error(`No chain config found for ${chainName}`);
      return createPublicClient({
        chain: mainnet,
        transport: http()
      });
    }

    return createPublicClient({
      chain: chainConfig.chain,
      transport: http()
    });
  };

  // Get all wallet accounts
  const walletAccounts = accounts.filter(acc => acc.type === 'wallet' && acc.status === 'connected');

  // Use a ref to track the last synced accounts to prevent infinite loops
  const lastSyncedAccountsRef = useRef<string>('');
  
  // Sync each wallet account
  useEffect(() => {
    console.log('[useAccountSync] Effect triggered, walletAccounts:', walletAccounts.length);
    
    // Create a unique key for current wallet accounts
    const accountsKey = walletAccounts.map(a => `${a.id}-${a.address}-${a.platform}`).join(',');
    
    // Skip if we've already synced these exact accounts
    if (accountsKey === lastSyncedAccountsRef.current) {
      console.log('[useAccountSync] Skipping sync - accounts unchanged');
      return;
    }
    
    console.log('[useAccountSync] Starting sync for accounts:', accountsKey);
    
    const syncAccounts = async () => {
      // Define fetchEvmBalances inside the effect to avoid dependency issues
      const fetchEvmBalances = async (address: string, chainName: string, accountId: string, accountLabel: string) => {
        console.log(`[fetchEvmBalances] Fetching for ${address} on ${chainName}`);
        const assets: Asset[] = [];
        
        try {
          const chainConfig = chainMap[chainName];
          if (!chainConfig) {
            console.warn(`No chain config for ${chainName}`);
            return assets;
          }

          // Create a new client directly
          const client = createEvmClient(chainName);

          // Fetch native token balance
          const balance = await client.getBalance({ 
            address: address as Address 
          });

          // Skip zero balances
          if (balance > 0n) {
            // Get native token price
            let priceData = { price: 0 };
            try {
              priceData = await assetValuator.getPrice(chainConfig.symbol, 'USD');
              updatePrice(chainConfig.symbol, priceData?.price || 0);
            } catch {
              console.warn(`Price not available for ${chainConfig.symbol}`);
            }

            // Create asset entry for native token
            const asset: Asset = {
              id: `${accountId}-${chainConfig.symbol}-${chainName}-${address}`,
              symbol: chainConfig.symbol,
              name: chainConfig.name,
              balance: formatBalance(balance.toString(), 18),
              source: accountLabel,
              chain: chainName,
              accountId: accountId,
              priceUsd: priceData?.price || 0,
              valueUsd: parseFloat(formatBalance(balance.toString(), 18)) * (priceData?.price || 0),
              metadata: {
                address: address,
                isMultiAccount: false
              }
            };
            
            assets.push(asset);
          }

          // TODO: Fetch ERC20 token balances using evm-integration hooks when component-based

        } catch (error) {
          console.error(`Error fetching EVM balances for ${chainName} - ${address}:`, error);
        }

        return assets;
      };
      
      if (walletAccounts.length === 0) {
        console.log('[useAccountSync] No wallet accounts, clearing assets');
        setAssets([]);
        calculateTotalValue();
        lastSyncedAccountsRef.current = '';
        return;
      }

      console.log('[useAccountSync] Beginning asset sync for', walletAccounts.length, 'accounts');
      setIsLoading(true);
      const allAssets: Asset[] = [];
      
      // Check if we have a wallet manager instance (for chain/address info only)
      const walletManager = (window as any).__cygnusWalletManager as WalletManager | undefined;

      for (const account of walletAccounts) {
        if (!account.address) continue;

        try {
          // Handle different platforms
          if (account.platform === 'Multi-Chain EVM' && account.metadata?.detectedChains) {
            // Multi-chain EVM wallet
            const configuredChains = account.metadata?.detectedChains || ['Ethereum'];
            
            for (const chainName of configuredChains) {
              const assets = await fetchEvmBalances(
                account.address,
                chainName,
                account.id,
                account.label
              );
              allAssets.push(...assets);
            }
          } else if (account.platform === 'Solana') {
            // Solana not yet supported - waiting for sol-integration library
            console.log(`Skipping Solana balance fetching for ${account.address} - sol-integration library not yet available`);
            // TODO: Implement when sol-integration library is available
          } else if (account.platform === 'SUI') {
            // SUI not yet supported - waiting for sui-integration library  
            console.log(`Skipping SUI balance fetching for ${account.address} - sui-integration library not yet available`);
            // TODO: Implement when sui-integration library is available
          } else if (chainMap[account.platform]) {
            // Single-chain EVM wallet
            const assets = await fetchEvmBalances(
              account.address,
              account.platform,
              account.id,
              account.label
            );
            allAssets.push(...assets);
          } else {
            console.warn(`Unknown platform: ${account.platform}`);
          }
        } catch (error) {
          console.error(`Failed to sync account ${account.label}:`, error);
        }
      }

      // Update store with all assets
      setAssets(allAssets);
      calculateTotalValue();
      setIsLoading(false);
      
      // Mark these accounts as synced
      lastSyncedAccountsRef.current = accountsKey;
    };

    syncAccounts();
  }, [walletAccounts, setAssets, calculateTotalValue, setIsLoading, updatePrice, networkEnvironment, chainMap]);

  return {
    isLoading: useStore(state => state.isLoading),
    assets: useStore(state => state.assets)
  };
}