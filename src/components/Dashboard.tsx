import { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Stack,
  Text,
  Button,
  Heading,
  Spinner,
  Table,
  Badge,
  Flex,
  IconButton,
  Grid,
  Stat,
  Tooltip,
  Skeleton,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiPlus, FiEye, FiEyeOff, FiRefreshCw } from 'react-icons/fi';
import { useStore } from '../store/useStore';
import { useAccountSync } from '../hooks/useAccountSync';
import { useProgressiveAssetLoading } from '../hooks/useProgressiveAssetLoading';
import { useDeFiPositions } from '../hooks/useDeFiPositions';
import { SimpleBalanceCell } from './dashboard/SimpleBalanceCell';
import { ValueCell } from './dashboard/ValueCell';
import { DeFiPositions } from './dashboard/DeFiPositions';
import { shouldHideByDefault } from '../utils/spamFilter';
import type { Asset } from '../store/useStore';

const ITEMS_PER_PAGE = 10;

const spinKeyframes = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;

function formatTimeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState(1);
  const [showHiddenTokens, setShowHiddenTokens] = useState(false);
  
  // Get data from global store - use selectors to prevent unnecessary re-renders
  const accounts = useStore(state => state.accounts);
  const assets = useStore(state => state.assets);
  const portfolio = useStore(state => state.portfolio);
  const prices = useStore(state => state.prices);
  const isLoading = useStore(state => state.isLoading);
  
  // Sync account balances
  useAccountSync();
  
  // Progressive loading for individual assets
  const { getLoadingState, getOverallStatus } = useProgressiveAssetLoading(assets);

  // DeFi positions
  const { defiPositions, isLoadingDeFi, totalDeFiValue } = useDeFiPositions();

  // Get connected accounts count
  const connectedAccounts = accounts.filter(acc => acc.status === 'connected').length;

  // Aggregate assets by symbol and chain, grouping by connection type
  const aggregatedAssets = useMemo(() => {
    const assetMap = new Map<string, {
      asset: Asset;
      addresses: Set<string>;
      totalBalance: number;
      totalValue: number;
      connectionInfo: { 
        connectionType: string; 
        accountCount: number; 
        walletIds: Set<string>;
      };
    }>();

    // Group assets by symbol, chain, and connection type
    assets.forEach(asset => {
      const account = accounts.find(acc => acc.id === asset.accountId);
      const connectionType = account?.metadata?.connectionType || account?.metadata?.walletType || 'Unknown';
      const walletId = account?.metadata?.walletId || account?.id || '';
      
      const key = `${asset.symbol}-${asset.chain}-${connectionType}`;
      const existing = assetMap.get(key);
      const balance = parseFloat(asset.balance);
      const value = asset.valueUsd || 0;
      const address = asset.metadata?.address || account?.address || '';

      if (existing) {
        existing.addresses.add(address);
        existing.connectionInfo.walletIds.add(walletId);
        existing.totalBalance += balance;
        existing.totalValue += value;
        existing.asset.balance = existing.totalBalance.toString();
        existing.asset.valueUsd = existing.totalValue;
        existing.connectionInfo.accountCount = existing.addresses.size;
      } else {
        assetMap.set(key, {
          asset: {
            ...asset,
            balance: balance.toString(),
            valueUsd: value,
            source: connectionType // Update source to show connection type
          },
          addresses: new Set([address]),
          totalBalance: balance,
          totalValue: value,
          connectionInfo: { 
            connectionType,
            accountCount: 1,
            walletIds: new Set([walletId])
          }
        });
      }
    });

    return Array.from(assetMap.values());
  }, [assets, accounts]);

  // Filter assets: hide spam, worthless, zero-balance, and dust tokens by default
  const filteredAssets = showHiddenTokens
    ? aggregatedAssets
    : aggregatedAssets.filter(item => {
        // Hide zero balance tokens
        if (item.totalBalance <= 0) return false;
        // Hide spam/worthless/dust tokens using the spam filter
        if (shouldHideByDefault(item.asset, item.totalValue)) return false;
        return true;
      });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentAssets = filteredAssets.slice(startIndex, endIndex);

  // Count hidden tokens for display
  const hiddenCount = aggregatedAssets.length - filteredAssets.length;

  // Reset to page 1 when filter changes
  const handleToggleHidden = (checked: boolean) => {
    setShowHiddenTokens(checked);
    setCurrentPage(1);
  };

  return (
    <Container maxW="container.xl" py={8}>
      <style>{spinKeyframes}</style>
      <Stack gap={8}>
        <Box textAlign="center">
          <Heading as="h1" size="4xl" mb={2}>
            Portfolio Dashboard
          </Heading>
          <Text color="gray.600">
            Your complete crypto portfolio overview
          </Text>
        </Box>

        {/* Portfolio Summary - Always visible */}
        <Box p={6} bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" shadow="sm">
          <Stack gap={4}>
            <Heading as="h2" size="lg" color="gray.800">
              Portfolio Summary
            </Heading>
            
            <Grid templateColumns={{ base: '1fr', md: 'repeat(4, 1fr)' }} gap={6}>
              <Stat.Root>
                <Stat.Label color="gray.600">Total Portfolio Value</Stat.Label>
                <Stat.ValueText fontSize="3xl">
                  ${(portfolio.totalValue + totalDeFiValue).toFixed(2)}
                </Stat.ValueText>
                <Stat.HelpText>USD</Stat.HelpText>
              </Stat.Root>

              <Stat.Root>
                <Stat.Label color="gray.600">Total Assets</Stat.Label>
                <Stat.ValueText fontSize="3xl">
                  {portfolio.totalAssets}
                </Stat.ValueText>
                <Stat.HelpText>Across all accounts</Stat.HelpText>
              </Stat.Root>

              <Stat.Root>
                <Stat.Label color="gray.600">DeFi Value</Stat.Label>
                <Stat.ValueText fontSize="3xl">
                  ${totalDeFiValue.toFixed(2)}
                </Stat.ValueText>
                <Stat.HelpText>{defiPositions.length} positions</Stat.HelpText>
              </Stat.Root>

              <Stat.Root>
                <Stat.Label color="gray.600">Connected Accounts</Stat.Label>
                <Stat.ValueText fontSize="3xl">
                  {connectedAccounts}
                </Stat.ValueText>
                <Stat.HelpText>
                  <Button asChild size="sm" variant="plain" colorPalette="blue">
                    <Link to="/settings/connections">
                      {connectedAccounts === 0 ? 'Add accounts' : 'Manage'}
                    </Link>
                  </Button>
                </Stat.HelpText>
              </Stat.Root>
            </Grid>
          </Stack>
        </Box>

        {/* Assets Table - Always visible */}
        <Box p={6} bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" shadow="sm" position="relative">
          <Stack gap={4}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Heading as="h2" size="lg" color="gray.800">
                Assets
              </Heading>
              <Flex align="center" gap={4}>
                <Flex align="center" gap={2}>
                  <Box as={showHiddenTokens ? FiEye : FiEyeOff} color="gray.600" />
                  <Text fontSize="sm" color="gray.600">
                    Show all tokens{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
                  </Text>
                  <input
                    type="checkbox"
                    checked={showHiddenTokens}
                    onChange={(e) => handleToggleHidden(e.target.checked)}
                    style={{
                      marginLeft: '8px',
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px'
                    }}
                  />
                </Flex>
                {isLoading && assets.length > 0 && (
                  <Flex align="center" gap={2}>
                    <Box as={FiRefreshCw} color="blue.500" style={{ animation: 'spin 1s linear infinite' }} />
                    <Text fontSize="xs" color="gray.500">Refreshing...</Text>
                  </Flex>
                )}
                {!isLoading && portfolio.lastUpdated && (
                  <Text fontSize="xs" color="gray.400">
                    Updated {formatTimeAgo(portfolio.lastUpdated)}
                  </Text>
                )}
                {(getOverallStatus().isLoadingAnyBalance || getOverallStatus().isLoadingAnyPrice) && (
                  <Flex align="center" gap={2}>
                    <Spinner size="xs" color="blue.500" />
                    <Text fontSize="xs" color="gray.500">
                      Loading {getOverallStatus().isLoadingAnyBalance ? 'balances' : 'prices'}...
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Box>

            <Box overflowX="auto" position="relative" minH="300px">
              <Table.Root variant="line">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Asset</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="right">Balance</Table.ColumnHeader>
                    <Table.ColumnHeader>Source</Table.ColumnHeader>
                    <Table.ColumnHeader>Chain</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="right">Price (USD)</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="right">Value (USD)</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredAssets.length > 0 ? (
                    currentAssets.map((item) => {
                      const { asset, addresses, connectionInfo } = item;
                      const addressArray = Array.from(addresses);
                      const showTooltip = addressArray.length > 1;

                      // Format source to show account count
                      const sourceLabel = connectionInfo.accountCount > 1
                        ? `${connectionInfo.connectionType} (${connectionInfo.accountCount} accounts)`
                        : connectionInfo.connectionType;

                      return (
                        <Table.Row key={asset.id}>
                          <Table.Cell>
                            <Stack gap={0}>
                              <Text fontWeight="semibold">{asset.symbol}</Text>
                              <Text fontSize="sm" color="gray.600">{asset.name}</Text>
                            </Stack>
                          </Table.Cell>
                          <Table.Cell textAlign="right">
                            <SimpleBalanceCell
                              balance={asset.balance}
                              symbol={asset.symbol}
                              isLoading={getLoadingState(asset.id).isLoadingBalance}
                              hasError={!!getLoadingState(asset.id).balanceError}
                            />
                          </Table.Cell>
                          <Table.Cell>
                            {showTooltip ? (
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <Badge
                                    colorScheme="blue"
                                    variant="subtle"
                                    cursor="pointer"
                                    style={{ textDecoration: 'underline dotted' }}
                                  >
                                    {sourceLabel}
                                  </Badge>
                                </Tooltip.Trigger>
                                <Tooltip.Positioner>
                                  <Tooltip.Content>
                                    <Box p={2}>
                                      <Text fontSize="xs" fontWeight="semibold" mb={1}>
                                        Accounts ({addressArray.length}):
                                      </Text>
                                      {addressArray.map((addr, idx) => (
                                        <Text key={idx} fontSize="xs" fontFamily="mono">
                                          {addr.slice(0, 6)}...{addr.slice(-4)}
                                        </Text>
                                      ))}
                                    </Box>
                                  </Tooltip.Content>
                                </Tooltip.Positioner>
                              </Tooltip.Root>
                            ) : (
                              <Badge colorScheme="blue" variant="subtle">
                                {sourceLabel}
                              </Badge>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge colorScheme="purple" variant="subtle">
                              {asset.chain}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell textAlign="right">
                            {getLoadingState(asset.id).isLoadingPrice ? (
                              <Flex align="center" gap={1} justify="flex-end">
                                <Spinner size="xs" color="blue.500" />
                                <Text fontSize="xs" color="gray.500">Loading...</Text>
                              </Flex>
                            ) : (
                              <Text fontFamily="mono">
                                ${prices[asset.symbol]?.toFixed(2) || asset.priceUsd?.toFixed(2) || '-'}
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell textAlign="right">
                            <ValueCell
                              balance={asset.balance}
                              priceUsd={prices[asset.symbol] || asset.priceUsd}
                              valueUsd={asset.valueUsd}
                              isLoadingBalance={getLoadingState(asset.id).isLoadingBalance}
                              isLoadingPrice={getLoadingState(asset.id).isLoadingPrice}
                              hasBalanceError={!!getLoadingState(asset.id).balanceError}
                              hasPriceError={!!getLoadingState(asset.id).priceError}
                              compact
                            />
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  ) : isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Table.Row key={`skeleton-${i}`}>
                        <Table.Cell>
                          <Stack gap={1}>
                            <Skeleton height="16px" width="60px" />
                            <Skeleton height="12px" width="90px" />
                          </Stack>
                        </Table.Cell>
                        <Table.Cell textAlign="right">
                          <Skeleton height="16px" width="80px" ml="auto" />
                        </Table.Cell>
                        <Table.Cell>
                          <Skeleton height="20px" width="70px" />
                        </Table.Cell>
                        <Table.Cell>
                          <Skeleton height="20px" width="65px" />
                        </Table.Cell>
                        <Table.Cell textAlign="right">
                          <Skeleton height="16px" width="70px" ml="auto" />
                        </Table.Cell>
                        <Table.Cell textAlign="right">
                          <Skeleton height="16px" width="80px" ml="auto" />
                        </Table.Cell>
                      </Table.Row>
                    ))
                  ) : (
                    <Table.Row>
                      <Table.Cell colSpan={6} textAlign="center" py={20}>
                        <Stack gap={4} align="center">
                          <Box
                            p={4}
                            bg="gray.50"
                            borderRadius="full"
                            color="gray.400"
                          >
                            <FiPlus size={32} />
                          </Box>
                          <Text fontSize="lg" color="gray.600">
                            No assets to display
                          </Text>
                          <Text color="gray.500">
                            Add accounts to start tracking your portfolio
                          </Text>
                          <Button
                            asChild
                            colorPalette="blue"
                          >
                            <Link to="/settings/connections">
                              <FiPlus />
                              Go to Settings → Connections
                            </Link>
                          </Button>
                        </Stack>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <Flex justify="space-between" align="center" mt={4}>
                <Text fontSize="sm" color="gray.600">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredAssets.length)} of {filteredAssets.length} assets
                  {!showHiddenTokens && hiddenCount > 0 && (
                    <Text as="span" color="gray.500">
                      {' '}({hiddenCount} hidden)
                    </Text>
                  )}
                </Text>
                <Stack direction="row" gap={2}>
                  <IconButton
                    aria-label="Previous page"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <FiChevronLeft />
                  </IconButton>
                  <Button size="sm" variant="outline">
                    {currentPage} / {totalPages}
                  </Button>
                  <IconButton
                    aria-label="Next page"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <FiChevronRight />
                  </IconButton>
                </Stack>
              </Flex>
            )}
          </Stack>
        </Box>

        {/* DeFi Positions */}
        <DeFiPositions
          positions={defiPositions}
          isLoading={isLoadingDeFi}
        />

      </Stack>
    </Container>
  );
}