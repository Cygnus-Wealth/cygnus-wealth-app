import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';

// Mock wallet-integration-system
vi.mock('@cygnus-wealth/wallet-integration-system', () => ({
  IntegrationSource: {
    METAMASK: 'METAMASK',
    PHANTOM: 'PHANTOM',
    SUIET: 'SUIET',
    SLUSH: 'SLUSH',
    COINBASE_WALLET: 'COINBASE_WALLET',
    RABBY: 'RABBY',
  },
  WalletManager: vi.fn(),
  Chain: {
    SUI: 'SUI'
  }
}));

// Mock createToaster to avoid Chakra UI issues
vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@chakra-ui/react')>('@chakra-ui/react');
  return {
    ...actual,
    createToaster: () => ({
      create: vi.fn(),
    }),
  };
});

// Mock the config import
vi.mock('../../config/rpc', () => ({
  getPreferredRpcEndpoint: vi.fn().mockReturnValue('https://fullnode.mainnet.sui.io')
}));

import MultiWalletConnect from './MultiWalletConnect';

describe('MultiWalletConnect', () => {
  it('should render the Multi-Chain Connect button', () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <MultiWalletConnect />
      </ChakraProvider>
    );
    
    expect(screen.getByText('Multi-Chain Connect')).toBeInTheDocument();
  });
  
  it('should have the correct button properties', () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <MultiWalletConnect />
      </ChakraProvider>
    );
    
    const button = screen.getByText('Multi-Chain Connect');
    expect(button.tagName).toBe('BUTTON');
  });
});