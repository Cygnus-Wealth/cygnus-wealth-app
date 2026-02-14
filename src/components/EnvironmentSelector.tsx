import { Box, Flex, Text } from '@chakra-ui/react';
import type { NetworkEnvironment } from '@cygnus-wealth/data-models';
import { useStore } from '../store/useStore';

const ENVIRONMENT_OPTIONS: { value: NetworkEnvironment; label: string; description: string }[] = [
  { value: 'production', label: 'Production', description: 'Mainnet' },
  { value: 'testnet', label: 'Testnet', description: 'Sepolia, Devnet' },
  { value: 'local', label: 'Local', description: 'Localhost' },
];

export default function EnvironmentSelector() {
  const networkEnvironment = useStore((s) => s.networkEnvironment);
  const setNetworkEnvironment = useStore((s) => s.setNetworkEnvironment);

  return (
    <Box data-testid="environment-selector">
      <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1} textTransform="uppercase">
        Network
      </Text>
      <Flex gap={1}>
        {ENVIRONMENT_OPTIONS.map((opt) => (
          <Box
            key={opt.value}
            as="button"
            data-testid={`env-option-${opt.value}`}
            onClick={() => setNetworkEnvironment(opt.value)}
            px={2}
            py={1}
            borderRadius="md"
            fontSize="xs"
            fontWeight="medium"
            cursor="pointer"
            bg={networkEnvironment === opt.value ? getActiveBg(opt.value) : 'gray.100'}
            color={networkEnvironment === opt.value ? getActiveColor(opt.value) : 'gray.600'}
            _hover={{
              bg: networkEnvironment === opt.value ? getActiveBg(opt.value) : 'gray.200',
            }}
            title={opt.description}
          >
            {opt.label}
          </Box>
        ))}
      </Flex>
    </Box>
  );
}

function getActiveBg(env: NetworkEnvironment): string {
  switch (env) {
    case 'production': return 'green.100';
    case 'testnet': return 'orange.100';
    case 'local': return 'purple.100';
  }
}

function getActiveColor(env: NetworkEnvironment): string {
  switch (env) {
    case 'production': return 'green.800';
    case 'testnet': return 'orange.800';
    case 'local': return 'purple.800';
  }
}
