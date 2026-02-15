import type { Page } from '@playwright/test';

/**
 * Shared E2E test fixtures for CygnusWealth.
 *
 * Provides mock ethereum providers and Zustand store seeding utilities
 * used across multiple test files.
 */

// ---------------------------------------------------------------------------
// Ethereum provider mocks (injected via addInitScript before navigation)
// ---------------------------------------------------------------------------

/** Mock MetaMask on Ethereum mainnet (chain 0x1) */
export async function mockEthereumProvider(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).ethereum = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        switch (method) {
          case 'eth_requestAccounts':
            return [
              '0x1234567890123456789012345678901234567890',
              '0x2345678901234567890123456789012345678901',
            ];
          case 'eth_chainId':
            return '0x1';
          case 'eth_getBalance':
            return '0x1bc16d674ec80000'; // 2 ETH
          case 'wallet_switchEthereumChain':
            return null;
          default:
            throw new Error(`Unhandled method: ${method}`);
        }
      },
      on: () => {},
      removeListener: () => {},
    };
  });
}

/** Mock MetaMask on Sepolia testnet (chain 0xaa36a7) */
export async function mockTestnetProvider(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).ethereum = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        switch (method) {
          case 'eth_requestAccounts':
            return ['0xTestWallet0000000000000000000000000000001'];
          case 'eth_chainId':
            return '0xaa36a7'; // Sepolia
          case 'eth_getBalance':
            return '0xde0b6b3a7640000'; // 1 ETH
          case 'wallet_switchEthereumChain':
            return null;
          default:
            throw new Error(`Unhandled method: ${method}`);
        }
      },
      on: () => {},
      removeListener: () => {},
    };
  });
}

/**
 * Mock ethereum provider that rejects all connection attempts.
 * Simulates the user rejecting the MetaMask popup or provider being unavailable.
 */
export async function mockFailingEthereumProvider(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).ethereum = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        if (method === 'eth_requestAccounts') {
          throw { code: 4001, message: 'User rejected the request.' };
        }
        if (method === 'eth_chainId') {
          return '0xaa36a7'; // Sepolia
        }
        throw new Error(`Unhandled method: ${method}`);
      },
      on: () => {},
      removeListener: () => {},
    };
  });
}

// ---------------------------------------------------------------------------
// Zustand store seeding (injected via addInitScript before navigation)
// ---------------------------------------------------------------------------

/** Seed a connected testnet wallet into Zustand-persisted localStorage */
export async function seedTestWallet(page: Page) {
  await page.addInitScript(() => {
    const storageKey = 'cygnus-wealth-storage-testnet';
    const state = {
      state: {
        accounts: [
          {
            id: 'test-wallet-1',
            type: 'wallet',
            platform: 'Multi-Chain EVM',
            label: 'Testnet Wallet',
            address: '0xTestWallet0000000000000000000000000000001',
            status: 'connected',
            metadata: {
              connectionType: 'MetaMask',
              detectedChains: ['Ethereum'],
            },
          },
        ],
        networkEnvironment: 'testnet',
      },
      version: 0,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  });
}

/**
 * Seed a connected wallet with portfolio assets into localStorage.
 * Useful for testing portfolio display without going through wallet connection flow.
 */
export async function seedPortfolioState(page: Page) {
  await page.addInitScript(() => {
    const storageKey = 'cygnus-wealth-storage-testnet';
    const state = {
      state: {
        accounts: [
          {
            id: 'account-1',
            type: 'wallet',
            platform: 'Multi-Chain EVM',
            label: 'MetaMask Account 1',
            address: '0x1234567890123456789012345678901234567890',
            status: 'connected',
            metadata: {
              connectionType: 'MetaMask',
              detectedChains: ['Ethereum', 'Polygon'],
            },
          },
        ],
        assets: [
          {
            id: 'asset-1',
            accountId: 'account-1',
            symbol: 'ETH',
            name: 'Ethereum',
            balance: '2.5',
            chain: 'Ethereum',
            source: 'wallet',
            priceUsd: 2000,
            valueUsd: 5000,
          },
        ],
        portfolio: {
          totalValue: 5000,
          totalAssets: 1,
          lastUpdated: new Date().toISOString(),
        },
        networkEnvironment: 'testnet',
      },
      version: 0,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  });
}

/**
 * Seed a wallet that is in an error state, simulating a failed portfolio load.
 */
export async function seedErrorState(page: Page) {
  await page.addInitScript(() => {
    const storageKey = 'cygnus-wealth-storage-testnet';
    const state = {
      state: {
        accounts: [
          {
            id: 'account-err',
            type: 'wallet',
            platform: 'Multi-Chain EVM',
            label: 'Broken Wallet',
            address: '0xErrorWallet000000000000000000000000000001',
            status: 'error',
            metadata: {
              connectionType: 'MetaMask',
              detectedChains: ['Ethereum'],
            },
          },
        ],
        assets: [],
        portfolio: {
          totalValue: 0,
          totalAssets: 0,
          lastUpdated: null,
        },
        error: 'Failed to load portfolio data',
        networkEnvironment: 'testnet',
      },
      version: 0,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  });
}
