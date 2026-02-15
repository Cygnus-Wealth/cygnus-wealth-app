import { test, expect } from '@playwright/test';
import { mockFailingEthereumProvider, mockTestnetProvider, seedErrorState } from './fixtures';

/**
 * Error Handling E2E Tests (P1)
 *
 * Enterprise-required scenarios:
 *   - Connection failure: user rejects MetaMask or provider throws
 *   - Portfolio load failure: store is in error state, UI shows graceful fallback
 */

test.describe('Connection Failure Handling', () => {
  test('should show error when wallet connection is rejected', async ({ page }) => {
    await mockFailingEthereumProvider(page);
    await page.goto('/settings/connections');

    // Click Multi-Chain Connect
    const connectButton = page.locator('button:has-text("Multi-Chain Connect")');
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // Click MetaMask option
    const metaMask = page.locator('text=MetaMask');
    if (await metaMask.isVisible()) {
      await metaMask.click();
    }

    // Should show an error toast or message — NOT "Wallet Connected"
    await page.waitForTimeout(3000);
    await expect(page.locator('text=Wallet Connected')).not.toBeVisible();
  });

  test('should remain functional after connection failure', async ({ page }) => {
    await mockFailingEthereumProvider(page);
    await page.goto('/settings/connections');

    // Attempt connection
    await page.click('button:has-text("Multi-Chain Connect")');
    const metaMask = page.locator('text=MetaMask');
    if (await metaMask.isVisible()) {
      await metaMask.click();
    }

    // Wait for error to surface
    await page.waitForTimeout(3000);

    // Navigation should still work
    await page.click('text=Dashboard');
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1:has-text("Portfolio Dashboard")')).toBeVisible();
  });

  test('should not show wallet as connected when no provider is present', async ({ page }) => {
    // Do NOT inject any ethereum mock — provider is absent
    await page.goto('/settings/connections');

    // The page should load without crashing
    await expect(page.locator('h1:has-text("Connections")')).toBeVisible();

    // "Wallet Connected" should not be visible
    await expect(page.locator('text=Wallet Connected')).not.toBeVisible();
  });
});

test.describe('Portfolio Load Failure Handling', () => {
  test('should handle error state gracefully on dashboard', async ({ page }) => {
    await seedErrorState(page);
    await mockTestnetProvider(page);
    await page.goto('/');

    // Dashboard should still load
    await expect(page.locator('h1:has-text("Portfolio Dashboard")')).toBeVisible();

    // Should show $0.00 or error state or empty state, not a crash
    const hasValue = page.locator('text=$0.00');
    const hasError = page.locator('text=/error|failed|unable/i');
    const hasEmptyState = page.locator('text=No assets to display');

    const valueVisible = await hasValue.isVisible().catch(() => false);
    const errorVisible = await hasError.first().isVisible().catch(() => false);
    const emptyVisible = await hasEmptyState.isVisible().catch(() => false);

    expect(valueVisible || errorVisible || emptyVisible).toBe(true);
  });

  test('should allow retry or navigation after portfolio load failure', async ({ page }) => {
    await seedErrorState(page);
    await mockTestnetProvider(page);
    await page.goto('/');

    // Page should be interactive
    await expect(page.locator('h1:has-text("Portfolio Dashboard")')).toBeVisible();

    // Navigation should still work
    await page.click('text=Settings');
    await expect(page).toHaveURL('/settings');
  });
});
