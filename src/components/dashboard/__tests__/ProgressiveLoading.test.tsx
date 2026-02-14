/**
 * Progressive Loading Tests
 * 
 * Tests for the progressive loading functionality in Dashboard components.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { ValueCell } from '../ValueCell';
import { SimpleBalanceCell } from '../SimpleBalanceCell';

// Test wrapper with ChakraProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    {children}
  </ChakraProvider>
);

const renderWithChakra = (ui: React.ReactElement) => 
  render(ui, { wrapper: TestWrapper });

describe('Progressive Loading Components', () => {
  describe('ValueCell', () => {
    it('shows loading spinner when loading balance', () => {
      renderWithChakra(
        <ValueCell 
          balance="100" 
          priceUsd={1.50} 
          isLoadingBalance={true}
          isLoadingPrice={false}
        />
      );
      
      expect(screen.getByText('Loading balance...')).toBeInTheDocument();
    });

    it('shows loading spinner when loading price', () => {
      renderWithChakra(
        <ValueCell 
          balance="100" 
          priceUsd={1.50} 
          isLoadingBalance={false}
          isLoadingPrice={true}
        />
      );
      
      expect(screen.getByText('Loading price...')).toBeInTheDocument();
    });

    it('shows calculated value when not loading', () => {
      renderWithChakra(
        <ValueCell 
          balance="100" 
          priceUsd={1.50} 
          isLoadingBalance={false}
          isLoadingPrice={false}
        />
      );
      
      expect(screen.getByText('$150.00')).toBeInTheDocument();
    });

    it('shows error state when there are errors', () => {
      renderWithChakra(
        <ValueCell 
          balance="100" 
          priceUsd={1.50} 
          hasBalanceError={true}
          isLoadingBalance={false}
          isLoadingPrice={false}
        />
      );
      
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  describe('SimpleBalanceCell', () => {
    it('shows loading spinner when loading', () => {
      renderWithChakra(
        <SimpleBalanceCell 
          balance="100.5555" 
          symbol="ETH"
          isLoading={true}
        />
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows formatted balance when not loading', () => {
      renderWithChakra(
        <SimpleBalanceCell 
          balance="100.5555" 
          symbol="ETH"
          isLoading={false}
        />
      );
      
      expect(screen.getByText('100.5555')).toBeInTheDocument();
    });

    it('shows error state', () => {
      renderWithChakra(
        <SimpleBalanceCell 
          balance="100" 
          symbol="ETH"
          hasError={true}
        />
      );
      
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });
});