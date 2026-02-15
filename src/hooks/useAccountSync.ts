import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { formatBalance } from '../utils/formatters';
import type { Asset } from '../store/useStore';
import type { NetworkEnvironment } from '@cygnus-wealth/data-models';
import { createPublicClient, http, type Address, type Chain } from 'viem';
import { mainnet, polygon, arbitrum, optimism, sepolia, polygonAmoy, arbitrumSepolia, optimismSepolia } from 'viem/chains';
import { localhost } from 'viem/chains';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { AssetValuator } from '@cygnus-wealth/asset-valuator';

// Chain mapping for EVM chains
interface ChainMapEntry {
  chain: Chain;
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

const SYNC_INTERVAL_MS = 60000; // 60 seconds
const SUI_DECIMALS = 9;

/**
 * Fetch price for a symbol using AssetValuator.
 * Returns 0 if price is not available.
 */
async function fetchPrice(symbol: string): Promise<number> {
  try {
    const valuator = new AssetValuator();
    const priceData = await valuator.getPrice(symbol);
    return priceData?.price || 0;
  } catch {
    return 0;
  }
}

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

  const syncAccounts = useCallback(async () => {
    const { setAssets, calculateTotalValue, setIsLoading, updateAccount } = useStore.getState();

    // Create EVM client for a given chain
    const createEvmClient = (chainName: string) => {
      const chainConfig = chainMap[chainName];
      if (!chainConfig) {
        console.error(`No chain config found for ${chainName}`);
        return createPublicClient({ chain: mainnet, transport: http() });
      }
      return createPublicClient({ chain: chainConfig.chain, transport: http() });
    };

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
          const priceData = { price: 0 };
          try {
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

        // Fetch ERC20 token balances
        try {
          const response = await fetch(`https://api.ethplorer.io/getAddressInfo/${address}?apiKey=freekey`);
          if (response.ok) {
            const data = await response.json();
            if (data.tokens && Array.isArray(data.tokens)) {
              for (const token of data.tokens) {
                if (!token.tokenInfo?.decimals || !token.tokenInfo?.symbol) continue;
                const decimals = parseInt(token.tokenInfo.decimals);
                if (isNaN(decimals)) continue;
                const tokenBalance = formatBalance(String(token.balance), decimals);
                if (isNaN(parseFloat(tokenBalance))) continue;

                assets.push({
                  id: `${accountId}-${token.tokenInfo.symbol}-${chainName}-${address}`,
                  symbol: token.tokenInfo.symbol,
                  name: token.tokenInfo.name || token.tokenInfo.symbol,
                  balance: tokenBalance,
                  source: accountLabel,
                  chain: chainName,
                  accountId: accountId,
                  priceUsd: 0,
                  valueUsd: 0,
                  metadata: {
                    address: token.tokenInfo.address,
                    isMultiAccount: false
                  }
                });
              }
            }
          }
        } catch (tokenError) {
          console.error(`Error fetching ERC20 tokens for ${chainName} - ${address}:`, tokenError);
        }

      } catch (error) {
        console.error(`Error fetching EVM balances for ${chainName} - ${address}:`, error);
      }

      return assets;
    };

    const fetchSolanaBalances = async (address: string, accountId: string, accountLabel: string) => {
      console.log(`[fetchSolanaBalances] Fetching for ${address}`);
      const assets: Asset[] = [];

      try {
        const connection = new Connection('https://api.mainnet-beta.solana.com');
        const publicKey = new PublicKey(address);
        const balanceLamports = await connection.getBalance(publicKey);
        const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

        if (balanceSol > 0) {
          const priceUsd = await fetchPrice('SOL');

          assets.push({
            id: `${accountId}-SOL-Solana-${address}`,
            symbol: 'SOL',
            name: 'Solana',
            balance: balanceSol.toString(),
            source: accountLabel,
            chain: 'Solana',
            accountId: accountId,
            priceUsd,
            valueUsd: balanceSol * priceUsd,
            metadata: {
              address,
              isMultiAccount: false
            }
          });
        }
      } catch (error) {
        console.error(`Error fetching Solana balance for ${address}:`, error);
      }

      return assets;
    };

    const fetchSuiBalances = async (address: string, accountId: string, accountLabel: string) => {
      console.log(`[fetchSuiBalances] Fetching for ${address}`);
      const assets: Asset[] = [];

      try {
        const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
        const balanceResult = await client.getBalance({ owner: address });
        const balanceSui = Number(balanceResult.totalBalance) / Math.pow(10, SUI_DECIMALS);

        if (balanceSui > 0) {
          const priceUsd = await fetchPrice('SUI');

          assets.push({
            id: `${accountId}-SUI-SUI-${address}`,
            symbol: 'SUI',
            name: 'Sui',
            balance: balanceSui.toString(),
            source: accountLabel,
            chain: 'SUI',
            accountId: accountId,
            priceUsd,
            valueUsd: balanceSui * priceUsd,
            metadata: {
              address,
              isMultiAccount: false
            }
          });
        }
      } catch (error) {
        console.error(`Error fetching SUI balance for ${address}:`, error);
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
        if (account.platform === 'Multi-Chain EVM') {
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
          const assets = await fetchSolanaBalances(
            account.address,
            account.id,
            account.label
          );
          allAssets.push(...assets);
        } else if (account.platform === 'SUI') {
          const assets = await fetchSuiBalances(
            account.address,
            account.id,
            account.label
          );
          allAssets.push(...assets);
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

        // Update last sync time for the account
        updateAccount(account.id, { lastSync: new Date().toISOString() });
      } catch (error) {
        console.error(`Failed to sync account ${account.label}:`, error);
        // Still update lastSync even on error
        updateAccount(account.id, { lastSync: new Date().toISOString() });
      }
    }

    setAssets(allAssets);
    calculateTotalValue();
    setIsLoading(false);

    lastSyncedAccountsRef.current = accountsKey;
  }, [walletAccounts, accountsKey, chainMap]);

  // Sync each wallet account
  useEffect(() => {
    console.log('[useAccountSync] Effect triggered, walletAccounts:', walletAccounts.length);

    // Skip if we've already synced these exact accounts
    if (accountsKey === lastSyncedAccountsRef.current) {
      console.log('[useAccountSync] Skipping sync - accounts unchanged');
      return;
    }

    console.log('[useAccountSync] Starting sync for accounts:', accountsKey);

    syncAccounts();

    // Set up periodic sync
    const intervalId = setInterval(() => {
      lastSyncedAccountsRef.current = ''; // Force re-sync
      syncAccounts();
    }, SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [accountsKey, walletAccounts, chainMap, syncAccounts]);

  return {
    isLoading: useStore(state => state.isLoading),
    assets: useStore(state => state.assets)
  };
}
