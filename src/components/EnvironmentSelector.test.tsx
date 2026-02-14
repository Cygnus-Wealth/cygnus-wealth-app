import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import EnvironmentSelector from './EnvironmentSelector';
import { useStore } from '../store/useStore';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>{ui}</BrowserRouter>
    </ChakraProvider>
  );
}

describe('EnvironmentSelector', () => {
  beforeEach(() => {
    useStore.setState({ networkEnvironment: 'production' });
  });

  it('should render all three environment options', () => {
    renderWithProviders(<EnvironmentSelector />);
    expect(screen.getByTestId('env-option-production')).toBeDefined();
    expect(screen.getByTestId('env-option-testnet')).toBeDefined();
    expect(screen.getByTestId('env-option-local')).toBeDefined();
  });

  it('should default to production', () => {
    renderWithProviders(<EnvironmentSelector />);
    expect(useStore.getState().networkEnvironment).toBe('production');
  });

  it('should switch to testnet on click', () => {
    renderWithProviders(<EnvironmentSelector />);
    fireEvent.click(screen.getByTestId('env-option-testnet'));
    expect(useStore.getState().networkEnvironment).toBe('testnet');
  });

  it('should switch to local on click', () => {
    renderWithProviders(<EnvironmentSelector />);
    fireEvent.click(screen.getByTestId('env-option-local'));
    expect(useStore.getState().networkEnvironment).toBe('local');
  });

  it('should switch back to production on click', () => {
    useStore.setState({ networkEnvironment: 'testnet' });
    renderWithProviders(<EnvironmentSelector />);
    fireEvent.click(screen.getByTestId('env-option-production'));
    expect(useStore.getState().networkEnvironment).toBe('production');
  });
});
