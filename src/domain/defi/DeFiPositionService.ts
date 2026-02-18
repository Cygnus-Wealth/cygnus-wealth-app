import type {
  LiquidityPosition,
  StakedPosition,
  LendingPosition,
  VaultPosition,
} from '@cygnus-wealth/data-models';
import type { DeFiPosition, DeFiPositionType } from './DeFiPosition';

export interface RawDeFiData {
  liquidityPositions?: LiquidityPosition[];
  stakedPositions?: StakedPosition[];
  lendingPositions?: LendingPosition[];
  vaultPositions?: VaultPosition[];
}

function getValueUsd(value?: { value?: number; amount?: number }): number {
  if (!value) return 0;
  return value.value ?? value.amount ?? 0;
}

export function normalizeLiquidityPosition(
  pos: LiquidityPosition,
  source: string
): DeFiPosition {
  return {
    id: pos.id,
    protocol: pos.protocol,
    positionType: 'lp' as DeFiPositionType,
    label: pos.poolName,
    chain: pos.chain,
    underlyingAssets: (pos.tokens || []).map((t) => ({
      symbol: t.asset?.symbol ?? 'Unknown',
      name: t.asset?.name ?? 'Unknown',
      amount: t.amount,
    })),
    valueUsd: getValueUsd(pos.value),
    discoverySource: source,
  };
}

export function normalizeStakedPosition(
  pos: StakedPosition,
  source: string
): DeFiPosition {
  return {
    id: pos.id,
    protocol: pos.protocol,
    positionType: 'staking' as DeFiPositionType,
    label: `${pos.asset?.symbol ?? 'Unknown'} Staking`,
    chain: pos.chain,
    underlyingAssets: [
      {
        symbol: pos.asset?.symbol ?? 'Unknown',
        name: pos.asset?.name ?? 'Unknown',
        amount: pos.stakedAmount,
      },
    ],
    valueUsd: getValueUsd(pos.value),
    apy: pos.apr,
    discoverySource: source,
  };
}

export function normalizeLendingPosition(
  pos: LendingPosition,
  source: string
): DeFiPosition {
  return {
    id: pos.id,
    protocol: pos.protocol,
    positionType: 'lending' as DeFiPositionType,
    label: `${pos.asset?.symbol ?? 'Unknown'} ${pos.type}`,
    chain: pos.chain,
    underlyingAssets: [
      {
        symbol: pos.asset?.symbol ?? 'Unknown',
        name: pos.asset?.name ?? 'Unknown',
        amount: pos.amount,
      },
    ],
    valueUsd: getValueUsd(pos.value),
    apy: pos.apy,
    discoverySource: source,
  };
}

export function normalizeVaultPosition(
  pos: VaultPosition,
  source: string
): DeFiPosition {
  return {
    id: pos.id,
    protocol: pos.protocol,
    positionType: 'vault' as DeFiPositionType,
    label: pos.vaultName,
    chain: pos.chain,
    underlyingAssets: [
      {
        symbol: pos.depositAsset?.symbol ?? 'Unknown',
        name: pos.depositAsset?.name ?? 'Unknown',
        amount: pos.depositedAmount,
      },
    ],
    valueUsd: getValueUsd(pos.value),
    apy: pos.apy,
    discoverySource: source,
  };
}

export function getDeFiPositions(
  rawData: RawDeFiData,
  source = 'on-chain'
): DeFiPosition[] {
  const positions: DeFiPosition[] = [];

  if (rawData.liquidityPositions) {
    for (const pos of rawData.liquidityPositions) {
      positions.push(normalizeLiquidityPosition(pos, source));
    }
  }

  if (rawData.stakedPositions) {
    for (const pos of rawData.stakedPositions) {
      positions.push(normalizeStakedPosition(pos, source));
    }
  }

  if (rawData.lendingPositions) {
    for (const pos of rawData.lendingPositions) {
      positions.push(normalizeLendingPosition(pos, source));
    }
  }

  if (rawData.vaultPositions) {
    for (const pos of rawData.vaultPositions) {
      positions.push(normalizeVaultPosition(pos, source));
    }
  }

  return positions;
}
