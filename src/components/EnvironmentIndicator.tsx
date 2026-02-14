import { Box, Text } from '@chakra-ui/react';
import { useStore } from '../store/useStore';
import type { NetworkEnvironment } from '@cygnus-wealth/data-models';

const BADGE_STYLES: Record<NetworkEnvironment, { bg: string; color: string; label: string }> = {
  production: { bg: 'red.500', color: 'white', label: 'PRODUCTION' },
  testnet: { bg: 'yellow.400', color: 'black', label: 'TESTNET' },
  local: { bg: 'green.500', color: 'white', label: 'LOCAL' },
};

export default function EnvironmentIndicator() {
  const networkEnvironment = useStore((s) => s.networkEnvironment);
  const style = BADGE_STYLES[networkEnvironment];

  return (
    <Box
      data-testid="environment-indicator"
      position="fixed"
      bottom={4}
      right={4}
      zIndex="banner"
      pointerEvents={networkEnvironment === 'production' ? 'auto' : 'none'}
    >
      <Box
        bg={style.bg}
        color={style.color}
        px={3}
        py={1}
        borderRadius="full"
        fontSize="xs"
        fontWeight="bold"
        boxShadow="md"
        userSelect="none"
      >
        <Text>{style.label}</Text>
      </Box>
    </Box>
  );
}
