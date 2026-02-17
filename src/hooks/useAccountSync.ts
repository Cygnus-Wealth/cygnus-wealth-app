import { useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import type { Asset } from '../store/useStore';
import type { NetworkEnvironment } from '@cygnus-wealth/data-models';
import { createPublicClient, http, type Address, type Chain } from 'viem';
import { mainnet, polygon, arbitrum, optimism, sepolia, polygonAmoy, arbitrumSepolia, optimismSepolia } from 'viem/chains';
import { base } from 'viem/chains';
import { localhost } from 'viem/chains';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { AssetValuator } from '@cygnus-wealth/asset-valuator';
import { ChainRegistry } from '@cygnus-wealth/evm-integration';
import type { IChainAdapter } from '@cygnus-wealth/evm-integration';

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
  'Optimism': { chain: optimism, chainId: 10, symbol: 'ETH', name: 'Optimism Ethereum' },
  'Base': { chain: base, chainId: 8453, symbol: 'ETH', name: 'Base Ethereum' },
};

const testnetChainMap: Record<string, ChainMapEntry> = {
  'Ethereum': { chain: sepolia, chainId: 11155111, symbol: 'ETH', name: 'Sepolia ETH' },
  'Polygon': { chain: polygonAmoy, chainId: 80002, symbol: 'MATIC', name: 'Polygon Amoy' },
  'Arbitrum': { chain: arbitrumSepolia, chainId: 421614, symbol: 'ETH', name: 'Arbitrum Sepolia' },
  'Optimism': { chain: optimismSepolia, chainId: 11155420, symbol: 'ETH', name: 'Optimism Sepolia' },
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

// Map chain display names to evm-integration registry names
const chainNameToRegistryName: Record<string, string> = {
  'Ethereum': 'Ethereum',
  'Polygon': 'Polygon',
  'Arbitrum': 'Arbitrum One',
  'Optimism': 'Optimism',
  'Base': 'Base',
};

// Create a ChainRegistry instance for ERC20 token discovery
let _registryInstance: InstanceType<typeof ChainRegistry> | null = null;
function getRegistry(): InstanceType<typeof ChainRegistry> {
  if (!_registryInstance) {
    _registryInstance = new ChainRegistry();
  }
  return _registryInstance;
}

// Singleton AssetValuator to avoid re-creating per price call
let _valuatorInstance: InstanceType<typeof AssetValuator> | null = null;
function getValuator(): InstanceType<typeof AssetValuator> {
  if (!_valuatorInstance) {
    _valuatorInstance = new AssetValuator();
  }
  return _valuatorInstance;
}

const SYNC_INTERVAL_MS = 60000; // 60 seconds
const SUI_DECIMALS = 9;
const RPC_TIMEOUT_MS = 15000; // 15s timeout for RPC calls
const PRICE_TIMEOUT_MS = 10000; // 10s timeout for price fetches

/**
 * Race a promise against a timeout. Rejects with a TimeoutError if the
 * timeout fires first.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Fetch price for a symbol using AssetValuator singleton.
 * Returns 0 if price is not available.
 */
async function fetchPrice(symbol: string): Promise<number> {
  try {
    const valuator = getValuator();
    const priceData = await withTimeout(
      valuator.getPrice(symbol),
      PRICE_TIMEOUT_MS,
      `price(${symbol})`,
    );
    return priceData?.price || 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch prices for multiple symbols in parallel, deduplicating symbols.
 * Returns a map of symbol -> priceUsd.
 */
async function fetchPricesBatch(symbols: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(symbols)];
  const results: Record<string, number> = {};

  const settled = await Promise.allSettled(
    unique.map(async (symbol) => {
      const price = await fetchPrice(symbol);
      return { symbol, price };
    })
  );

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results[result.value.symbol] = result.value.price;
    }
  }

  return results;
}

/**
 * Deduplicate assets by ID. When duplicates exist, the last occurrence wins.
 * This prevents accumulation from overlapping syncs.
 */
