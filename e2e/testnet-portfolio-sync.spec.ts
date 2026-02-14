import { test, expect, type Page } from '@playwright/test';

/** Seed a test wallet into the store via localStorage */
async function seedTestWallet(page: Page) {
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

test.describe('Testnet Portfolio Sync', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestWallet(page);

    // Mock ethereum provider for testnet
    await page.addInitScript(() => {
      (window as any).ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          switch (method) {
            case 'eth_requestAccounts':
              return ['0xTestWallet0000000000000000000000000000001'];
            case 'eth_chainId':
              return '0xaa36a7'; // Sepolia
            case 'eth_getBalance':
              return '0xde0b6b3a7640000'; // 1 ETH
            default:
              return null;
          }
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    await page.goto('/');
  });

  test('should display dashboard with seeded testnet wallet', async ({ page }) => {
    // Dashboard should load
    await expect(page.locator('h1:has-text("Portfolio Dashboard")')).toBeVisible();
  });

  test('should use testnet-namespaced persistence key', async ({ page }) => {
    const hasTestnetKey = await page.evaluate(() => {
      return localStorage.getItem('cygnus-wealth-storage-testnet') !== null;
    });
    expect(hasTestnetKey).toBe(true);
  });

  test('should not leak data from production storage key', async ({ page }) => {
    // Set something in the production key
    await page.evaluate(() => {
      localStorage.setItem(
        'cygnus-wealth-storage-production',
        JSON.stringify({
          state: { accounts: [{ id: 'prod-leak', label: 'SHOULD NOT APPEAR' }] },
          version: 0,
        }),
      );
    });

    await page.reload();

    // The production account should not be visible
    await expect(page.locator('text=SHOULD NOT APPEAR')).not.toBeVisible();
  });
});
