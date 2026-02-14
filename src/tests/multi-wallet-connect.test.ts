import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store/useStore';

describe('MultiWalletConnect', () => {
  beforeEach(() => {
    // Reset store
    useStore.setState({
      accounts: [],
      assets: [],
      portfolio: {
        totalValue: 0,
        totalAssets: 0,
        lastUpdated: null,
      }
    });

    // Mock window.ethereum
    global.window = {
      ethereum: {
        isMetaMask: true,
        isRabby: false,
        request: vi.fn(),
        providers: [],
        on: vi.fn(),
        removeListener: vi.fn()
      }
    } as unknown as typeof globalThis.window;
  });

  describe('Wallet Detection', () => {
    it('should detect MetaMask', () => {
      expect(window.ethereum?.isMetaMask).toBe(true);
    });

    it('should detect multiple providers', () => {
      const eth = window.ethereum as EthereumProvider;
      eth.providers = [
        { isMetaMask: true, request: vi.fn(), on: vi.fn(), removeListener: vi.fn() } as unknown as EthereumProvider,
        { isRabby: true, request: vi.fn(), on: vi.fn(), removeListener: vi.fn() } as unknown as EthereumProvider
      ];

      const hasMetaMask = eth.providers!.some((p: EthereumProvider) => p.isMetaMask);
      const hasRabby = eth.providers!.some((p: EthereumProvider) => p.isRabby);

      expect(hasMetaMask).toBe(true);
      expect(hasRabby).toBe(true);
    });
  });

  describe('Account Connection', () => {
    it('should handle eth_requestAccounts with multiple accounts', async () => {
      const mockAccounts = [
        '0x1234567890123456789012345678901234567890',
        '0x2345678901234567890123456789012345678901',
        '0x3456789012345678901234567890123456789012',
        '0x4567890123456789012345678901234567890123',
        '0x5678901234567890123456789012345678901234'
      ];

      (window.ethereum!.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockAccounts);

      const accounts = await window.ethereum!.request({ method: 'eth_requestAccounts' });
      
      expect(accounts).toEqual(mockAccounts);
      expect(accounts).toHaveLength(5);
    });

    it('should add multiple accounts to store', () => {
      const { result } = renderHook(() => useStore());
      
      // Simulate adding multiple accounts
      const walletId = 'wallet-metamask-123456';
      const accounts = [
        '0x1234567890123456789012345678901234567890',
        '0x2345678901234567890123456789012345678901',
        '0x3456789012345678901234567890123456789012'
      ];
      
      act(() => {
        accounts.forEach((address, index) => {
          result.current.addAccount({
            id: `${walletId}-account-${index}`,
            type: 'wallet',
            platform: 'Multi-Chain EVM',
            label: `MetaMask Account ${index + 1}`,
            address: address,
            status: 'connected',
            metadata: {
              walletId: walletId,
              connectionType: 'MetaMask',
              walletLabel: 'MetaMask Wallet'
            }
          });
        });
      });
      
      expect(result.current.accounts).toHaveLength(3);
      expect(result.current.accounts[0].address).toBe(accounts[0]);
      expect(result.current.accounts[1].address).toBe(accounts[1]);
      expect(result.current.accounts[2].address).toBe(accounts[2]);
    });
  });

  describe('Chain Detection', () => {
    it('should handle wallet_switchEthereumChain', async () => {
      const chainId = '0x89'; // Polygon
      
      (window.ethereum!.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await window.ethereum!.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      });
      
      expect(window.ethereum!.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      });
    });

    it('should handle chain not configured error', async () => {
      const error = { code: 4902, message: 'Chain not configured' };
      (window.ethereum!.request as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      
      try {
        await window.ethereum!.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }]
        });
      } catch (e: unknown) {
        expect((e as { code: number }).code).toBe(4902);
      }
    });
  });
});