function deduplicateAssets(assets: Asset[]): Asset[] {
  const assetMap = new Map<string, Asset>();
  for (const asset of assets) {
    assetMap.set(asset.id, asset);
  }
  return Array.from(assetMap.values());
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

  // Stable key representing current wallet accounts (identity-based, not reference-based)
  const accountsKey = useMemo(
    () => walletAccounts.map(a => `${a.id}-${a.address}-${a.platform}`).join(','),
    [walletAccounts]
  );

  // Refs for preventing concurrent syncs and tracking state
  const lastSyncedAccountsRef = useRef<string>('');
  const syncInProgressRef = useRef<boolean>(false);
  const syncAbortRef = useRef<AbortController | null>(null);

  // Use refs for values needed in sync to avoid re-creating the callback
  const walletAccountsRef = useRef(walletAccounts);
  const accountsKeyRef = useRef(accountsKey);
  const chainMapRef = useRef(chainMap);

  // Keep refs in sync
  walletAccountsRef.current = walletAccounts;
  accountsKeyRef.current = accountsKey;
  chainMapRef.current = chainMap;

  // Sync each wallet account
  useEffect(() => {
    console.log('[useAccountSync] Effect triggered, walletAccounts:', walletAccounts.length);

    // Skip if we've already synced these exact accounts
    if (accountsKey === lastSyncedAccountsRef.current) {
      console.log('[useAccountSync] Skipping sync - accounts unchanged');
      return;
    }

    // Abort any in-progress sync when accounts change
    if (syncAbortRef.current) {
      syncAbortRef.current.abort();
    }

    const runSync = async () => {
      // Prevent concurrent syncs
      if (syncInProgressRef.current) {
        console.log('[useAccountSync] Sync already in progress, skipping');
        return;
      }

      const abortController = new AbortController();
      syncAbortRef.current = abortController;
      syncInProgressRef.current = true;

      // Snapshot current values from refs
      const currentWalletAccounts = walletAccountsRef.current;
      const currentAccountsKey = accountsKeyRef.current;
      const currentChainMap = chainMapRef.current;

      const { setAssets, calculateTotalValue, setIsLoading } = useStore.getState();

      const createEvmClient = (chainName: string) => {
        const chainConfig = currentChainMap[chainName];
        if (!chainConfig) {
          console.error(`No chain config found for ${chainName}`);
          return createPublicClient({ chain: mainnet, transport: http() });
        }
        return createPublicClient({ chain: chainConfig.chain, transport: http() });
      };

      /**
       * Fetch EVM balances for a single chain. Returns assets WITHOUT prices
       * so that prices can be batch-fetched later.
       */
      const fetchEvmBalances = async (address: string, chainName: string, accountId: string, accountLabel: string) => {
        console.log(`[fetchEvmBalances] Fetching for ${address} on ${chainName}`);
        const assets: Asset[] = [];

        try {
          const chainConfig = currentChainMap[chainName];
          if (!chainConfig) {
            console.warn(`No chain config for ${chainName}, skipping`);
            return assets;
          }

          // Fetch native balance via viem with timeout
          const client = createEvmClient(chainName);
          const balance = await withTimeout(
            client.getBalance({ address: address as Address }),
            RPC_TIMEOUT_MS,
            `getBalance(${chainName})`,
          );

          if (abortController.signal.aborted) return assets;

          if (balance > 0n) {
            const formattedBalance = (Number(balance) / 1e18).toFixed(6).replace(/\.?0+$/, '');
            assets.push({
              id: `${accountId}-${chainConfig.symbol}-${chainName}-${address}`,
              symbol: chainConfig.symbol,
              name: chainConfig.name,
              balance: formattedBalance,
              source: accountLabel,
              chain: chainName,
              accountId: accountId,
              priceUsd: null,
              valueUsd: null,
              metadata: {
                address: address,
                isMultiAccount: false
              }
            });
          }

          // Fetch ERC20 token balances via @cygnus-wealth/evm-integration
          const registryName = chainNameToRegistryName[chainName];
          if (registryName) {
            try {
              const registry = getRegistry();
              let adapter: IChainAdapter;
              try {
                adapter = registry.getAdapterByName(registryName);
              } catch {
                console.warn(`evm-integration has no adapter for ${registryName}, skipping ERC20 tokens`);
                return assets;
              }
              await withTimeout(adapter.connect(), RPC_TIMEOUT_MS, `connect(${registryName})`);

              if (abortController.signal.aborted) return assets;

              const tokenBalances = await withTimeout(
                adapter.getTokenBalances(address as Address),
                RPC_TIMEOUT_MS,
                `getTokenBalances(${registryName})`,
              );

              for (const tokenBalance of tokenBalances) {
                if (abortController.signal.aborted) return assets;

                const symbol = tokenBalance.asset.symbol;
                const name = tokenBalance.asset.name || symbol;
                const tokenAmount = tokenBalance.amount;
                const parsedBalance = parseFloat(tokenAmount);
                if (isNaN(parsedBalance) || parsedBalance <= 0) continue;

                assets.push({
                  id: `${accountId}-${symbol}-${chainName}-${address}`,
                  symbol,
                  name,
                  balance: tokenAmount,
                  source: accountLabel,
                  chain: chainName,
                  accountId: accountId,
                  priceUsd: null,
                  valueUsd: null,
                  metadata: {
                    address: tokenBalance.asset.contractAddress || undefined,
                    isMultiAccount: false
                  }
                });
              }
            } catch (tokenError) {
              console.error(`Error fetching ERC20 tokens for ${chainName} - ${address}:`, tokenError);
            }
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
          const balanceLamports = await withTimeout(
            connection.getBalance(publicKey),
            RPC_TIMEOUT_MS,
            `solana.getBalance(${address.slice(0, 8)})`,
          );
          const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

          if (balanceSol > 0) {
            assets.push({
              id: `${accountId}-SOL-Solana-${address}`,
              symbol: 'SOL',
              name: 'Solana',
              balance: balanceSol.toString(),
              source: accountLabel,
              chain: 'Solana',
              accountId: accountId,
              priceUsd: null,
              valueUsd: null,
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
          const balanceResult = await withTimeout(
            client.getBalance({ owner: address }),
            RPC_TIMEOUT_MS,
            `sui.getBalance(${address.slice(0, 8)})`,
          );
          const balanceSui = Number(balanceResult.totalBalance) / Math.pow(10, SUI_DECIMALS);

          if (balanceSui > 0) {
            assets.push({
              id: `${accountId}-SUI-SUI-${address}`,
              symbol: 'SUI',
              name: 'Sui',
              balance: balanceSui.toString(),
              source: accountLabel,
              chain: 'SUI',
              accountId: accountId,
              priceUsd: null,
              valueUsd: null,
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

      if (currentWalletAccounts.length === 0) {
        console.log('[useAccountSync] No wallet accounts, clearing assets');
        setAssets([]);
        calculateTotalValue();
        lastSyncedAccountsRef.current = '';
        syncInProgressRef.current = false;
        return;
      }

      console.log('[useAccountSync] Beginning asset sync for', currentWalletAccounts.length, 'accounts');
      setIsLoading(true);

      // Collect lastSync updates to apply in batch after sync completes
      const syncTimestamps: Array<{ id: string; timestamp: string }> = [];

      // ── Phase 1: Fetch all balances in parallel across all accounts/chains ──
      const balancePromises: Promise<{ accountId: string; assets: Asset[] }>[] = [];

      for (const account of currentWalletAccounts) {
        if (abortController.signal.aborted) break;
        if (!account.address) continue;

        if (account.platform === 'Multi-Chain EVM') {
          const configuredChains = account.metadata?.detectedChains || ['Ethereum'];

          // Launch all chains for this account in parallel
          for (const chainName of configuredChains) {
            balancePromises.push(
              fetchEvmBalances(account.address, chainName, account.id, account.label)
                .then(assets => ({ accountId: account.id, assets }))
            );
          }
        } else if (account.platform === 'Solana') {
          balancePromises.push(
            fetchSolanaBalances(account.address, account.id, account.label)
              .then(assets => ({ accountId: account.id, assets }))
          );
        } else if (account.platform === 'SUI') {
          balancePromises.push(
            fetchSuiBalances(account.address, account.id, account.label)
              .then(assets => ({ accountId: account.id, assets }))
          );
        } else if (currentChainMap[account.platform]) {
          balancePromises.push(
            fetchEvmBalances(account.address, account.platform, account.id, account.label)
              .then(assets => ({ accountId: account.id, assets }))
          );
        } else {
          console.warn(`Unknown platform: ${account.platform}`);
        }
      }

      // Wait for ALL balance fetches to complete (or fail individually)
      const balanceResults = await Promise.allSettled(balancePromises);

      if (abortController.signal.aborted) {
        syncInProgressRef.current = false;
        return;
      }

      // Collect all assets and track which accounts completed
      const allAssets: Asset[] = [];
      const completedAccountIds = new Set<string>();

      for (const result of balanceResults) {
        if (result.status === 'fulfilled') {
          allAssets.push(...result.value.assets);
          completedAccountIds.add(result.value.accountId);
        }
      }

      // Record sync timestamps for completed accounts
      const now = new Date().toISOString();
      for (const accountId of completedAccountIds) {
        syncTimestamps.push({ id: accountId, timestamp: now });
      }

      // ── Phase 2: Batch-fetch all prices in parallel ──
      const symbolsToPrice = [...new Set(allAssets.map(a => a.symbol))];
      const priceMap = await fetchPricesBatch(symbolsToPrice);

      if (abortController.signal.aborted) {
        syncInProgressRef.current = false;
        return;
      }

      // Apply prices to assets and update the price store
      const { updatePrice } = useStore.getState();
      for (const [symbol, price] of Object.entries(priceMap)) {
        if (price > 0) {
          updatePrice(symbol, price);
        }
      }

      for (const asset of allAssets) {
        const price = priceMap[asset.symbol] ?? 0;
        asset.priceUsd = price;
        if (price > 0) {
          asset.valueUsd = parseFloat(asset.balance) * price;
        }
      }

      // Don't update state if aborted (component unmounted or new sync started)
      if (abortController.signal.aborted) {
        syncInProgressRef.current = false;
        return;
      }

      // Deduplicate assets by ID to prevent accumulation
      const dedupedAssets = deduplicateAssets(allAssets);

      // Replace all assets atomically
      setAssets(dedupedAssets);
      calculateTotalValue();
      setIsLoading(false);

      // Batch update lastSync timestamps after assets are set
      // Use getState() to avoid triggering re-renders during sync
      const { updateAccount } = useStore.getState();
      for (const { id, timestamp } of syncTimestamps) {
        updateAccount(id, { lastSync: timestamp });
      }

      lastSyncedAccountsRef.current = currentAccountsKey;
      syncInProgressRef.current = false;
    };

    console.log('[useAccountSync] Starting sync for accounts:', accountsKey);
    runSync();

    // Set up periodic sync
    const intervalId = setInterval(() => {
      // Don't force re-sync if one is already in progress
      if (!syncInProgressRef.current) {
        lastSyncedAccountsRef.current = ''; // Allow re-sync
        runSync();
      }
    }, SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      if (syncAbortRef.current) {
        syncAbortRef.current.abort();
      }
    };
    // Only depend on accountsKey (a stable string), not on walletAccounts reference or syncAccounts function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsKey]);

  return {
    isLoading: useStore(state => state.isLoading),
    assets: useStore(state => state.assets)
  };
}
