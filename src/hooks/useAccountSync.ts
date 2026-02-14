import { useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AssetValuator } from '@cygnus-wealth/asset-valuator';
import { formatBalance } from '../utils/formatters';
import type { Asset } from '../store/useStore';
import type { NetworkEnvironment } from '@cygnus-wealth/data-models';
import type {
  Chain
} from '@cygnus-wealth/wallet-integration-system';
// Note: ConnectionManager doesn't exist in evm-integration
// import {
//   mapChainToChainId,
//   mapEvmBalanceToBalance,
//   mapTokenToAsset
// } from '@cygnus-wealth/evm-integration';
import { createPublicClient, http, type Address } from 'viem';
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
  // Only subscribe to data values, NOT action functions
  const accounts = useStore(state => state.accounts);
  const networkEnvironment = useStore(state => state.networkEnvironment);

  const chainMap = useMemo(() => getChainMap(networkEnvironment), [networkEnvironment]);

  // Get all wallet accounts with a stable reference based on content
  const walletAccounts = useMemo(
    () => accounts.filter(acc => acc.type === 'wallet' && acc.status === 'connected'),
    [accounts]
  );

  // Stable key representing current wallet accounts
  const accountsKey = useMemo(
    () => walletAccounts.map(a => `${a.id}-${a.address}-${a.platform}`).join(','),
    [walletAccounts]
  );

  // Use a ref to track the last synced accounts to prevent duplicate syncs
  const lastSyncedAccountsRef = useRef<string>('');
  
  // Sync each wallet account
  useEffect(() => {
    console.log('[useAccountSync] Effect triggered, walletAccounts:', walletAccounts.length);

    // Skip if we've already synced these exact accounts
    if (accountsKey === lastSyncedAccountsRef.current) {
      console.log('[useAccountSync] Skipping sync - accounts unchanged');
      return;
    }

    console.log('[useAccountSync] Starting sync for accounts:', accountsKey);

    // Access store actions via getState() to avoid dependency instability
    const { setAssets, calculateTotalValue, setIsLoading } = useStore.getState();

    // Create EVM client for a given chain
    const createEvmClient = (chainName: string) => {
      const chainConfig = chainMap[chainName];
      if (!chainConfig) {
        console.error(`No chain config found for ${chainName}`);
        return createPublicClient({ chain: mainnet, transport: http() });
      }
      return createPublicClient({ chain: chainConfig.chain, transport: http() });
    };

    const syncAccounts = async () => {
      const fetchEvmBalances = async (address: string, chainName: string, accountId: string, accountLabel: string) => {
        console.log(`[fetchEvmBalances] Fetching for ${address} on ${chainName}`);
        const assets: Asset[] = [];

        try {
          const chainConfig = chainMap[chainName];
          if (!chainConfig) {
            console.warn(`No chain config for ${chainName}`);
            return assets;
          }

          const client = createEvmClient(chainName);

          const balance = await client.getBalance({
            address: address as Address
          });

          if (balance > 0n) {
            let priceData = { price: 0 };
            try {
              priceData = await assetValuator.getPrice(chainConfig.symbol, 'USD');
              useStore.getState().updatePrice(chainConfig.symbol, priceData?.price || 0);
            } catch {
              console.warn(`Price not available for ${chainConfig.symbol}`);
            }

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

      for (const account of walletAccounts) {
        if (!account.address) continue;

        try {
          if (account.platform === 'Multi-Chain EVM' && account.metadata?.detectedChains) {
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
            console.log(`Skipping Solana balance fetching for ${account.address} - sol-integration library not yet available`);
          } else if (account.platform === 'SUI') {
            console.log(`Skipping SUI balance fetching for ${account.address} - sui-integration library not yet available`);
          } else if (chainMap[account.platform]) {
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

      setAssets(allAssets);
      calculateTotalValue();
      setIsLoading(false);

      lastSyncedAccountsRef.current = accountsKey;
    };

    syncAccounts();
  }, [accountsKey, walletAccounts, chainMap]);

  return {
    isLoading: useStore(state => state.isLoading),
    assets: useStore(state => state.assets)
  };
}