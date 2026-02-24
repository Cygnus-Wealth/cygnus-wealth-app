import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Balance, NetworkEnvironment } from '@cygnus-wealth/data-models';
import { detectEnvironment } from '../config/environment';
import type { DeFiPosition } from '../domain/defi/DeFiPosition';

/** Persistence key is namespaced by environment so data never leaks across networks */
const detectedEnv = detectEnvironment();
const STORAGE_KEY = `cygnus-wealth-storage-${detectedEnv}`;

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
}

export interface Account {
  id: string;
  type: 'wallet' | 'cex' | 'dex';
  platform: string;
  label: string;
  address?: string;
  apiKey?: string; // Encrypted
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  balances?: Balance[];
  tokens?: Token[]; // ERC20 tokens to track
  metadata?: {
    walletManagerId?: string;
    chains?: string[];
    source?: string;
    walletType?: string;
    detectedChains?: string[];
    currentChainId?: number;
    allAddresses?: string[];
    accountCount?: number;
    useWalletManager?: boolean;
    walletId?: string; // Groups accounts by mnemonic/seed phrase
    connectionType?: string; // MetaMask, Rabby, etc
    walletLabel?: string; // User-friendly label for the wallet/mnemonic
  };
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  balance: string;
  source: string;
  chain: string;
  accountId: string;
  priceUsd: number | null;
  valueUsd: number | null;
  metadata?: {
    address?: string;
    isMultiAccount?: boolean;
  };
}

export interface PortfolioState {
  totalValue: number;
  totalAssets: number;
  lastUpdated: string | null;
}

interface AppState {
  // Network Environment
  networkEnvironment: NetworkEnvironment;
  setNetworkEnvironment: (env: NetworkEnvironment) => void;

  // Accounts
  accounts: Account[];
  addAccount: (account: Account) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  getAccountById: (id: string) => Account | undefined;
  
  // Assets
  assets: Asset[];
  setAssets: (assets: Asset[]) => void;
  addAsset: (asset: Asset) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  getAssetsByAccount: (accountId: string) => Asset[];
  
  // Progressive Loading States
  assetLoadingStates: Map<string, {
    isLoadingBalance: boolean;
    isLoadingPrice: boolean;
    balanceError?: string;
    priceError?: string;
  }>;
  setAssetLoadingState: (assetId: string, state: {
    isLoadingBalance?: boolean;
    isLoadingPrice?: boolean;
    balanceError?: string;
    priceError?: string;
  }) => void;
  getAssetLoadingState: (assetId: string) => {
    isLoadingBalance: boolean;
    isLoadingPrice: boolean;
    balanceError?: string;
    priceError?: string;
  };
  
  // Portfolio
  portfolio: PortfolioState;
  updatePortfolio: (updates: Partial<PortfolioState>) => void;
  calculateTotalValue: () => void;
  
  // Prices
  prices: Record<string, number>;
  updatePrice: (symbol: string, price: number) => void;
  
  // DeFi Positions
  defiPositions: DeFiPosition[];
  setDeFiPositions: (positions: DeFiPosition[]) => void;
  isLoadingDeFi: boolean;
  setIsLoadingDeFi: (loading: boolean) => void;
  defiError: string | null;
  setDeFiError: (error: string | null) => void;

  // Account Selection/Filtering
  selectedAccountIds: Set<string> | null; // null = all accounts selected
  setSelectedAccountIds: (ids: Set<string> | null) => void;
  toggleAccountSelection: (accountId: string) => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      networkEnvironment: detectedEnv,
      setNetworkEnvironment: (env: NetworkEnvironment) => set({ networkEnvironment: env }),

      accounts: [],
      assets: [],
      assetLoadingStates: new Map(),
      portfolio: {
        totalValue: 0,
        totalAssets: 0,
        lastUpdated: null,
      },
      prices: {},
      defiPositions: [],
      isLoadingDeFi: false,
      defiError: null,
      selectedAccountIds: null,
      isLoading: false,
      error: null,

