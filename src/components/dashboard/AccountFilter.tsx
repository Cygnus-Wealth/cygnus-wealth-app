import {
  Box,
  Text,
  Flex,
  Badge,
  Stack,
} from '@chakra-ui/react';
import { FiCheck, FiMinus } from 'react-icons/fi';
import { useAccountFilter } from '../../hooks/useAccountFilter';

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AccountFilter() {
  const {
    accountGroups,
    isAllSelected,
    isAccountSelected,
    isGroupSelected,
    isGroupPartiallySelected,
    toggleAccount,
    toggleGroup,
    selectAll,
    selectedCount,
    totalWalletCount,
  } = useAccountFilter();

  if (totalWalletCount === 0) return null;

  return (
    <Box
      p={4}
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      shadow="sm"
    >
      <Flex justify="space-between" align="center" mb={3}>
        <Flex align="center" gap={2}>
          <Text fontWeight="semibold" fontSize="sm" color="gray.700">
            Account Filter
          </Text>
          <Badge colorScheme="blue" variant="subtle" fontSize="xs">
            {selectedCount} of {totalWalletCount}
          </Badge>
        </Flex>
        <Box
          data-testid="select-all-accounts"
          as="button"
          fontSize="xs"
          color={isAllSelected ? 'gray.400' : 'blue.500'}
          fontWeight="medium"
          cursor="pointer"
          _hover={{ textDecoration: 'underline' }}
          onClick={selectAll}
        >
          Select All
        </Box>
      </Flex>

      <Stack gap={2}>
        {accountGroups.map(group => {
          const groupFullySelected = isGroupSelected(group.connectionType);
          const groupPartial = isGroupPartiallySelected(group.connectionType);

          return (
            <Box key={group.connectionType}>
              {/* Group header */}
              <Flex
                data-testid={`group-toggle-${group.connectionType}`}
                align="center"
                gap={2}
                py={1}
                px={2}
                borderRadius="md"
                cursor="pointer"
                _hover={{ bg: 'gray.50' }}
                onClick={() => toggleGroup(group.connectionType)}
              >
                <Flex
                  align="center"
                  justify="center"
                  w="16px"
                  h="16px"
                  borderRadius="sm"
                  border="2px solid"
                  borderColor={groupFullySelected || groupPartial ? 'blue.500' : 'gray.300'}
                  bg={groupFullySelected ? 'blue.500' : 'transparent'}
                  color="white"
                  flexShrink={0}
                >
                  {groupFullySelected && <FiCheck size={10} />}
                  {groupPartial && <Box as={FiMinus} color="blue.500" w="10px" h="10px" />}
                </Flex>
                <Text fontWeight="semibold" fontSize="sm" color="gray.700">
                  {group.connectionType}
                </Text>
                <Badge variant="outline" fontSize="xs" colorScheme="gray">
                  {group.accounts.length}
                </Badge>
              </Flex>

              {/* Individual accounts */}
              <Stack gap={0} ml={6} mt={1}>
                {group.accounts.map(account => {
                  const selected = isAccountSelected(account.id);

                  return (
                    <Flex
                      key={account.id}
                      data-testid={`account-toggle-${account.id}`}
                      align="center"
                      gap={2}
                      py={1}
                      px={2}
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: 'gray.50' }}
                      onClick={() => toggleAccount(account.id)}
                    >
                      <Flex
                        align="center"
                        justify="center"
                        w="14px"
                        h="14px"
                        borderRadius="sm"
                        border="2px solid"
                        borderColor={selected ? 'blue.500' : 'gray.300'}
                        bg={selected ? 'blue.500' : 'transparent'}
                        color="white"
                        flexShrink={0}
                      >
                        {selected && <FiCheck size={8} />}
                      </Flex>
                      <Text fontSize="sm" color={selected ? 'gray.700' : 'gray.400'}>
                        {account.label}
                      </Text>
                      {account.address && (
                        <Text fontSize="xs" color="gray.400" fontFamily="mono">
                          {truncateAddress(account.address)}
                        </Text>
                      )}
                      <Box ml="auto">
                        <Box
                          w="6px"
                          h="6px"
                          borderRadius="full"
                          bg={account.status === 'connected' ? 'green.400' : 'gray.300'}
                        />
                      </Box>
                    </Flex>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
