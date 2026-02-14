import { WalletManager } from '@cygnus-wealth/wallet-integration-system';

let walletManagerInstance: WalletManager | null = null;

/**
 * Get or create a singleton WalletManager instance with proper RPC configuration
 */
export function getWalletManager(): WalletManager {
  if (!walletManagerInstance) {
    // Let wallet-integration-system handle RPC configuration internally
    // It will use WebSocket connections as the primary method
    walletManagerInstance = new WalletManager();
    
    // Store it globally for access from hooks
    (window as unknown as Record<string, unknown>).__cygnusWalletManager = walletManagerInstance;
  }
  
  return walletManagerInstance;
}

/**
 * Reset the WalletManager instance
 * This can be useful if you need to reinitialize connections
 */
export function resetWalletManager(): void {
  walletManagerInstance = null;
  delete (window as unknown as Record<string, unknown>).__cygnusWalletManager;
}