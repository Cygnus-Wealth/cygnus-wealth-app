/**
 * PriceIndicator Component
 * 
 * Displays price with cache status, quality indicators, and loading states.
 * Provides visual feedback about price freshness and source.
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, Flex, Badge, IconButton, Tooltip, Progress } from '@chakra-ui/react';
import { FiRefreshCw, FiAlertCircle, FiClock, FiActivity } from 'react-icons/fi';
import { Price } from '../../domain/asset/Price';

export interface PriceIndicatorProps {
  price?: Price;
  symbol: string;
  isLoading?: boolean;
  error?: string;
  onRefresh?: () => void;
  showSource?: boolean;
  showAge?: boolean;
  showTrend?: boolean;
  previousPrice?: Price;
  size?: 'sm' | 'md' | 'lg';
}

export const PriceIndicator: React.FC<PriceIndicatorProps> = ({
  price,
  isLoading = false,
  error,
  onRefresh,
  showSource = true,
  showAge = true,
  showTrend = false,
  previousPrice,
  size = 'md'
}) => {
  const [ageText, setAgeText] = useState<string>('');
  const [isStale, setIsStale] = useState(false);

  // Update age text periodically
  useEffect(() => {
    if (!price) return;

    const updateAge = () => {
      const metadata = price.getDisplayMetadata();
      setAgeText(metadata.ageText);
      setIsStale(price.isStale());
    };

    updateAge();
    const interval = setInterval(updateAge, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [price]);

  // Calculate price change
  const getPriceChange = () => {
    if (!price || !previousPrice) return null;
    return price.percentageDifference(previousPrice);
  };

  const priceChange = getPriceChange();

  // Size configurations
  const sizeConfig = {
    sm: { fontSize: 'sm', badgeSize: 'xs', iconSize: 12 },
    md: { fontSize: 'md', badgeSize: 'sm', iconSize: 14 },
    lg: { fontSize: 'lg', badgeSize: 'md', iconSize: 16 }
  }[size];

  // Loading state
  if (isLoading) {
    return (
      <Flex align="center" gap={2}>
        <Box flex={1}>
          <Progress.Root size="xs" colorPalette="blue">
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
        </Box>
        <Text fontSize={sizeConfig.fontSize} color="gray.500">
          Loading price...
        </Text>
      </Flex>
    );
  }

  // Error state
  if (error) {
    return (
      <Flex align="center" gap={2}>
        <Box color="red.500">
          <FiAlertCircle size={sizeConfig.iconSize} />
        </Box>
        <Text fontSize={sizeConfig.fontSize} color="red.500">
          {error}
        </Text>
        {onRefresh && (
          <IconButton
            aria-label="Retry price fetch"
            size="xs"
            variant="ghost"
            colorPalette="red"
            onClick={onRefresh}
          >
            <FiRefreshCw />
          </IconButton>
        )}
      </Flex>
    );
  }

  // No price available
  if (!price) {
    return (
      <Flex align="center" gap={2}>
        <Text fontSize={sizeConfig.fontSize} color="gray.400">
          Price unavailable
        </Text>
        {onRefresh && (
          <IconButton
            aria-label="Fetch price"
            size="xs"
            variant="ghost"
            onClick={onRefresh}
          >
            <FiRefreshCw />
          </IconButton>
        )}
      </Flex>
    );
  }

  const quality = price.getQualityIndicator();
  const metadata = price.getDisplayMetadata();

  return (
    <Flex align="center" gap={2}>
      {/* Price value */}
      <Text
        fontSize={sizeConfig.fontSize}
        fontWeight="semibold"
        color={isStale ? 'gray.500' : 'inherit'}
      >
        {price.format(2)}
      </Text>

      {/* Price trend */}
      {showTrend && priceChange !== null && (
        <Badge
          colorPalette={priceChange > 0 ? 'green' : priceChange < 0 ? 'red' : 'gray'}
          variant="subtle"
          size={sizeConfig.badgeSize as 'xs' | 'sm' | 'md' | 'lg'}
        >
          {priceChange > 0 ? '↑' : priceChange < 0 ? '↓' : '→'}
          {Math.abs(priceChange).toFixed(2)}%
        </Badge>
      )}

      {/* Quality indicator */}
      <QualityDot quality={quality} size={sizeConfig.iconSize} />

      {/* Source badge */}
      {showSource && (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Badge
              colorPalette={metadata.qualityColor as 'green' | 'yellow' | 'red'}
              variant="subtle"
              size={sizeConfig.badgeSize as 'xs' | 'sm' | 'md' | 'lg'}
              cursor="help"
            >
              {metadata.sourceText}
            </Badge>
          </Tooltip.Trigger>
          <Tooltip.Positioner>
            <Tooltip.Content>
              <Box p={2}>
                <Text fontSize="xs" fontWeight="bold" mb={1}>
                  Price Source
                </Text>
                <Text fontSize="xs">Provider: {price.getProvider() || 'Unknown'}</Text>
                <Text fontSize="xs">Confidence: {price.getConfidence()}%</Text>
                <Text fontSize="xs">Updated: {ageText}</Text>
              </Box>
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Root>
      )}

      {/* Age indicator */}
      {showAge && (
        <Flex align="center" gap={1} color="gray.500">
          <FiClock size={sizeConfig.iconSize} />
          <Text fontSize="xs">{ageText}</Text>
        </Flex>
      )}

      {/* Stale warning */}
      {isStale && (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Box color="yellow.500" cursor="help">
              <FiAlertCircle size={sizeConfig.iconSize} />
            </Box>
          </Tooltip.Trigger>
          <Tooltip.Positioner>
            <Tooltip.Content>
              <Text fontSize="xs">Price data is stale and may be outdated</Text>
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Root>
      )}

      {/* Refresh button */}
      {onRefresh && (
        <IconButton
          aria-label="Refresh price"
          size="xs"
          variant="ghost"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <FiRefreshCw />
        </IconButton>
      )}

      {/* Live indicator for real-time prices */}
      {price.isLive() && price.isFresh() && (
        <LiveIndicator size={sizeConfig.iconSize} />
      )}
    </Flex>
  );
};

