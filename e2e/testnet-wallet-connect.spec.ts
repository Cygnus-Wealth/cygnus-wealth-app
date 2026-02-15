import { test, expect } from '@playwright/test';
import { mockTestnetProvider } from './fixtures';

test.describe('Testnet Wallet Connect', () => {
  test.beforeEach(async ({ page }) => {
    await mockTestnetProvider(page);
    await page.goto('/settings/connections');
  });

  test('should connect wallet on testnet', async ({ page }) => {
    const connectButton = page.locator('button:has-text("Multi-Chain Connect")');
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    const metaMask = page.locator('text=MetaMask');
    if (await metaMask.isVisible()) {
      await metaMask.click();
    }

    // Should eventually show a connected state
    await expect(
      page.locator('text=/connected|Wallet Connected/i').first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('should show testnet banner when on testnet', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('[data-testid="testnet-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('TESTNET');
  });

  test('should show environment indicator badge', async ({ page }) => {
    await page.goto('/');
    const indicator = page.locator('[data-testid="environment-indicator"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('TESTNET');
  });
});
