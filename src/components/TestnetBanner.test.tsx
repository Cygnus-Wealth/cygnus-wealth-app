import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import TestnetBanner from './TestnetBanner';
import { useStore } from '../store/useStore';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>{ui}</BrowserRouter>
    </ChakraProvider>
  );
}

describe('TestnetBanner', () => {
  beforeEach(() => {
    useStore.setState({ networkEnvironment: 'production' });
  });

  it('should not render in production mode', () => {
    renderWithProviders(<TestnetBanner />);
    expect(screen.queryByTestId('testnet-banner')).toBeNull();
  });

  it('should render testnet warning when in testnet mode', () => {
    useStore.setState({ networkEnvironment: 'testnet' });
    renderWithProviders(<TestnetBanner />);
    const banner = screen.getByTestId('testnet-banner');
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain('TESTNET MODE');
  });

  it('should render local warning when in local mode', () => {
    useStore.setState({ networkEnvironment: 'local' });
    renderWithProviders(<TestnetBanner />);
    const banner = screen.getByTestId('testnet-banner');
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain('LOCAL MODE');
  });
});
