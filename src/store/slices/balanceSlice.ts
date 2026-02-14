/**
 * Balance Slice for Zustand Store
 * 
 * Manages balance state with progressive loading support.
 * Separates balance and price loading states for optimal performance.
 */

import type { StateCreator } from 'zustand';
import { BalanceAggregate } from '../../domain/asset/BalanceAggregate';
import { LoadingStatus } from '../../domain/asset/AssetLoadingState';

export interface BalanceState {
  // Balance data
  balances: Map<string, BalanceAggregate>;
  
  // Loading states
  balanceLoadingStates: Map<string, LoadingStatus>;
  priceLoadingStates: Map<string, LoadingStatus>;
  
  // Global loading indicators
  isLoadingBalances: boolean;
  isLoadingPrices: boolean;
  
  // Performance metrics
  lastBalanceFetchTime: number | null;
  lastPriceFetchTime: number | null;
  averageBalanceLoadTime: number;
  averagePriceLoadTime: number;
  
  // Error tracking
  balanceErrors: Map<string, string>;
  priceErrors: Map<string, string>;
}

export interface BalanceActions {
  // Balance operations
  setBalance: (accountId: string, balance: BalanceAggregate) => void;
  setBulkBalances: (balances: BalanceAggregate[]) => void;
  updateBalanceLoadingState: (accountId: string, status: LoadingStatus) => void;
  updatePriceLoadingState: (symbol: string, status: LoadingStatus) => void;
  
  // Progressive loading
  startBalanceLoading: (accountIds: string[]) => void;
  completeBalanceLoading: (accountId: string, balance: BalanceAggregate, loadTime: number) => void;
  startPriceLoading: (symbols: string[]) => void;
  completePriceLoading: (symbol: string, loadTime: number) => void;
  
  // Error handling
  setBalanceError: (accountId: string, error: string) => void;
  setPriceError: (symbol: string, error: string) => void;
  clearErrors: () => void;
  
  // Aggregation
  getAggregatedBalances: () => BalanceAggregate[];
  getBalancesByAccount: (accountId: string) => BalanceAggregate[];
  getBalancesByChain: (chain: string) => BalanceAggregate[];
  
  // Cache management
  markBalancesStale: (accountIds: string[]) => void;
  markPricesStale: (symbols: string[]) => void;
  
  // Metrics
  getLoadingMetrics: () => {
    balanceLoadTime: number;
    priceLoadTime: number;
    cacheHitRate: number;
  };
}

export type BalanceSlice = BalanceState & BalanceActions;

export const createBalanceSlice: StateCreator<
  BalanceSlice,
  [],
  [],
  BalanceSlice
