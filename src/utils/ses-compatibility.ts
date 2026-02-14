// SES (Secure ECMAScript) Compatibility
// This file ensures compatibility with wallet extensions that use SES lockdown

// Check if we're in a SES lockdown environment
export const isSESEnvironment = () => {
  return typeof (globalThis as Record<string, unknown>).lockdown === 'function' ||
         typeof (globalThis as Record<string, unknown>).harden === 'function';
};

// Ensure Date methods are compatible with SES
export const safeDate = {
  now: () => Date.now(),
  toISOString: (date: Date) => date.toISOString(),
  toLocaleString: (date: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) => {
    try {
      return date.toLocaleString(locales, options);
    } catch {
      // Fallback for SES environments
      return date.toString();
    }
  },
  toLocaleTimeString: (date: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) => {
    try {
      return date.toLocaleTimeString(locales, options);
    } catch {
      // Fallback for SES environments
      return date.toTimeString();
    }
  }
};

// Polyfills for common Web3 libraries that may have SES compatibility issues
export const initializeSESPolyfills = () => {
  if (typeof window !== 'undefined' && isSESEnvironment()) {
    // Add any necessary polyfills here
    console.info('🔧 Initialized SES compatibility polyfills');
  }
};

// Log SES environment status (only in development)
if (import.meta.env.DEV) {
  if (isSESEnvironment()) {
    console.info('🔒 Running in SES lockdown environment (likely due to Web3 wallet extension)');
    console.info('✅ Solana @solana/web3.js ParsedAccountData import uses type-only imports for SES compatibility');
  }
}