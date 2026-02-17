import type { Asset } from '../store/useStore';

/**
 * Known spam token name patterns.
 * Tokens matching these patterns are hidden by default.
 */
const SPAM_NAME_PATTERNS = [
  /visit\s+\S+\.\S+/i,  // "Visit somesite.com"
  /claim\s+/i,           // "Claim your..."
  /airdrop/i,            // Airdrop spam
  /\.com$/i,             // Token name ends with .com
  /\.io$/i,              // Token name ends with .io
  /\.org$/i,             // Token name ends with .org
  /\.net$/i,             // Token name ends with .net
  /free\s+/i,            // "Free ..."
  /reward/i,             // "Reward" tokens
  /bonus/i,              // "Bonus" tokens
];

/**
 * Determines if an asset is spam or worthless.
 * An asset is considered spam/worthless if:
 * - Its valueUsd is 0, null, undefined, NaN, or negative
 * - Its priceUsd is 0, null, undefined, or NaN (unpriced)
 * - Its name matches known spam patterns
 */
export function isSpamOrWorthless(asset: Asset): boolean {
  // Check price: unpriced tokens are considered worthless
  if (asset.priceUsd == null || isNaN(asset.priceUsd) || asset.priceUsd <= 0) {
    return true;
  }

  // Check value: zero or invalid value
  if (asset.valueUsd == null || isNaN(asset.valueUsd) || asset.valueUsd <= 0) {
    return true;
  }

  // Check name against spam patterns
  const name = asset.name || '';
  if (SPAM_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    return true;
  }

  return false;
}

/**
 * Minimum USD value threshold below which tokens are hidden by default.
 * Tokens worth less than this are considered dust.
 */
export const DUST_THRESHOLD_USD = 0.01;

/**
 * Determines if an aggregated asset should be hidden by default.
 * Hides assets that are spam/worthless or below the dust threshold.
 */
export function shouldHideByDefault(asset: Asset, totalValueUsd: number): boolean {
  if (isSpamOrWorthless(asset)) return true;
  if (totalValueUsd < DUST_THRESHOLD_USD) return true;
  return false;
}

/**
 * Filters an array of assets, removing spam and worthless tokens.
 */
export function filterSpamTokens(assets: Asset[]): Asset[] {
  return assets.filter(asset => !isSpamOrWorthless(asset));
}
