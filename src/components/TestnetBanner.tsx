import { Box, Text } from '@chakra-ui/react';
import { useStore } from '../store/useStore';

export default function TestnetBanner() {
  const networkEnvironment = useStore((s) => s.networkEnvironment);

  if (networkEnvironment === 'production') return null;

  const isTestnet = networkEnvironment === 'testnet';

  return (
    <Box
      data-testid="testnet-banner"
      bg={isTestnet ? 'orange.400' : 'purple.400'}
      color="white"
      textAlign="center"
      py={1}
      px={4}
      fontSize="sm"
      fontWeight="bold"
    >
      <Text>
        {isTestnet
          ? 'TESTNET MODE - Using test networks. Assets have no real value.'
          : 'LOCAL MODE - Connected to localhost. Assets have no real value.'}
      </Text>
    </Box>
  );
}
