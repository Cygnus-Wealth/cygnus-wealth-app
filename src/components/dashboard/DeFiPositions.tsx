import { useState, useMemo } from 'react';
import {
  Box,
  Stack,
  Text,
  Heading,
  Table,
  Badge,
  Flex,
  Skeleton,
  Button,
} from '@chakra-ui/react';
import type { DeFiPosition, DeFiPositionType } from '../../domain/defi/DeFiPosition';

const TYPE_LABELS: Record<DeFiPositionType, string> = {
  vault: 'Vault',
  lending: 'Lending',
  lp: 'LP',
  staking: 'Staking',
  farming: 'Farming',
};

const TYPE_COLORS: Record<DeFiPositionType, string> = {
  vault: 'purple',
  lending: 'blue',
  lp: 'teal',
  staking: 'orange',
  farming: 'green',
};

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type GroupBy = 'protocol' | 'chain';

interface DeFiPositionsProps {
  positions: DeFiPosition[];
  isLoading: boolean;
}

export function DeFiPositions({ positions, isLoading }: DeFiPositionsProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('protocol');

  const grouped = useMemo(() => {
    const map = new Map<string, DeFiPosition[]>();
    for (const pos of positions) {
      const key = groupBy === 'protocol' ? pos.protocol : pos.chain;
      const list = map.get(key) ?? [];
      list.push(pos);
      map.set(key, list);
    }
    return map;
  }, [positions, groupBy]);

  return (
    <Box
      p={6}
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      shadow="sm"
    >
      <Stack gap={4}>
        <Flex justifyContent="space-between" alignItems="center">
          <Heading as="h2" size="lg" color="gray.800">
            DeFi Positions
          </Heading>
          <Flex gap={2}>
            <Button
              size="sm"
              variant={groupBy === 'protocol' ? 'solid' : 'outline'}
              colorPalette="blue"
              onClick={() => setGroupBy('protocol')}
              aria-label="Group by protocol"
            >
              Protocol
            </Button>
            <Button
              size="sm"
              variant={groupBy === 'chain' ? 'solid' : 'outline'}
              colorPalette="blue"
              onClick={() => setGroupBy('chain')}
              aria-label="Group by chain"
            >
              Chain
            </Button>
          </Flex>
        </Flex>

        <Box overflowX="auto">
          {isLoading && positions.length === 0 ? (
            <Table.Root variant="line">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Protocol</Table.ColumnHeader>
                  <Table.ColumnHeader>Type</Table.ColumnHeader>
                  <Table.ColumnHeader>Position</Table.ColumnHeader>
                  <Table.ColumnHeader>Assets</Table.ColumnHeader>
                  <Table.ColumnHeader>Chain</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">APY</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Value (USD)</Table.ColumnHeader>
                  <Table.ColumnHeader>Source</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Table.Row key={`skeleton-${i}`}>
                    <Table.Cell><Skeleton height="16px" width="80px" /></Table.Cell>
                    <Table.Cell><Skeleton height="20px" width="60px" /></Table.Cell>
                    <Table.Cell><Skeleton height="16px" width="100px" /></Table.Cell>
                    <Table.Cell><Skeleton height="16px" width="70px" /></Table.Cell>
                    <Table.Cell><Skeleton height="20px" width="65px" /></Table.Cell>
                    <Table.Cell textAlign="right"><Skeleton height="16px" width="50px" ml="auto" /></Table.Cell>
                    <Table.Cell textAlign="right"><Skeleton height="16px" width="80px" ml="auto" /></Table.Cell>
                    <Table.Cell><Skeleton height="20px" width="60px" /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          ) : positions.length === 0 ? (
            <Flex justify="center" py={10}>
              <Text color="gray.500">No DeFi positions found</Text>
            </Flex>
          ) : (
            <Table.Root variant="line">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Protocol</Table.ColumnHeader>
                  <Table.ColumnHeader>Type</Table.ColumnHeader>
                  <Table.ColumnHeader>Position</Table.ColumnHeader>
                  <Table.ColumnHeader>Assets</Table.ColumnHeader>
                  <Table.ColumnHeader>Chain</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">APY</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Value (USD)</Table.ColumnHeader>
                  <Table.ColumnHeader>Source</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {Array.from(grouped.entries()).map(([_group, groupPositions]) => (
                  groupPositions.map((pos, idx) => (
                    <Table.Row key={pos.id}>
                      {idx === 0 ? (
                        <Table.Cell rowSpan={groupPositions.length}>
                          <Text fontWeight="semibold">{pos.protocol}</Text>
                        </Table.Cell>
                      ) : null}
                      <Table.Cell>
                        <Badge
                          colorScheme={TYPE_COLORS[pos.positionType]}
                          variant="subtle"
                        >
                          {TYPE_LABELS[pos.positionType]}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text>{pos.label}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm">
                          {pos.underlyingAssets.map((a) => a.symbol).join(', ')}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge colorScheme="purple" variant="subtle">
                          {pos.chain}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell textAlign="right">
                        {pos.apy != null ? (
                          <Text fontFamily="mono" color="green.600">
                            {pos.apy.toFixed(2)}%
                          </Text>
                        ) : (
                          <Text color="gray.400">-</Text>
                        )}
                      </Table.Cell>
                      <Table.Cell textAlign="right">
                        <Text fontWeight="semibold" fontFamily="mono">
                          {formatUsd(pos.valueUsd)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge colorScheme="gray" variant="subtle">
                          {pos.discoverySource}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
