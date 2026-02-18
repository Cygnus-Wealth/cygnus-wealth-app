import { useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { getDeFiPositions } from '../domain/defi/DeFiPositionService';
import type { RawDeFiData } from '../domain/defi/DeFiPositionService';

export function useDeFiPositions() {
  const accounts = useStore((state) => state.accounts);
  const defiPositions = useStore((state) => state.defiPositions);
  const isLoadingDeFi = useStore((state) => state.isLoadingDeFi);
  const setDeFiPositions = useStore((state) => state.setDeFiPositions);
  const setIsLoadingDeFi = useStore((state) => state.setIsLoadingDeFi);
  const setDeFiError = useStore((state) => state.setDeFiError);

  const connectedAccounts = useMemo(
    () => accounts.filter((acc) => acc.status === 'connected'),
    [accounts]
  );

  useEffect(() => {
    if (connectedAccounts.length === 0) return;

    setIsLoadingDeFi(true);
    setDeFiError(null);

    try {
      // In a real implementation, this would fetch from subgraphs/RPCs
      // For now, we normalize whatever raw data we can gather
      const rawData: RawDeFiData = {};
      const positions = getDeFiPositions(rawData, 'on-chain');
      setDeFiPositions(positions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setDeFiError(message);
    } finally {
      setIsLoadingDeFi(false);
    }
  }, [connectedAccounts.length, setDeFiPositions, setIsLoadingDeFi, setDeFiError]);

  const totalDeFiValue = useMemo(
    () => defiPositions.reduce((sum, p) => sum + p.valueUsd, 0),
    [defiPositions]
  );

  return {
    defiPositions,
    isLoadingDeFi,
    totalDeFiValue,
  };
}
