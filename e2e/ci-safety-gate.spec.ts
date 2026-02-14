import { test, expect } from '@playwright/test';

/**
 * CI Safety Gate
 *
 * These tests verify that the application never accidentally operates
 * against production (mainnet) RPCs during CI/E2E runs.
 */
test.describe('CI Safety Gate', () => {
  test('app should detect testnet environment from VITE_NETWORK_ENV', async ({ page }) => {
    await page.goto('/');

    // The testnet banner must be visible — if it's missing, the env detection failed
    const banner = page.locator('[data-testid="testnet-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('TESTNET');
  });

  test('environment indicator should show TESTNET', async ({ page }) => {
    await page.goto('/');
    const indicator = page.locator('[data-testid="environment-indicator"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('TESTNET');
  });

  test('environment selector should highlight testnet option', async ({ page }) => {
    await page.goto('/');

    // Open side menu if needed and check environment selector
    const selector = page.locator('[data-testid="environment-selector"]');
    if (await selector.isVisible()) {
      const testnetOption = page.locator('[data-testid="env-option-testnet"]');
      await expect(testnetOption).toBeVisible();
    }
  });

  test('should not have production RPC URLs in page requests', async ({ page }) => {
    const productionRpcPatterns = [
      'eth-mainnet.g.alchemy.com',
      'mainnet.infura.io',
      'cloudflare-eth.com',
      'api.mainnet-beta.solana.com',
      'fullnode.mainnet.sui.io',
    ];

    const blockedRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      for (const pattern of productionRpcPatterns) {
        if (url.includes(pattern)) {
          blockedRequests.push(url);
        }
      }
    });

    await page.goto('/');
    // Wait for any async RPC calls
    await page.waitForTimeout(3000);

    expect(
      blockedRequests,
      `Production RPC calls detected in testnet mode: ${blockedRequests.join(', ')}`,
    ).toHaveLength(0);
  });
});
