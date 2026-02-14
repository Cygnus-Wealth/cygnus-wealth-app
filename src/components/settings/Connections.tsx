import {
  Container,
  Stack,
  Heading,
  Text,
  Box,
  Button,
  Badge,
  Flex,
  IconButton,
  Grid,
  Stat,
} from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiEdit2, FiTrash2, FiKey } from 'react-icons/fi';
import { SiEthereum, SiSolana, SiBinance } from 'react-icons/si';
import { useStore } from '../../store/useStore';
import type { Account } from '../../store/useStore';
import { useState, useMemo } from 'react';
import AddAccountModal from './AddAccountModal';
import TokenManager from './TokenManager';
import MultiWalletConnect from './MultiWalletConnect';
import WalletDiagnostics from './WalletDiagnostics';

// Platform icon mapping
const platformIcons: Record<string, React.ElementType> = {
  'Ethereum': SiEthereum,
  'Polygon': SiEthereum, // Using ETH icon for now
  'Arbitrum': SiEthereum,
  'Optimism': SiEthereum,
  'Solana': SiSolana,
  'Binance': SiBinance,
};

interface ConnectionGroup {
  connectionType: string;
  accounts: Account[];
  walletIds: Set<string>;
  totalWallets: number;
  totalAccounts: number;
}

