import {
  Container,
  Stack,
  Heading,
  Text,
  Box,
  Button,
  Grid,
} from '@chakra-ui/react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { FiUser, FiShield, FiBell, FiDatabase } from 'react-icons/fi';

interface SettingsItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
}

const settingsItems: SettingsItem[] = [
  {
    id: 'connections',
    label: 'Connections',
    description: 'Manage your wallet and exchange connections',
    icon: FiUser,
    path: '/settings/connections',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Privacy and encryption settings',
    icon: FiShield,
    path: '/settings/security',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Configure alerts and notifications',
    icon: FiBell,
    path: '/settings/notifications',
  },
  {
    id: 'data',
    label: 'Data & Storage',
    description: 'Manage local data and IPFS settings',
    icon: FiDatabase,
    path: '/settings/data',
  },
];

export default function Settings() {
  const location = useLocation();
  const isSettingsRoot = location.pathname === '/settings';

  if (!isSettingsRoot) {
    return <Outlet />;
  }

  return (
    <Container maxW="container.xl" py={8}>
      <Stack gap={8}>
        <Box>
          <Heading as="h1" size="4xl" mb={2}>
            Settings
          </Heading>
          <Text color="gray.600">
            Manage your CygnusWealth preferences
          </Text>
        </Box>

        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
          {settingsItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <Button
                key={item.id}
                asChild
                variant="outline"
                h="auto"
                p={6}
                justifyContent="flex-start"
                textAlign="left"
                bg="white"
                borderColor="gray.200"
                _hover={{
                  bg: 'gray.50',
                  borderColor: 'blue.300',
                }}
              >
                <Link to={item.path}>
                <Stack direction="row" gap={4} align="flex-start" w="full">
                  <Box
                    p={3}
                    bg="blue.50"
                    borderRadius="lg"
                    color="blue.600"
                  >
                    <Icon size={24} />
                  </Box>
                  <Stack gap={1} flex="1">
                    <Text fontWeight="semibold" fontSize="lg" color="gray.800">
                      {item.label}
                    </Text>
                    <Text fontSize="sm" color="gray.600" fontWeight="normal">
                      {item.description}
                    </Text>
                  </Stack>
                </Stack>
                </Link>
              </Button>
            );
          })}
        </Grid>
      </Stack>
    </Container>
  );
}