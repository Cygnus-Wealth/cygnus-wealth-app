import { test, expect, Page } from '@playwright/test';

// Mock ethereum provider
async function mockEthereumProvider(page: Page) {
  await page.addInitScript(() => {
    // Create mock ethereum provider
    (window as unknown as Record<string, unknown>).ethereum = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        switch (method) {
          case 'eth_requestAccounts':
            return [
              '0x1234567890123456789012345678901234567890',
              '0x2345678901234567890123456789012345678901'
            ];
          case 'eth_chainId':
            return '0x1'; // Ethereum mainnet
          case 'eth_getBalance':
            return '0x1bc16d674ec80000'; // 2 ETH in wei
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

test.describe('Wallet Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockEthereumProvider(page);
    await page.goto('/settings/connections');
  });

  test('should detect and display wallet options', async ({ page }) => {
    // Look for Connect Wallet button
    const connectButton = page.locator('button:has-text("Connect Wallet")');
    await expect(connectButton).toBeVisible();
    
    // Click to see wallet options (if implemented as dropdown)
    await connectButton.click();
    
    // Should show MetaMask option
    await expect(page.locator('text=MetaMask')).toBeVisible();
  });

  test('should connect wallet successfully', async ({ page }) => {
    // Click Connect Wallet
    await page.click('button:has-text("Connect Wallet")');
    
    // If there's a MetaMask option, click it
    const metaMaskOption = page.locator('text=MetaMask');
    if (await metaMaskOption.isVisible()) {
      await metaMaskOption.click();
    }
    
    // Wait for connection to complete
    await expect(page.locator('text=Wallet Connected')).toBeVisible({ timeout: 10000 });
    
    // Should show connected accounts
    await expect(page.locator('text=2 accounts')).toBeVisible();
  });

  test('should show connection in summary stats', async ({ page }) => {
    // Mock a connected state
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>).__zustand_store;
      if (store) {
        store.setState({
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
          }]
        });
      }
    });
    
    await page.reload();
    
    // Check summary stats
    await expect(page.locator('text=Total Connections')).toBeVisible();
    await expect(page.locator('text=Total Accounts')).toBeVisible();
    await expect(page.locator('text=Connected Chains')).toBeVisible();
  });

  test('should navigate to wallet details', async ({ page }) => {
    // Mock connected wallet
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>).__zustand_store;
      if (store) {
        store.setState({
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
          }]
        });
      }
    });
    
    await page.reload();
    
    // Click View Details
    await page.click('button:has-text("View Details")');
    
    // Should navigate to details page
    await expect(page).toHaveURL(/\/settings\/wallet-details\/.*/);
    await expect(page.locator('h1:has-text("Details")')).toBeVisible();
  });

  test('should handle wallet disconnection', async ({ page }) => {
    // Mock connected wallet
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>).__zustand_store;
      if (store) {
        store.setState({
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
          }]
        });
      }
    });
    
    await page.reload();
    
    // Find and click Disconnect button
    await page.click('button:has-text("Disconnect All")');
    
    // Verify accounts are disconnected
    await expect(page.locator('text=0 connected')).toBeVisible();
  });

  test('should handle wallet deletion with confirmation', async ({ page }) => {
    // Mock connected wallet
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>).__zustand_store;
      if (store) {
        store.setState({
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
          }]
        });
      }
    });
    
    await page.reload();
    
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
    
    // Mock connected wallet with assets
    await page.addInitScript(() => {
      const mockState = {
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
        assets: [{
          id: 'asset-1',
          accountId: 'account-1',
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '2.5',
          chain: 'Ethereum',
          source: 'wallet',
          priceUsd: 2000,
          valueUsd: 5000
        }],
        portfolio: {
          totalValue: 5000,
          totalAssets: 1,
          lastUpdated: new Date().toISOString()
        }
      };
      
      // Store in window for Zustand to pick up
      (window as unknown as Record<string, unknown>).__mockStoreState = mockState;
    });
    
    await page.goto('/');
  });

  test('should display portfolio value', async ({ page }) => {
    // Check portfolio summary
    await expect(page.locator('text=$5000.00')).toBeVisible();
    await expect(page.locator('text=1').first()).toBeVisible(); // Total assets
    
    // Check asset table
    await expect(page.locator('text=ETH')).toBeVisible();
    await expect(page.locator('text=2.5')).toBeVisible();
    await expect(page.locator('text=$2000.00')).toBeVisible();
  });

  test('should filter zero balance assets', async ({ page }) => {
    // Add zero balance asset to mock
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>).__zustand_store;
      if (store) {
        const currentAssets = store.getState().assets || [];
        store.setState({
          assets: [
            ...currentAssets,
            {
              id: 'asset-2',
              accountId: 'account-1',
              symbol: 'USDC',
              name: 'USD Coin',
              balance: '0',
              chain: 'Ethereum',
              source: 'wallet',
              priceUsd: 1,
              valueUsd: 0
            }
          ]
        });
      }
    });
    
    // Zero balance should be hidden by default
    await expect(page.locator('text=USDC')).not.toBeVisible();
    
    // Check the show zero balances checkbox
    await page.click('input[type="checkbox"]');
    
    // Now USDC should be visible
    await expect(page.locator('text=USDC')).toBeVisible();
  });
});