/**
 * Quality dot indicator
 */
const QualityDot: React.FC<{ quality: 'high' | 'medium' | 'low'; size: number }> = ({ 
  quality, 
  size 
}) => {
  const colors = {
    high: 'green.400',
    medium: 'yellow.400',
    low: 'red.400'
  };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Box
          w={`${size}px`}
          h={`${size}px`}
          borderRadius="full"
          bg={colors[quality]}
          cursor="help"
        />
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content>
          <Text fontSize="xs">
            Price quality: {quality}
          </Text>
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
};

/**
 * Live price indicator with pulse animation
 */
const LiveIndicator: React.FC<{ size: number }> = ({ size }) => {
  return (
    <Flex align="center" gap={1}>
      <Box position="relative">
        <Box
          as={FiActivity}
          boxSize={`${size}px`}
          color="green.500"
        />
        <Box
          position="absolute"
          top="0"
          left="0"
          w="full"
          h="full"
          borderRadius="full"
          bg="green.500"
          opacity={0.3}
          animation="ping 1s infinite"
        />
      </Box>
      <Text fontSize="xs" color="green.500" fontWeight="bold">
        LIVE
      </Text>
    </Flex>
  );
};

/**
 * Price trend chart mini component
 */
export const PriceTrendMini: React.FC<{
  prices: Price[];
  width?: number;
  height?: number;
}> = ({ prices, width = 60, height = 20 }) => {
  if (prices.length < 2) return null;

  // Calculate min/max for scaling
  const values = prices.map(p => p.getAmount());
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Generate SVG path
  const points = prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * width;
    const y = height - ((price.getAmount() - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const isUptrend = prices[prices.length - 1].getAmount() > prices[0].getAmount();

  return (
    <Box as="svg" width={width} height={height} display="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={isUptrend ? '#48BB78' : '#F56565'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  );
};