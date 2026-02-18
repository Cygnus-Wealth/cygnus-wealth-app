import type { Chain } from '@cygnus-wealth/data-models';

export type DeFiPositionType = 'vault' | 'lending' | 'lp' | 'staking' | 'farming';

export interface UnderlyingAsset {
  symbol: string;
  name: string;
  amount: string;
}

export interface DeFiPosition {
  id: string;
  protocol: string;
  positionType: DeFiPositionType;
  label: string;
  chain: Chain;
  underlyingAssets: UnderlyingAsset[];
  valueUsd: number;
  apy?: number;
  discoverySource: string;
}