export default function Connections() {
  const { accounts, updateAccount, removeAccount } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  
  // Group accounts by connection type
  const connectionGroups = useMemo(() => {
    const groups = new Map<string, ConnectionGroup>();
    
    accounts.filter(acc => acc.type === 'wallet').forEach(account => {
      const connectionType = account.metadata?.connectionType || account.metadata?.walletType || 'Unknown';
      
      if (!groups.has(connectionType)) {
        groups.set(connectionType, {
          connectionType,
          accounts: [],
          walletIds: new Set(),
          totalWallets: 0,
          totalAccounts: 0
        });
      }
      
      const group = groups.get(connectionType)!;
      group.accounts.push(account);
      if (account.metadata?.walletId) {
        group.walletIds.add(account.metadata.walletId);
      }
    });
    
    // Calculate totals
    groups.forEach(group => {
      group.totalWallets = group.walletIds.size || 1; // At least 1 wallet if we have accounts
      group.totalAccounts = group.accounts.length;
    });
    
    return Array.from(groups.values());
  }, [accounts]);
  
  // Calculate overall totals
  const totalAccounts = accounts.filter(acc => acc.type === 'wallet').length;
  const totalChains = useMemo(() => {
    const chains = new Set<string>();
    accounts.filter(acc => acc.type === 'wallet').forEach(account => {
      account.metadata?.detectedChains?.forEach(chain => chains.add(chain));
    });
    return chains.size;
  }, [accounts]);
  
  const getStatusColor = (status: 'connected' | 'disconnected' | 'error') => {
    switch (status) {
      case 'connected':
        return 'green';
      case 'disconnected':
        return 'gray';
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getAccountTypeLabel = (type: 'wallet' | 'cex' | 'dex') => {
    switch (type) {
      case 'wallet':
        return 'Wallet';
      case 'cex':
        return 'Exchange';
      case 'dex':
        return 'DEX';
      default:
        return type;
    }
  };

  const handleAddAccount = () => {
    setIsModalOpen(true);
  };

  const handleConnect = (accountId: string) => {
    updateAccount(accountId, { status: 'connected', lastSync: new Date().toISOString() });
  };

  const handleDisconnect = async (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;
    
    // If this account uses WalletManager, disconnect through it
    if (account.metadata?.useWalletManager) {
      const walletManager = (window as any).__cygnusWalletManager as any;
      if (walletManager && account.metadata?.walletManagerId) {
        try {
          // Find all accounts with the same walletManagerId
          const relatedAccounts = accounts.filter(
            acc => acc.metadata?.walletManagerId === account.metadata?.walletManagerId
          );
          
          // Disconnect all chains for this wallet
          const { Chain } = await import('@cygnus-wealth/wallet-integration-system');
          const chains = [
            Chain.ETHEREUM,
            Chain.POLYGON,
            Chain.BSC,
            Chain.ARBITRUM,
            Chain.OPTIMISM,
            Chain.AVALANCHE,
            Chain.BASE
          ];
          
          for (const chain of chains) {
            try {
              await walletManager.disconnectWallet(chain);
            } catch {
              // Chain might not be connected, ignore
            }
          }
          
          // Update all related accounts to disconnected
          relatedAccounts.forEach(acc => {
            updateAccount(acc.id, { status: 'disconnected' });
          });
          
          return;
        } catch (error) {
          console.error('Error disconnecting wallet:', error);
        }
      }
    }
    
    // Fallback to simple status update
    updateAccount(accountId, { status: 'disconnected' });
  };

  const handleDelete = async (accountId: string) => {
    if (confirm('Are you sure you want to remove this account?')) {
      const account = accounts.find(acc => acc.id === accountId);
      if (!account) return;
      
      // If this is the last account for a wallet using WalletManager, disconnect it
      if (account.metadata?.useWalletManager && account.metadata?.walletManagerId) {
        const relatedAccounts = accounts.filter(
          acc => acc.metadata?.walletManagerId === account.metadata?.walletManagerId
        );
        
        if (relatedAccounts.length === 1) {
          // This is the last account, disconnect the wallet
          await handleDisconnect(accountId);
        }
      }
      
      removeAccount(accountId);
    }
  };

  // Non-wallet accounts (CEX, DEX, manual)
  const otherAccounts = accounts.filter(acc => acc.type !== 'wallet');

  return (
    <Container maxW="container.xl" py={8}>
      <Stack gap={8}>
        {/* Header */}
        <Box>
          <Flex align="center" gap={4} mb={2}>
            <IconButton
              asChild
              aria-label="Back to Settings"
              variant="ghost"
              size="sm"
            >
              <Link to="/settings">
                <FiArrowLeft />
              </Link>
            </IconButton>
            <Heading as="h1" size="3xl">
              Connections
            </Heading>
          </Flex>
          <Text color="gray.600" ml={12}>
            Manage your wallet and exchange connections
          </Text>
        </Box>

        {/* Summary Stats */}
        {(connectionGroups.length > 0 || otherAccounts.length > 0) && (
          <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
            <Box p={4} bg="gray.50" borderRadius="lg">
              <Stat.Root>
                <Stat.Label color="gray.600">Total Connections</Stat.Label>
                <Stat.ValueText fontSize="2xl">
                  {connectionGroups.length + (otherAccounts.length > 0 ? 1 : 0)}
                </Stat.ValueText>
              </Stat.Root>
            </Box>
            <Box p={4} bg="gray.50" borderRadius="lg">
              <Stat.Root>
                <Stat.Label color="gray.600">Total Accounts</Stat.Label>
                <Stat.ValueText fontSize="2xl">
                  {totalAccounts}
                </Stat.ValueText>
              </Stat.Root>
            </Box>
            <Box p={4} bg="gray.50" borderRadius="lg">
              <Stat.Root>
                <Stat.Label color="gray.600">Connected Chains</Stat.Label>
                <Stat.ValueText fontSize="2xl">
                  {totalChains}
                </Stat.ValueText>
              </Stat.Root>
            </Box>
          </Grid>
        )}

        {/* Add Connection Actions */}
        <Box>
          <Stack direction="row" gap={4} wrap="wrap">
            <MultiWalletConnect />
            <Button
              variant="outline"
              colorPalette="gray"
              onClick={handleAddAccount}
            >
              <FiPlus />
              Add Manually
            </Button>
            <WalletDiagnostics />
          </Stack>
        </Box>

        {/* Wallet Connections */}
        {connectionGroups.length > 0 && (
          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Wallet Connections
            </Heading>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={4}>
              {connectionGroups.map((group) => {
                const Icon = platformIcons['Multi-Chain EVM'] || SiEthereum;
                
                return (
                  <Box
                    key={group.connectionType}
                    p={4}
                    bg="white"
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="gray.200"
                    shadow="sm"
                    transition="all 0.2s"
                    _hover={{
                      shadow: 'md',
                      borderColor: 'gray.300',
                    }}
                  >
                    <Stack gap={3}>
                      {/* Connection Header */}
                      <Flex justify="space-between" align="flex-start">
                        <Flex gap={2} align="center" flex="1">
                          <Box
                            p={1.5}
                            bg="gray.100"
                            borderRadius="lg"
                            color="gray.700"
                          >
                            <Icon size={20} />
                          </Box>
                          <Box flex="1">
                            <Text fontWeight="semibold" fontSize="md">
                              {group.connectionType}
                            </Text>
                            <Text fontSize="xs" color="gray.600">
                              {group.totalAccounts} account{group.totalAccounts !== 1 ? 's' : ''}
                            </Text>
                          </Box>
                        </Flex>
                        
                        {/* Delete Button */}
                        <IconButton
                          aria-label="Delete connection"
                          variant="ghost"
                          size="sm"
                          color="red.500"
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove all ${group.connectionType} accounts?`)) {
                              group.accounts.forEach(account => handleDelete(account.id));
                            }
                          }}
                        >
                          <FiTrash2 />
                        </IconButton>
                      </Flex>

                      {/* Account Summary */}
                      <Box p={2} bg="gray.50" borderRadius="md">
                        <Text fontSize="xs" color="gray.600">
                          {group.accounts.filter(a => a.status === 'connected').length} connected • {' '}
                          {group.accounts.filter(a => a.status === 'disconnected').length} disconnected
                          {group.accounts.filter(a => a.status === 'error').length > 0 && (
                            <> • <Text as="span" color="red.600">{group.accounts.filter(a => a.status === 'error').length} error</Text></>
                          )}
                        </Text>
                      </Box>

                      {/* Chains Info */}
                      {group.accounts[0]?.metadata?.detectedChains && (
                        <Text fontSize="xs" color="gray.600">
                          Chains: {group.accounts[0].metadata.detectedChains.join(', ')}
                        </Text>
                      )}

                      {/* Quick Actions */}
                      <Stack gap={2}>
                        <Button
                          size="sm"
                          variant="outline"
                          w="full"
                          onClick={() => navigate(`/settings/wallet-details/${encodeURIComponent(group.connectionType)}`)}
                        >
                          View Details
                        </Button>
                        {group.accounts.some(a => a.status === 'disconnected') && (
                          <Button
                            size="sm"
                            variant="outline"
                            colorScheme="blue"
                            w="full"
                            onClick={() => {
                              group.accounts
                                .filter(a => a.status === 'disconnected')
                                .forEach(a => handleConnect(a.id));
                            }}
                          >
                            Connect All
                          </Button>
                        )}
                        {group.accounts.some(a => a.status === 'connected') && (
                          <Button
                            size="sm"
                            variant="outline"
                            colorScheme="red"
                            w="full"
                            onClick={() => {
                              group.accounts
                                .filter(a => a.status === 'connected')
                                .forEach(a => handleDisconnect(a.id));
                            }}
                          >
                            Disconnect All
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* Other Connections (CEX, DEX, Manual) */}
        {otherAccounts.length > 0 && (
          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Exchange Connections
            </Heading>
            <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={4}>
              {otherAccounts.map((account) => {
                const Icon = platformIcons[account.platform] || SiEthereum;
                
                return (
                  <Box
                    key={account.id}
                    p={6}
                    bg="white"
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="gray.200"
                    shadow="sm"
                    transition="all 0.2s"
                    _hover={{
                      shadow: 'md',
                      borderColor: 'gray.300',
                    }}
                  >
                    <Stack gap={4}>
                      {/* Account Header */}
                      <Flex justify="space-between" align="flex-start">
                        <Flex gap={3} align="center">
                          <Box
                            p={2}
                            bg="gray.100"
                            borderRadius="lg"
                            color="gray.700"
                          >
                            <Icon size={24} />
                          </Box>
                          <Box>
                            <Flex align="center" gap={2}>
                              <Text fontWeight="semibold" fontSize="lg">
                                {account.label}
                              </Text>
                              <Badge
                                colorScheme={getStatusColor(account.status)}
                                size="sm"
                              >
                                {account.status}
                              </Badge>
                            </Flex>
                            <Text fontSize="sm" color="gray.600">
                              {account.platform} • {getAccountTypeLabel(account.type)}
                            </Text>
                          </Box>
                        </Flex>
                        
                        {/* Actions */}
                        <Stack direction="row" gap={1}>
                          <IconButton
                            aria-label="Edit connection"
                            variant="ghost"
                            size="sm"
                          >
                            <FiEdit2 />
                          </IconButton>
                          <IconButton
                            aria-label="Delete connection"
                            variant="ghost"
                            size="sm"
                            color="red.500"
                            onClick={() => handleDelete(account.id)}
                          >
                            <FiTrash2 />
                          </IconButton>
                        </Stack>
                      </Flex>

                      {/* Account Details */}
                      <Stack gap={2}>
                        {account.address && (
                          <Flex align="center" gap={2}>
                            <Text fontSize="sm" color="gray.600">
                              Address:
                            </Text>
                            <Text fontSize="sm" fontFamily="mono">
                              {account.address}
                            </Text>
                          </Flex>
                        )}
                        
                        {account.type === 'cex' && (
                          <Flex align="center" gap={2}>
                            <FiKey size={14} color="gray" />
                            <Text fontSize="sm" color="gray.600">
                              API Key configured
                            </Text>
                          </Flex>
                        )}

                        {account.lastSync && account.status === 'connected' && (
                          <Text fontSize="sm" color="gray.500">
                            Last synced: {account.lastSync}
                          </Text>
                        )}
                      </Stack>

                      {/* Token Manager for single-chain wallet accounts */}
                      {account.type === 'wallet' && 
                       account.status === 'connected' && 
                       account.platform !== 'Multi-Chain EVM' && (
                        <Box pt={4} borderTop="1px solid" borderColor="gray.200">
                          <TokenManager accountId={account.id} platform={account.platform} />
                        </Box>
                      )}

                      {/* Connect/Disconnect Button */}
                      <Button
                        variant="outline"
                        colorScheme={account.status === 'connected' ? 'red' : 'blue'}
                        size="sm"
                        w="full"
                        onClick={() => 
                          account.status === 'connected' 
                            ? handleDisconnect(account.id) 
                            : handleConnect(account.id)
                        }
                      >
                        {account.status === 'connected' ? 'Disconnect' : 'Connect'}
                      </Button>
                    </Stack>
                  </Box>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* Empty State */}
        {accounts.length === 0 && (
          <Box p={8} bg="gray.50" borderRadius="lg" textAlign="center">
            <Text fontSize="lg" color="gray.600" mb={4}>
              No connections added yet
            </Text>
            <Text color="gray.500" mb={4}>
              Connect your wallet or exchange to start tracking your portfolio
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
            <strong>Privacy Notice:</strong> All connection data is stored locally in your browser
            or encrypted on IPFS. CygnusWealth never has access to your private keys or API secrets.
          </Text>
        </Box>
      </Stack>
      
      <AddAccountModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </Container>
  );
}