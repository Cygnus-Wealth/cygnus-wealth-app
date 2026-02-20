import { useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import type { Asset, Token } from '../store/useStore';
import type { NetworkEnvironment } from '@cygnus-wealth/data-models';
import type { Address } from 'viem';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { AssetValuator } from '@cygnus-wealth/asset-valuator';
import type { IChainAdapter, TokenConfig } from '@cygnus-wealth/evm-integration';
import { useIntegration } from '../providers/IntegrationProvider';

// Chain mapping for EVM chains
interface ChainMapEntry {
  chainId: number;
  symbol: string;
  name: string;
}

const productionChainMap: Record<string, ChainMapEntry> = {
  'Ethereum': { chainId: 1, symbol: 'ETH', name: 'Ethereum' },
  'Polygon': { chainId: 137, symbol: 'MATIC', name: 'Polygon' },
  'Arbitrum': { chainId: 42161, symbol: 'ETH', name: 'Arbitrum Ethereum' },
  'Optimism': { chainId: 10, symbol: 'ETH', name: 'Optimism Ethereum' },
  'Base': { chainId: 8453, symbol: 'ETH', name: 'Base Ethereum' },
  'BSC': { chainId: 56, symbol: 'BNB', name: 'BNB Chain' },
  'Avalanche': { chainId: 43114, symbol: 'AVAX', name: 'Avalanche' },
};

const testnetChainMap: Record<string, ChainMapEntry> = {
  'Ethereum': { chainId: 11155111, symbol: 'ETH', name: 'Sepolia ETH' },
  'Polygon': { chainId: 80002, symbol: 'MATIC', name: 'Polygon Amoy' },
  'Arbitrum': { chainId: 421614, symbol: 'ETH', name: 'Arbitrum Sepolia' },
  'Optimism': { chainId: 11155420, symbol: 'ETH', name: 'Optimism Sepolia' },
};

const localChainMap: Record<string, ChainMapEntry> = {
  'Ethereum': { chainId: 1337, symbol: 'ETH', name: 'Localhost' },
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
  'BSC': 'BSC',
  'Avalanche': 'Avalanche',
};

// Well-known ERC20 tokens per chain for comprehensive discovery.
// The evm-integration library's default popular list only includes USDC, USDT, DAI.
// We supplement it with commonly-held tokens so that balances like WETH and PYUSD are discovered.
const WELL_KNOWN_TOKENS: Record<string, TokenConfig[]> = {
  'Ethereum': [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address, symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address, symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address, symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address, symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Address, symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8' as Address, symbol: 'PYUSD', decimals: 6, name: 'PayPal USD' },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' as Address, symbol: 'LINK', decimals: 18, name: 'Chainlink' },
    { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' as Address, symbol: 'UNI', decimals: 18, name: 'Uniswap' },
    { address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as Address, symbol: 'stETH', decimals: 18, name: 'Lido Staked Ether' },
    { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' as Address, symbol: 'AAVE', decimals: 18, name: 'Aave' },
  ],
  'Polygon': [
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as Address, symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as Address, symbol: 'USDC.e', decimals: 6, name: 'Bridged USD Coin' },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as Address, symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' as Address, symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as Address, symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6' as Address, symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' as Address, symbol: 'WMATIC', decimals: 18, name: 'Wrapped Matic' },
    { address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39' as Address, symbol: 'LINK', decimals: 18, name: 'Chainlink' },
  ],
  'Arbitrum': [
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address, symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8' as Address, symbol: 'USDC.e', decimals: 6, name: 'Bridged USD Coin' },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address, symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' as Address, symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address, symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f' as Address, symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0x912CE59144191C1204E64559FE8253a0e49E6548' as Address, symbol: 'ARB', decimals: 18, name: 'Arbitrum' },
    { address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4' as Address, symbol: 'LINK', decimals: 18, name: 'Chainlink' },
  ],
  'Optimism': [
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Address, symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address, symbol: 'USDC.e', decimals: 6, name: 'Bridged USD Coin' },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' as Address, symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' as Address, symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
    { address: '0x4200000000000000000000000000000000000006' as Address, symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095' as Address, symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
    { address: '0x4200000000000000000000000000000000000042' as Address, symbol: 'OP', decimals: 18, name: 'Optimism' },
    { address: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6' as Address, symbol: 'LINK', decimals: 18, name: 'Chainlink' },
  ],
  'Base': [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address, symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' as Address, symbol: 'USDbC', decimals: 6, name: 'Bridged USD Coin' },
    { address: '0x4200000000000000000000000000000000000006' as Address, symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' as Address, symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
    { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22' as Address, symbol: 'cbETH', decimals: 18, name: 'Coinbase Wrapped Staked ETH' },
  ],
};

/**
 * Build a deduplicated token list by merging well-known tokens for the chain
 * with any user-configured tokens from the account.
 */
function buildTokenList(chainName: string, chainId: number, accountTokens: Token[]): TokenConfig[] {
  const wellKnown = WELL_KNOWN_TOKENS[chainName] || [];
  const userConfigs: TokenConfig[] = accountTokens
    .filter(t => t.chainId === chainId)
    .map(t => ({
      address: t.address as Address,
      symbol: t.symbol,
      decimals: t.decimals,
      name: t.name,
    }));

  const seen = new Set<string>();
  const result: TokenConfig[] = [];
  for (const token of [...wellKnown, ...userConfigs]) {
    const key = token.address.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(token);
    }
  }
  return result;
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

  // Get integration services from context (Phase 6 wiring)
  const { evmRegistry, solanaFacade } = useIntegration();

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
  const evmRegistryRef = useRef(evmRegistry);
  const solanaFacadeRef = useRef(solanaFacade);

  // Keep refs in sync
  walletAccountsRef.current = walletAccounts;
  accountsKeyRef.current = accountsKey;
  chainMapRef.current = chainMap;
  evmRegistryRef.current = evmRegistry;
  solanaFacadeRef.current = solanaFacade;

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
      const registry = evmRegistryRef.current;
      const facade = solanaFacadeRef.current;

      const { setAssets, calculateTotalValue, setIsLoading } = useStore.getState();

      /**
       * Fetch EVM balances for a single chain using the integration registry.
       * Returns assets WITHOUT prices so that prices can be batch-fetched later.
       */
      const fetchEvmBalances = async (address: string, chainName: string, accountId: string, accountLabel: string, accountTokens: Token[]) => {
        console.log(`[fetchEvmBalances] Fetching for ${address} on ${chainName}`);
        const assets: Asset[] = [];

        try {
          const chainConfig = currentChainMap[chainName];
          if (!chainConfig) {
            console.warn(`No chain config for ${chainName}, skipping`);
            return assets;
          }

          // Fetch native balance via evm-integration registry adapter
          const registryName = chainNameToRegistryName[chainName];
          if (!registryName) {
            console.warn(`No registry mapping for ${chainName}, skipping`);
            return assets;
          }

          let adapter: IChainAdapter;
          try {
            adapter = registry.getAdapterByName(registryName);
          } catch {
            console.warn(`evm-integration has no adapter for ${registryName}, skipping`);
            return assets;
          }

          await withTimeout(adapter.connect(), RPC_TIMEOUT_MS, `connect(${registryName})`);

          if (abortController.signal.aborted) return assets;

          // Fetch native balance via adapter
          const nativeBalance = await withTimeout(
            adapter.getBalance(address as Address),
            RPC_TIMEOUT_MS,
            `getBalance(${registryName})`,
          );

          if (abortController.signal.aborted) return assets;

          // Use formatted value from value.amount (human-readable) with fallback to raw amount for tests
          const formattedNativeBalance = nativeBalance.value?.amount ?? parseFloat(nativeBalance.amount);
          if (formattedNativeBalance > 0) {
            assets.push({
              id: `${accountId}-${chainConfig.symbol}-${chainName}-${address}`,
              symbol: chainConfig.symbol,
              name: chainConfig.name,
              balance: formattedNativeBalance.toString(),
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

          // Build comprehensive token list from well-known tokens + user-configured tokens
          const tokenList = buildTokenList(chainName, chainConfig.chainId, accountTokens);

          // Fetch ERC20 token balances via adapter with our expanded token list
          const tokenBalances = await withTimeout(
            adapter.getTokenBalances(address as Address, tokenList.length > 0 ? tokenList : undefined),
            RPC_TIMEOUT_MS,
            `getTokenBalances(${registryName})`,
          );

          for (const tokenBalance of tokenBalances) {
            if (abortController.signal.aborted) return assets;

            const symbol = tokenBalance.asset.symbol;
            const name = tokenBalance.asset.name || symbol;
            // Use formatted value from value.amount (human-readable) with fallback to raw amount
            const formattedAmount = tokenBalance.value?.amount ?? parseFloat(tokenBalance.amount);
            if (isNaN(formattedAmount) || formattedAmount <= 0) continue;

            assets.push({
              id: `${accountId}-${symbol}-${chainName}-${address}`,
              symbol,
              name,
              balance: formattedAmount.toString(),
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
        } catch (error) {
          console.error(`Error fetching EVM balances for ${chainName} - ${address}:`, error);
        }

        return assets;
      };

      const fetchSolanaBalances = async (address: string, accountId: string, accountLabel: string) => {
        console.log(`[fetchSolanaBalances] Fetching for ${address}`);
        const assets: Asset[] = [];

        try {
          // Use the shared facade from IntegrationProvider (Phase 6)
          const balanceResult = await withTimeout(
            facade.getSolanaBalance(address),
            RPC_TIMEOUT_MS,
            `solana.getBalance(${address.slice(0, 8)})`,
          );
          if (balanceResult.isSuccess && balanceResult.getValue() > 0) {
            const balanceSol = balanceResult.getValue();

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

          if (abortController.signal.aborted) return assets;

          const tokensResult = await withTimeout(
            facade.getTokenBalances(address),
            RPC_TIMEOUT_MS,
            `solana.getTokenBalances(${address.slice(0, 8)})`,
          );
          if (tokensResult.isSuccess) {
            for (const token of tokensResult.getValue()) {
              if (abortController.signal.aborted) return assets;
              if (token.balance <= 0) continue;

              assets.push({
                id: `${accountId}-${token.symbol}-Solana-${address}`,
                symbol: token.symbol,
                name: token.name,
                balance: token.balance.toString(),
                source: accountLabel,
                chain: 'Solana',
                accountId: accountId,
                priceUsd: null,
                valueUsd: null,
                metadata: {
                  address: token.mint,
                  isMultiAccount: false
                }
              });
            }
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
              fetchEvmBalances(account.address, chainName, account.id, account.label, account.tokens || [])
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
            fetchEvmBalances(account.address, account.platform, account.id, account.label, account.tokens || [])
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
