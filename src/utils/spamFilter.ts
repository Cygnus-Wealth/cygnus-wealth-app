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
 * - Its name matches known spam patterns
 * - It has zero balance AND no price data (true dust/spam)
 * - Its valueUsd is negative
 *
 * Tokens with a positive on-chain balance but no price data are NOT
 * considered spam — they are legitimate tokens whose price is simply
 * unavailable. These should still be displayed to the user.
 */
export function isSpamOrWorthless(asset: Asset): boolean {
  // Check name against spam patterns first (always filter spam names)
  const name = asset.name || '';
  if (SPAM_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    return true;
  }

  // Negative value is always invalid
  if (asset.valueUsd != null && !isNaN(asset.valueUsd) && asset.valueUsd < 0) {
    return true;
  }

  // If the token has a positive balance, it's not spam — even if unpriced
  const balance = parseFloat(asset.balance);
  if (!isNaN(balance) && balance > 0) {
    return false;
  }

  // Zero/invalid balance with no price data = worthless
  const hasPrice = asset.priceUsd != null && !isNaN(asset.priceUsd) && asset.priceUsd > 0;
  const hasValue = asset.valueUsd != null && !isNaN(asset.valueUsd) && asset.valueUsd > 0;
  if (!hasPrice && !hasValue) {
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
 * Tokens with no price data but a positive balance are NOT hidden
 * (dust threshold only applies to priced tokens).
 */
export function shouldHideByDefault(asset: Asset, totalValueUsd: number): boolean {
  if (isSpamOrWorthless(asset)) return true;
  // Only apply dust threshold to tokens that have a known USD value
  const hasPrice = asset.priceUsd != null && !isNaN(asset.priceUsd) && asset.priceUsd > 0;
  if (hasPrice && totalValueUsd < DUST_THRESHOLD_USD) return true;
  return false;
}

/**
 * Filters an array of assets, removing spam and worthless tokens.
 */
export function filterSpamTokens(assets: Asset[]): Asset[] {
  return assets.filter(asset => !isSpamOrWorthless(asset));
}
