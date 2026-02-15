import { test, expect } from '@playwright/test';
import { seedTestWallet, mockTestnetProvider } from './fixtures';

test.describe('Testnet Portfolio Sync', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestWallet(page);

    // Mock ethereum provider for testnet
    await mockTestnetProvider(page);

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