      // Account actions
      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts, account],
        })),

      updateAccount: (id, updates) =>
        set((state) => ({
          accounts: state.accounts.map((acc) =>
            acc.id === id ? { ...acc, ...updates } : acc
          ),
        })),

      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((acc) => acc.id !== id),
          assets: state.assets.filter((asset) => asset.accountId !== id),
        })),

      getAccountById: (id) => {
        const state = get();
        return state.accounts.find((acc) => acc.id === id);
      },

      // Asset actions
      setAssets: (assets) => set({ assets }),

      addAsset: (asset) =>
        set((state) => ({
          assets: [...state.assets, asset],
        })),

      updateAsset: (id, updates) =>
        set((state) => ({
          assets: state.assets.map((asset) =>
            asset.id === id ? { ...asset, ...updates } : asset
          ),
        })),

      removeAsset: (id) =>
        set((state) => ({
          assets: state.assets.filter((asset) => asset.id !== id),
        })),

      getAssetsByAccount: (accountId) => {
        const state = get();
        return state.assets.filter((asset) => asset.accountId === accountId);
      },

      // Progressive Loading State actions
      setAssetLoadingState: (assetId, loadingState) =>
        set((state) => {
          const newStates = new Map(state.assetLoadingStates);
          const current = newStates.get(assetId) || {
            isLoadingBalance: false,
            isLoadingPrice: false
          };
          newStates.set(assetId, { ...current, ...loadingState });
          return { assetLoadingStates: newStates };
        }),

      getAssetLoadingState: (assetId) => {
        const state = get();
        return state.assetLoadingStates.get(assetId) || {
          isLoadingBalance: false,
          isLoadingPrice: false
        };
      },

      // Portfolio actions
      updatePortfolio: (updates) =>
        set((state) => ({
          portfolio: { ...state.portfolio, ...updates },
        })),

      calculateTotalValue: () => {
        const state = get();
        const totalValue = state.assets.reduce(
          (sum, asset) => sum + (asset.valueUsd || 0),
          0
        );
        const totalAssets = state.assets.length;

        set({
          portfolio: {
            totalValue,
            totalAssets,
            lastUpdated: new Date().toISOString(),
          },
        });
      },

      // Price actions
      updatePrice: (symbol, price) =>
        set((state) => ({
          prices: { ...state.prices, [symbol]: price },
        })),

      // DeFi Position actions
      setDeFiPositions: (positions) => set({ defiPositions: positions }),
      setIsLoadingDeFi: (loading) => set({ isLoadingDeFi: loading }),
      setDeFiError: (error) => set({ defiError: error }),

      // Account Selection/Filtering actions
      setSelectedAccountIds: (ids) => set({ selectedAccountIds: ids }),
      toggleAccountSelection: (accountId) => {
        const state = get();
        const walletAccounts = state.accounts.filter(a => a.type === 'wallet');

        if (state.selectedAccountIds === null) {
          // Currently all selected → deselect this one
          const newSet = new Set(walletAccounts.map(a => a.id));
          newSet.delete(accountId);
          set({ selectedAccountIds: newSet });
        } else {
          const newSet = new Set(state.selectedAccountIds);
          if (newSet.has(accountId)) {
            newSet.delete(accountId);
          } else {
            newSet.add(accountId);
          }
          // If all wallet accounts are now selected, reset to null
          const allSelected = walletAccounts.every(a => newSet.has(a.id));
          set({ selectedAccountIds: allSelected ? null : newSet });
        }
      },

      // UI State actions
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accounts: state.accounts.map(acc => ({
          ...acc,
          apiKey: acc.apiKey, // In production, this should be encrypted
        })),
        networkEnvironment: state.networkEnvironment,
        // Cache assets, prices, and portfolio for instant display on page load.
        // Fresh data will overwrite these once useAccountSync completes.
        assets: state.assets,
        prices: state.prices,
        portfolio: state.portfolio,
        defiPositions: state.defiPositions,
        // Persist as array for JSON serialization, rehydrate as Set
        selectedAccountIds: state.selectedAccountIds
          ? Array.from(state.selectedAccountIds)
          : null,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Record<string, unknown>;
        const selectedRaw = persistedState?.selectedAccountIds;
        return {
          ...current,
          ...persistedState,
          selectedAccountIds: Array.isArray(selectedRaw)
            ? new Set(selectedRaw as string[])
            : null,
        };
      },
    }
  )
);