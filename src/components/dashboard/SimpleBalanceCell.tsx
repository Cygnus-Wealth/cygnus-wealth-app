/**
 * SimpleBalanceCell Component
 * 
 * Simplified balance display component for Dashboard table rows.
 * Shows balance with loading spinner while fetching data.
 */

import React from 'react';
import { Text, Spinner, Flex } from '@chakra-ui/react';

export interface SimpleBalanceCellProps {
  balance: string | number;
  symbol: string;
  isLoading?: boolean;
  hasError?: boolean;
  compact?: boolean;
}

export const SimpleBalanceCell: React.FC<SimpleBalanceCellProps> = ({
  balance,
  symbol: _symbol,
  isLoading = false,
  hasError = false,
  compact = false
}) => {
  // Show loading state
  if (isLoading) {
    return (
      <Flex align="center" gap={2} justify="flex-end">
        <Spinner size="xs" color="blue.500" />
        {!compact && (
          <Text fontSize="xs" color="gray.500">
            Loading...
          </Text>
        )}
      </Flex>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <Text 
        color="red.500" 
        fontSize={compact ? "sm" : "md"}
        textAlign="right"
        fontFamily="mono"
      >
        Error
      </Text>
    );
  }

  // Format balance
  const numericBalance = typeof balance === 'string' ? parseFloat(balance) : balance;
  const formattedBalance = isNaN(numericBalance) ? '0' : numericBalance.toFixed(4);

  return (
    <Text
      fontFamily="mono"
      fontSize={compact ? "sm" : "md"}
      textAlign="right"
      fontWeight="medium"
    >
      {formattedBalance}
    </Text>
  );
};

export default SimpleBalanceCell;