> = (set, get) => ({
  // Initial state
  balances: new Map(),
  balanceLoadingStates: new Map(),
  priceLoadingStates: new Map(),
  isLoadingBalances: false,
  isLoadingPrices: false,
  lastBalanceFetchTime: null,
  lastPriceFetchTime: null,
  averageBalanceLoadTime: 0,
  averagePriceLoadTime: 0,
  balanceErrors: new Map(),
  priceErrors: new Map(),

  // Balance operations
  setBalance: (_accountId, balance) => {
    set((state) => {
      const newBalances = new Map(state.balances);
      newBalances.set(balance.getId(), balance);
      return { balances: newBalances };
    });
  },

  setBulkBalances: (balances) => {
    set((state) => {
      const newBalances = new Map(state.balances);
      for (const balance of balances) {
        newBalances.set(balance.getId(), balance);
      }
      return { balances: newBalances };
    });
  },

  updateBalanceLoadingState: (accountId, status) => {
    set((state) => {
      const newStates = new Map(state.balanceLoadingStates);
      newStates.set(accountId, status);
      return { balanceLoadingStates: newStates };
    });
  },

  updatePriceLoadingState: (symbol, status) => {
    set((state) => {
      const newStates = new Map(state.priceLoadingStates);
      newStates.set(symbol, status);
      return { priceLoadingStates: newStates };
    });
  },

  // Progressive loading
  startBalanceLoading: (accountIds) => {
    set((state) => {
      const newStates = new Map(state.balanceLoadingStates);
      for (const id of accountIds) {
        newStates.set(id, LoadingStatus.LOADING);
      }
      return {
        balanceLoadingStates: newStates,
        isLoadingBalances: true
      };
    });
  },

  completeBalanceLoading: (accountId, balance, loadTime) => {
    set((state) => {
      const newBalances = new Map(state.balances);
      const newStates = new Map(state.balanceLoadingStates);
      const newErrors = new Map(state.balanceErrors);
      
      newBalances.set(balance.getId(), balance);
      newStates.set(accountId, LoadingStatus.SUCCESS);
      newErrors.delete(accountId);
      
      // Update average load time
      const currentAvg = state.averageBalanceLoadTime;
      const count = Array.from(state.balanceLoadingStates.values())
        .filter(s => s === LoadingStatus.SUCCESS).length;
      const newAvg = (currentAvg * count + loadTime) / (count + 1);
      
      // Check if all balances are loaded
      const allLoaded = Array.from(newStates.values())
        .every(s => s !== LoadingStatus.LOADING);
      
      return {
        balances: newBalances,
        balanceLoadingStates: newStates,
        balanceErrors: newErrors,
        isLoadingBalances: !allLoaded,
        lastBalanceFetchTime: Date.now(),
        averageBalanceLoadTime: newAvg
      };
    });
  },

  startPriceLoading: (symbols) => {
    set((state) => {
      const newStates = new Map(state.priceLoadingStates);
      for (const symbol of symbols) {
        newStates.set(symbol, LoadingStatus.LOADING);
      }
      return {
        priceLoadingStates: newStates,
        isLoadingPrices: true
      };
    });
  },

  completePriceLoading: (symbol, loadTime) => {
    set((state) => {
      const newStates = new Map(state.priceLoadingStates);
      const newErrors = new Map(state.priceErrors);
      
      newStates.set(symbol, LoadingStatus.SUCCESS);
      newErrors.delete(symbol);
      
      // Update average load time
      const currentAvg = state.averagePriceLoadTime;
      const count = Array.from(state.priceLoadingStates.values())
        .filter(s => s === LoadingStatus.SUCCESS).length;
      const newAvg = (currentAvg * count + loadTime) / (count + 1);
      
      // Check if all prices are loaded
      const allLoaded = Array.from(newStates.values())
        .every(s => s !== LoadingStatus.LOADING);
      
      return {
        priceLoadingStates: newStates,
        priceErrors: newErrors,
        isLoadingPrices: !allLoaded,
        lastPriceFetchTime: Date.now(),
        averagePriceLoadTime: newAvg
      };
    });
  },

  // Error handling
  setBalanceError: (accountId, error) => {
    set((state) => {
      const newErrors = new Map(state.balanceErrors);
      const newStates = new Map(state.balanceLoadingStates);
      
      newErrors.set(accountId, error);
      newStates.set(accountId, LoadingStatus.ERROR);
      
      return {
        balanceErrors: newErrors,
        balanceLoadingStates: newStates
      };
    });
  },

  setPriceError: (symbol, error) => {
    set((state) => {
      const newErrors = new Map(state.priceErrors);
      const newStates = new Map(state.priceLoadingStates);
      
      newErrors.set(symbol, error);
      newStates.set(symbol, LoadingStatus.ERROR);
      
      return {
        priceErrors: newErrors,
        priceLoadingStates: newStates
      };
    });
  },

  clearErrors: () => {
    set({
      balanceErrors: new Map(),
      priceErrors: new Map()
    });
  },

  // Aggregation
  getAggregatedBalances: () => {
    const state = get();
    const aggregated = new Map<string, BalanceAggregate>();
    
    for (const balance of state.balances.values()) {
      const key = balance.getAggregateKey();
      const existing = aggregated.get(key);
      
      if (existing) {
        aggregated.set(key, existing.merge(balance));
      } else {
        aggregated.set(key, balance);
      }
    }
    
    return Array.from(aggregated.values());
  },

  getBalancesByAccount: (accountId) => {
    const state = get();
    return Array.from(state.balances.values())
      .filter(b => b.getAccountId() === accountId);
  },

  getBalancesByChain: (chain) => {
    const state = get();
    return Array.from(state.balances.values())
      .filter(b => b.getChain() === chain);
  },

  // Cache management
  markBalancesStale: (accountIds) => {
    set((state) => {
      const newBalances = new Map(state.balances);
      const newStates = new Map(state.balanceLoadingStates);

      for (const balance of newBalances.values()) {
        if (accountIds.includes(balance.getAccountId())) {
          balance.markStale('balance');
          newStates.set(balance.getAccountId(), LoadingStatus.STALE);
        }
      }

      return {
        balances: newBalances,
        balanceLoadingStates: newStates
      };
    });
  },

  markPricesStale: (symbols) => {
    set((state) => {
      const newBalances = new Map(state.balances);
      const newStates = new Map(state.priceLoadingStates);

      for (const balance of newBalances.values()) {
        if (symbols.includes(balance.getAssetSymbol())) {
          balance.markStale('price');
          newStates.set(balance.getAssetSymbol(), LoadingStatus.STALE);
        }
      }

      return {
        balances: newBalances,
        priceLoadingStates: newStates
      };
    });
  },

  // Metrics
  getLoadingMetrics: () => {
    const state = get();
    
    // Calculate cache hit rate based on loading states
    const totalLoads = state.balanceLoadingStates.size + state.priceLoadingStates.size;
    const cachedLoads = Array.from(state.balances.values())
      .filter(b => b.getLoadingState().isFromCache()).length;
    
    const cacheHitRate = totalLoads > 0 ? (cachedLoads / totalLoads) * 100 : 0;
    
    return {
      balanceLoadTime: state.averageBalanceLoadTime,
      priceLoadTime: state.averagePriceLoadTime,
      cacheHitRate
    };
  }
});