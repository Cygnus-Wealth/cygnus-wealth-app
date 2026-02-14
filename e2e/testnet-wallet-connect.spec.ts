import { test, expect, type Page } from '@playwright/test';

/** Inject a mock ethereum provider that reports a testnet chain id */
async function mockTestnetProvider(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).ethereum = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        switch (method) {
          case 'eth_requestAccounts':
            return ['0xTestWallet0000000000000000000000000000001'];
          case 'eth_chainId':
            return '0xaa36a7'; // Sepolia (11155111)
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

test.describe('Testnet Wallet Connect', () => {
  test.beforeEach(async ({ page }) => {
    await mockTestnetProvider(page);
    await page.goto('/settings/connections');
  });

  test('should connect wallet on testnet', async ({ page }) => {
    const connectButton = page.locator('button:has-text("Connect Wallet")');
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    const metaMask = page.locator('text=MetaMask');
    if (await metaMask.isVisible()) {
      await metaMask.click();
    }

    // Should eventually show a connected state
    await expect(
      page.locator('text=/connected|Wallet Connected/i'),
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
