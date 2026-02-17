/**
 * useProgressiveAssetLoading Hook
 * 
 * Manages progressive loading of balance and price data for individual assets.
 * Provides loading states for each cell to enable non-blocking UI updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import type { Asset } from '../store/useStore';

export interface AssetLoadingState {
  assetId: string;
  isLoadingBalance: boolean;
  isLoadingPrice: boolean;
  balanceError?: string;
  priceError?: string;
  lastBalanceUpdate?: number;
  lastPriceUpdate?: number;
}

export interface ProgressiveLoadingOptions {
  enableBalanceLoading?: boolean;
  enablePriceLoading?: boolean;
  balanceTimeout?: number;
  priceTimeout?: number;
  retryAttempts?: number;
  staggerDelay?: number;
}

export const useProgressiveAssetLoading = (
  assets: Asset[],
  options: ProgressiveLoadingOptions = {}
) => {
  const {
    enableBalanceLoading = true,
    enablePriceLoading = true,
    balanceTimeout = 5000,
    priceTimeout = 3000,
    retryAttempts = 2,
    staggerDelay = 100
  } = options;

  const { updatePrice, prices } = useStore();
  
  // Loading states for each asset
  const [loadingStates, setLoadingStates] = useState<Map<string, AssetLoadingState>>(
    new Map()
  );

  // Track ongoing requests to prevent duplicates
  const activeRequests = useRef<Set<string>>(new Set());
  const retryCounters = useRef<Map<string, number>>(new Map());

  // Initialize loading states for new assets
  useEffect(() => {
    setLoadingStates(prev => {
      const newStates = new Map(prev);
      
      assets.forEach(asset => {
        if (!newStates.has(asset.id)) {
          newStates.set(asset.id, {
            assetId: asset.id,
            isLoadingBalance: false,
            isLoadingPrice: false
          });
        }
      });

      // Remove states for assets that no longer exist
      for (const [assetId] of newStates) {
        if (!assets.find(a => a.id === assetId)) {
          newStates.delete(assetId);
        }
      }

      return newStates;
    });
  }, [assets]);

  // Update loading state for a specific asset
  const updateLoadingState = useCallback((
    assetId: string, 
    updates: Partial<AssetLoadingState>
  ) => {
    setLoadingStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(assetId) || {
        assetId,
        isLoadingBalance: false,
        isLoadingPrice: false
      };
      
      newStates.set(assetId, { ...current, ...updates });
      return newStates;
    });
  }, []);

  // Return the existing balance from the asset (balances are fetched by useAccountSync)
  const loadBalance = useCallback(async (asset: Asset): Promise<string> => {
    const requestKey = `balance-${asset.id}`;

    if (activeRequests.current.has(requestKey)) {
      throw new Error('Request already in progress');
    }

    activeRequests.current.add(requestKey);

    try {
      // Balances are already fetched by useAccountSync — just return the current value
      return asset.balance;
    } finally {
      activeRequests.current.delete(requestKey);
    }
  }, []);

  // Fetch price using AssetValuator
  const loadPrice = useCallback(async (symbol: string): Promise<number> => {
    const requestKey = `price-${symbol}`;

    if (activeRequests.current.has(requestKey)) {
      throw new Error('Request already in progress');
    }

    activeRequests.current.add(requestKey);

    try {
      // Check if we already have a recent price
      const existingPrice = prices[symbol];
      if (existingPrice) {
        return existingPrice;
      }

      const { AssetValuator } = await import('@cygnus-wealth/asset-valuator');
      const valuator = new AssetValuator();
      const priceData = await valuator.getPrice(symbol);
      const price = priceData?.price || 0;
      if (price > 0) {
        updatePrice(symbol, price);
      }
      return price;

    } finally {
      activeRequests.current.delete(requestKey);
    }
  }, [prices, updatePrice]);

  // Load balance for a specific asset
  const loadAssetBalance = useCallback(async (asset: Asset) => {
    if (!enableBalanceLoading) return;

    const retryCount = retryCounters.current.get(`balance-${asset.id}`) || 0;
    if (retryCount >= retryAttempts) return;

    updateLoadingState(asset.id, { 
      isLoadingBalance: true, 
      balanceError: undefined 
    });

    try {
      await Promise.race([
        loadBalance(asset),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), balanceTimeout)
        )
      ]);

      // Update store with new balance (in real implementation)
      updateLoadingState(asset.id, {
        isLoadingBalance: false,
        lastBalanceUpdate: Date.now()
      });

      // Reset retry counter on success
      retryCounters.current.delete(`balance-${asset.id}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      updateLoadingState(asset.id, {
        isLoadingBalance: false,
        balanceError: errorMessage
      });

      // Increment retry counter
      const currentRetries = retryCounters.current.get(`balance-${asset.id}`) || 0;
      retryCounters.current.set(`balance-${asset.id}`, currentRetries + 1);

      // Retry after a delay if we haven't exceeded retry limit
      if (currentRetries < retryAttempts - 1) {
        setTimeout(() => loadAssetBalance(asset), 2000 * (currentRetries + 1));
      }
    }
  }, [enableBalanceLoading, loadBalance, updateLoadingState, balanceTimeout, retryAttempts]);

  // Load price for a specific asset
  const loadAssetPrice = useCallback(async (asset: Asset) => {
    if (!enablePriceLoading) return;

    const retryCount = retryCounters.current.get(`price-${asset.symbol}`) || 0;
    if (retryCount >= retryAttempts) return;

    updateLoadingState(asset.id, { 
      isLoadingPrice: true, 
      priceError: undefined 
    });

    try {
      await Promise.race([
        loadPrice(asset.symbol),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), priceTimeout)
        )
      ]);

      updateLoadingState(asset.id, {
        isLoadingPrice: false,
        lastPriceUpdate: Date.now()
      });

      // Reset retry counter on success
      retryCounters.current.delete(`price-${asset.symbol}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      updateLoadingState(asset.id, {
        isLoadingPrice: false,
        priceError: errorMessage
      });

      // Increment retry counter
      const currentRetries = retryCounters.current.get(`price-${asset.symbol}`) || 0;
      retryCounters.current.set(`price-${asset.symbol}`, currentRetries + 1);

      // Retry after a delay if we haven't exceeded retry limit
      if (currentRetries < retryAttempts - 1) {
        setTimeout(() => loadAssetPrice(asset), 2000 * (currentRetries + 1));
      }
    }
  }, [enablePriceLoading, loadPrice, updateLoadingState, priceTimeout, retryAttempts]);


  // Get loading state for a specific asset
  const getLoadingState = useCallback((assetId: string): AssetLoadingState => {
    return loadingStates.get(assetId) || {
      assetId,
      isLoadingBalance: false,
      isLoadingPrice: false
    };
  }, [loadingStates]);

  // Get overall loading status
  const getOverallStatus = useCallback(() => {
    const states = Array.from(loadingStates.values());
    
    return {
      isLoadingAnyBalance: states.some(s => s.isLoadingBalance),
      isLoadingAnyPrice: states.some(s => s.isLoadingPrice),
      hasBalanceErrors: states.some(s => !!s.balanceError),
      hasPriceErrors: states.some(s => !!s.priceError),
      completedBalances: states.filter(s => !s.isLoadingBalance && !s.balanceError).length,
      completedPrices: states.filter(s => !s.isLoadingPrice && !s.priceError).length,
      totalAssets: assets.length
    };
  }, [loadingStates, assets.length]);

  // Auto-start loading when assets change
  // Using a ref to track if we've already started loading for current assets
  const loadingStartedRef = useRef<string>('');
  
  useEffect(() => {
    // Create a unique key for the current assets to check if we've already started loading
    const assetsKey = assets.map(a => a.id).join(',');

    if (assets.length > 0 && loadingStartedRef.current !== assetsKey) {
      loadingStartedRef.current = assetsKey;

      // Only load prices (balances are already fetched by useAccountSync)
      // Deduplicate by symbol to avoid redundant price lookups
      const symbolsSeen = new Set<string>();
      assets.forEach((asset, index) => {
        if (symbolsSeen.has(asset.symbol)) return;
        symbolsSeen.add(asset.symbol);

        // Stagger price loading to avoid rate limiting
        setTimeout(() => {
          loadAssetPrice(asset);
        }, index * staggerDelay);
      });
    }
  }, [assets, loadAssetPrice, staggerDelay]);

  return {
    loadingStates,
    getLoadingState,
    getOverallStatus,
    loadAssetBalance,
    loadAssetPrice
  };
};