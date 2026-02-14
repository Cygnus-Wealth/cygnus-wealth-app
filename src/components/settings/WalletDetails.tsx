import {
  Container,
  Stack,
  Heading,
  Text,
  Box,
  Flex,
  IconButton,
  Table,
  Badge,
} from '@chakra-ui/react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { SiEthereum } from 'react-icons/si';
import { useStore } from '../../store/useStore';
import { useMemo } from 'react';

// Platform icon mapping
const platformIcons: Record<string, React.ElementType> = {
  'Ethereum': SiEthereum,
  'Multi-Chain EVM': SiEthereum,
};

// Helper to format address
const formatAddress = (address: string) => 
  address ? address : '-';

export default function WalletDetails() {
  const { accounts } = useStore();
  const { connectionType } = useParams<{ connectionType: string }>();
  
  // Decode the connection type from URL
  const decodedConnectionType = connectionType ? decodeURIComponent(connectionType) : '';
  
  // Filter accounts for this specific connection
  const connectionAccounts = useMemo(() => {
    const filtered = accounts.filter(acc => 
      acc.type === 'wallet' && 
      (acc.metadata?.connectionType === decodedConnectionType || 
       acc.metadata?.walletType === decodedConnectionType)
    );
    console.log(`WalletDetails: Found ${filtered.length} accounts for ${decodedConnectionType}`);
    console.log('Filtered accounts:', filtered);
    return filtered;
  }, [accounts, decodedConnectionType]);
  
  // Calculate totals for this connection
  const walletIds = new Set(connectionAccounts.map(acc => acc.metadata?.walletId || acc.id));
  const totalWallets = walletIds.size;
  const totalAccounts = connectionAccounts.length;
  
  // Get icon for this connection
  const Icon = platformIcons['Multi-Chain EVM'] || SiEthereum;
  
  return (
    <Container maxW="container.xl" py={8}>
      <Stack gap={8}>
        {/* Header */}
        <Box>
          <Flex align="center" gap={4} mb={2}>
            <IconButton
              asChild
              aria-label="Back to Connections"
              variant="ghost"
              size="sm"
            >
              <Link to="/settings/connections">
                <FiArrowLeft />
              </Link>
            </IconButton>
            <Heading as="h1" size="3xl">
              {decodedConnectionType} Details
            </Heading>
          </Flex>
          <Text color="gray.600" ml={12}>
            {totalWallets} wallet{totalWallets !== 1 ? 's' : ''} • {totalAccounts} account{totalAccounts !== 1 ? 's' : ''}
          </Text>
        </Box>

        {/* Connection Info Box */}
        <Box
          p={4}
          bg="gray.50"
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.200"
        >
          <Flex align="center" gap={3}>
            <Box
              p={2}
              bg="white"
              borderRadius="lg"
              color="gray.700"
              border="1px solid"
              borderColor="gray.200"
            >
              <Icon size={24} />
            </Box>
            <Box>
              <Text fontWeight="semibold">{decodedConnectionType}</Text>
              <Text fontSize="sm" color="gray.600">
                Connected chains: {connectionAccounts[0]?.metadata?.detectedChains?.join(', ') || 'None'}
              </Text>
            </Box>
          </Flex>
        </Box>

        {/* Accounts Table */}
        <Box
          bg="white"
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.200"
          overflow="hidden"
        >
          <Box p={4} borderBottom="1px solid" borderColor="gray.200">
            <Text fontWeight="semibold" fontSize="lg">Accounts</Text>
            <Text fontSize="sm" color="gray.600">
              All addresses connected through {decodedConnectionType}
            </Text>
          </Box>
          
          <Box overflowX="auto">
            <Table.Root variant="line">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Account</Table.ColumnHeader>
                  <Table.ColumnHeader>Wallet</Table.ColumnHeader>
                  <Table.ColumnHeader>Address</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader>Last Sync</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {connectionAccounts.map((account) => (
                  <Table.Row key={account.id}>
                    <Table.Cell>
                      <Text fontWeight="medium">
                        {account.label}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm" color="gray.600">
                        {account.metadata?.walletLabel || 'Unknown Wallet'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontFamily="mono" fontSize="sm">
                        {formatAddress(account.address || '')}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        colorScheme={
                          account.status === 'connected' ? 'green' :
                          account.status === 'error' ? 'red' : 'gray'
                        }
                      >
                        {account.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm" color="gray.600">
                        {account.lastSync ? new Date(account.lastSync).toLocaleString() : 'Never'}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </Box>

        {/* Empty State */}
        {connectionAccounts.length === 0 && (
          <Box p={8} bg="gray.50" borderRadius="lg" textAlign="center">
            <Text fontSize="lg" color="gray.600" mb={4}>
              No accounts found for {decodedConnectionType}
            </Text>
            <Text color="gray.500">
              This connection may have been removed or renamed.
            </Text>
          </Box>
        )}
        
        {/* Info Box */}
        <Box
          p={4}
          bg="blue.50"
          borderRadius="md"
          border="1px solid"
          borderColor="blue.200"
        >
          <Text fontSize="sm" color="blue.800">
            <strong>Note:</strong> The "Wallet" column indicates which mnemonic or hardware wallet each address belongs to. 
            This grouping is estimated since {decodedConnectionType} doesn't expose the relationship between addresses and their parent wallets.
          </Text>
        </Box>
      </Stack>
    </Container>
  );
}