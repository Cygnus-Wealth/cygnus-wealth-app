/**
 * ValueCell Component
 * 
 * Displays USD value with progressive loading states.
 * Shows spinner while calculating value from balance and price data.
 */

import React from 'react';
import { Box, Text, Spinner, Flex, Badge } from '@chakra-ui/react';

export interface ValueCellProps {
  balance?: string | number;
  priceUsd?: number | null;
  valueUsd?: number | null;
  isLoadingBalance?: boolean;
  isLoadingPrice?: boolean;
  hasBalanceError?: boolean;
  hasPriceError?: boolean;
  compact?: boolean;
  showCurrency?: boolean;
  precision?: number;
}

export const ValueCell: React.FC<ValueCellProps> = ({
  valueUsd = null,
  isLoadingBalance = false,
  isLoadingPrice = false,
  hasBalanceError = false,
  hasPriceError = false,
  compact = false,
  showCurrency = true,
  precision = 2
}) => {
  // Use the pre-calculated valueUsd; never compute from raw balance strings
  // as they may be in wei/smallest-unit form and would produce wildly incorrect values
  const calculatedValue = valueUsd ?? null;

  // Determine loading state
  const isLoading = isLoadingBalance || isLoadingPrice;
  const hasError = hasBalanceError || hasPriceError;

  // Render loading state
  if (isLoading) {
    return (
      <Flex align="center" gap={2} justify="flex-end">
        {!compact && (
          <Text fontSize="xs" color="gray.500">
            {isLoadingBalance ? 'Loading balance...' : 'Loading price...'}
          </Text>
        )}
        <Spinner size="xs" color="blue.500" />
      </Flex>
    );
  }

  // Render error state
  if (hasError) {
    return (
      <Flex align="center" gap={2} justify="flex-end">
        {!compact && (
          <Text fontSize="xs" color="red.500">
            {hasBalanceError ? 'Balance error' : 'Price error'}
          </Text>
        )}
        <Badge colorScheme="red" variant="subtle" fontSize="xs">
          Error
        </Badge>
      </Flex>
    );
  }

  // Render unavailable state
  if (calculatedValue === null || calculatedValue === undefined) {
    return (
      <Text 
        color="gray.400" 
        fontSize={compact ? "sm" : "md"}
        textAlign="right"
        fontFamily="mono"
      >
        {showCurrency ? '$-' : '-'}
      </Text>
    );
  }

  // Format value
  const formattedValue = calculatedValue.toFixed(precision);
  const displayValue = showCurrency ? `$${formattedValue}` : formattedValue;

  // Determine color based on value
  const valueColor = calculatedValue > 0 ? 'green.600' : 
                    calculatedValue < 0 ? 'red.600' : 'gray.600';

  return (
    <Box textAlign="right">
      <Text
        fontWeight="semibold"
        fontSize={compact ? 'sm' : 'md'}
        color={valueColor}
        fontFamily="mono"
      >
        {displayValue}
      </Text>
      {!compact && calculatedValue > 0 && (
        <Text fontSize="xs" color="gray.500">
          USD
        </Text>
      )}
    </Box>
  );
};

/**
 * Simplified ValueCell for displaying just a formatted value
 */
export const SimpleValueCell: React.FC<{
  value: number | null;
  isLoading?: boolean;
  compact?: boolean;
  showCurrency?: boolean;
  precision?: number;
}> = ({ 
  value, 
  isLoading = false, 
  compact = false, 
  showCurrency = true,
  precision = 2 
}) => {
  if (isLoading) {
    return (
      <Flex align="center" gap={1} justify="flex-end">
        <Spinner size="xs" color="blue.500" />
      </Flex>
    );
  }

  if (value === null || value === undefined) {
    return (
      <Text 
        color="gray.400" 
        fontSize={compact ? "sm" : "md"}
        textAlign="right"
        fontFamily="mono"
      >
        {showCurrency ? '$-' : '-'}
      </Text>
    );
  }

  const formattedValue = value.toFixed(precision);
  const displayValue = showCurrency ? `$${formattedValue}` : formattedValue;
  const valueColor = value > 0 ? 'green.600' : 
                    value < 0 ? 'red.600' : 'gray.600';

  return (
    <Text
      fontWeight="semibold"
      fontSize={compact ? 'sm' : 'md'}
      color={valueColor}
      fontFamily="mono"
      textAlign="right"
    >
      {displayValue}
    </Text>
  );
};

export default ValueCell;