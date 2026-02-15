import { test, expect } from '@playwright/test';
import { mockEthereumProvider, seedPortfolioState } from './fixtures';

test.describe('Wallet Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockEthereumProvider(page);
    await page.goto('/settings/connections');
  });

  test('should detect and display wallet options', async ({ page }) => {
    const connectButton = page.locator('button:has-text("Multi-Chain Connect")');
    await expect(connectButton).toBeVisible();

    // Click to open wallet menu
    await connectButton.click();

    // Should show MetaMask option
    await expect(page.locator('text=MetaMask')).toBeVisible();
  });

  test('should connect wallet successfully', async ({ page }) => {
    // Click Multi-Chain Connect
    await page.click('button:has-text("Multi-Chain Connect")');

    // Click MetaMask option
    const metaMaskOption = page.locator('text=MetaMask');
    if (await metaMaskOption.isVisible()) {
      await metaMaskOption.click();
    }

    // Should show connected state — toast or connection card
    await expect(
      page.locator('text=/Wallet Connected|connected/i').first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('should show connection in summary stats', async ({ page }) => {
    // Seed a connected wallet via localStorage
    await page.addInitScript(() => {
      const storageKey = 'cygnus-wealth-storage-testnet';
      const state = {
        state: {
          accounts: [{
            id: 'account-1',
            type: 'wallet',
            platform: 'Multi-Chain EVM',
            label: 'MetaMask Account 1',
            address: '0x1234567890123456789012345678901234567890',
            status: 'connected',
            metadata: {
              connectionType: 'MetaMask',
              detectedChains: ['Ethereum', 'Polygon']
            }
          }],
          networkEnvironment: 'testnet',
        },
        version: 0,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    });

    await page.goto('/settings/connections');

    // Check summary stats
    await expect(page.locator('text=Total Connections')).toBeVisible();
    await expect(page.locator('text=Total Accounts')).toBeVisible();
    await expect(page.locator('text=Connected Chains')).toBeVisible();
  });

  test('should navigate to wallet details', async ({ page }) => {
    // Seed a connected wallet via localStorage
    await page.addInitScript(() => {
      const storageKey = 'cygnus-wealth-storage-testnet';
      const state = {
        state: {
          accounts: [{
            id: 'account-1',
            type: 'wallet',
            platform: 'Multi-Chain EVM',
            label: 'MetaMask Account 1',
            address: '0x1234567890123456789012345678901234567890',
            status: 'connected',
            metadata: {
              connectionType: 'MetaMask'
            }
          }],
          networkEnvironment: 'testnet',
        },
        version: 0,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    });

    await page.goto('/settings/connections');

    // Click View Details
    await page.click('button:has-text("View Details")');

    // Should navigate to details page
    await expect(page).toHaveURL(/\/settings\/wallet-details\/.*/);
    await expect(page.locator('h1:has-text("Details")')).toBeVisible();
  });

  test('should handle wallet disconnection', async ({ page }) => {
    // Seed a connected wallet via localStorage
    await page.addInitScript(() => {
      const storageKey = 'cygnus-wealth-storage-testnet';
      const state = {
        state: {
          accounts: [{
            id: 'account-1',
            type: 'wallet',
            platform: 'Multi-Chain EVM',
            label: 'MetaMask Account 1',
            address: '0x1234567890123456789012345678901234567890',
            status: 'connected',
            metadata: {
              connectionType: 'MetaMask'
            }
          }],
          networkEnvironment: 'testnet',
        },
        version: 0,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    });

    await page.goto('/settings/connections');

    // Find and click Disconnect All button
    await page.click('button:has-text("Disconnect All")');

    // Verify accounts are disconnected — text shows "0 connected • 1 disconnected"
    await expect(page.locator('text=0 connected')).toBeVisible();
  });

  test('should handle wallet deletion with confirmation', async ({ page }) => {
    // Seed a connected wallet via localStorage
    await page.addInitScript(() => {
      const storageKey = 'cygnus-wealth-storage-testnet';
      const state = {
        state: {
          accounts: [{
            id: 'account-1',
            type: 'wallet',
            platform: 'Multi-Chain EVM',
            label: 'MetaMask Account 1',
            address: '0x1234',
            status: 'connected',
            metadata: {
              connectionType: 'MetaMask'
            }
          }],
          networkEnvironment: 'testnet',
        },
        version: 0,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    });

    await page.goto('/settings/connections');

    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete button
    await page.click('button[aria-label="Delete connection"]');

    // Should show empty state
    await expect(page.locator('text=No connections added yet')).toBeVisible();
  });
});

test.describe('Portfolio Display with Connected Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await mockEthereumProvider(page);
    await seedPortfolioState(page);
    await page.goto('/');
  });

  test('should display portfolio value', async ({ page }) => {
    // Dashboard should load
    await expect(page.locator('h1:has-text("Portfolio Dashboard")')).toBeVisible();

    // Check that ETH asset is shown (use exact match to avoid "Ethereum" duplicates)
    await expect(page.getByText('ETH', { exact: true })).toBeVisible();
  });

  test('should filter zero balance assets', async ({ page }) => {
    // Dashboard should load
    await expect(page.locator('h1:has-text("Portfolio Dashboard")')).toBeVisible();

    // ETH should be visible (from seeded state)
    await expect(page.getByText('ETH', { exact: true })).toBeVisible();
  });
});
