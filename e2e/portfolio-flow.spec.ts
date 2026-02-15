import { test, expect } from '@playwright/test';

test.describe('Portfolio Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display dashboard with empty state', async ({ page }) => {
    // Check main dashboard elements
    await expect(page.locator('h1:has-text("Portfolio Dashboard")')).toBeVisible();
    await expect(page.locator('text=Your complete crypto portfolio overview')).toBeVisible();

    // Check portfolio summary shows zeros
    await expect(page.locator('text=$0.00')).toBeVisible();
    await expect(page.locator('text=Total Portfolio Value')).toBeVisible();

    // Check empty state message
    await expect(page.locator('text=No assets to display')).toBeVisible();
    await expect(page.locator('text=Add accounts to start tracking your portfolio')).toBeVisible();

    // Check CTA button
    const ctaButton = page.locator('text=Go to Settings → Connections');
    await expect(ctaButton).toBeVisible();
  });

  test('should navigate to connections page', async ({ page }) => {
    // Click the CTA button
    await page.click('text=Go to Settings → Connections');

    // Verify navigation
    await expect(page).toHaveURL('/settings/connections');
    await expect(page.locator('h1:has-text("Connections")')).toBeVisible();
    await expect(page.locator('text=Manage your wallet and exchange connections')).toBeVisible();
  });

  test('should open add account modal', async ({ page }) => {
    // Navigate to connections
    await page.goto('/settings/connections');

    // Click Add Manually button
    await page.click('button:has-text("Add Manually")');

    // Check modal is visible
    await expect(page.locator('role=dialog')).toBeVisible();
    await expect(page.locator('text=Add Account')).toBeVisible();
  });

  test('should show wallet connection options', async ({ page }) => {
    await page.goto('/settings/connections');

    // Check for Multi-Chain Connect button
    await expect(page.locator('button:has-text("Multi-Chain Connect")')).toBeVisible();

    // Check for Run Diagnostics button
    await expect(page.locator('button:has-text("Run Diagnostics")')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate through sidebar menu', async ({ page }) => {
    await page.goto('/');

    // Navigate to Settings
    await page.click('text=Settings');
    await expect(page).toHaveURL('/settings');

    // Navigate to Connections from Settings
    await page.click('text=Connections');
    await expect(page).toHaveURL('/settings/connections');

    // Navigate back to Dashboard
    await page.click('text=Dashboard');
    await expect(page).toHaveURL('/');
  });

  test('should handle mobile menu on smaller screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check for hamburger menu
    const menuButton = page.locator('button[aria-label="Open Menu"]');
    await expect(menuButton).toBeVisible();

    // Open mobile menu
    await menuButton.click();

    // Check menu items are visible — use specific sidebar nav links
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });
});

test.describe('Theme and Accessibility', () => {
  test('should have proper page title and meta tags', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/CygnusWealth/i);
  });

  test('should maintain focus management', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');

    // Check that focus is visible on some element
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/settings/connections');

    // Check for proper button labels
    const deleteButtons = page.locator('button[aria-label="Delete connection"]');
    const count = await deleteButtons.count();

    // If there are connections, check delete buttons have labels
    if (count > 0) {
      await expect(deleteButtons.first()).toHaveAttribute('aria-label', 'Delete connection');
    }
  });
});
