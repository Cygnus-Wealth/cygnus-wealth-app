import { useState } from 'react';
import {
  Box,
  Stack,
  Text,
  IconButton,
  Drawer,
  Portal,
  Button,
  Flex,
} from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiHome, FiSettings, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import EnvironmentSelector from './EnvironmentSelector';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  subItems?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: FiHome, path: '/' },
  { 
    id: 'settings', 
    label: 'Settings', 
    icon: FiSettings, 
    path: '/settings',
    subItems: [
      { id: 'connections', label: 'Connections', icon: FiSettings, path: '/settings/connections' },
    ]
  },
];

interface SideMenuProps {
  onCollapseChange?: (collapsed: boolean) => void;
}

export default function SideMenu({ onCollapseChange }: SideMenuProps = {}) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const MenuButton = ({ item }: { item: MenuItem }) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <Button
        asChild
        variant="ghost"
        w="full"
        justifyContent={isCollapsed ? 'center' : 'flex-start'}
        bg={active ? 'blue.50' : 'transparent'}
        color={active ? 'blue.600' : 'gray.700'}
        _hover={{
          bg: active ? 'blue.100' : 'gray.50',
        }}
        px={isCollapsed ? 2 : 4}
        position="relative"
      >
        <Link to={item.path}>
        {isCollapsed ? (
          <>
            <Icon size={20} />
            <Box
              position="absolute"
              left="-2px"
              top="0"
              bottom="0"
              w="4px"
              bg={active ? 'blue.500' : 'transparent'}
              borderRadius="0 2px 2px 0"
            />
          </>
        ) : (
          <>
            <Icon size={20} />
            <Text>{item.label}</Text>
            <Box
              position="absolute"
              left="0"
              top="0"
              bottom="0"
              w="4px"
              bg={active ? 'blue.500' : 'transparent'}
              borderRadius="0 2px 2px 0"
            />
          </>
        )}
        </Link>
      </Button>
    );
  };

  // Desktop Sidebar
  const DesktopSidebar = () => (
    <Box
      w={isCollapsed ? '70px' : '240px'}
      h="100vh"
      bg="white"
      borderRight="1px solid"
      borderColor="gray.200"
      position="fixed"
      left="0"
      top="0"
      transition="width 0.2s"
      display={{ base: 'none', md: 'block' }}
    >
      <Flex direction="column" h="full">
        {/* Header */}
        <Box p={4} borderBottom="1px solid" borderColor="gray.200">
          <Flex justify="space-between" align="center">
            {!isCollapsed && (
              <Text fontSize="xl" fontWeight="bold" color="blue.600">
                CygnusWealth
              </Text>
            )}
            <IconButton
              aria-label="Toggle Sidebar"
              variant="ghost"
              size="sm"
              onClick={() => {
                const newCollapsed = !isCollapsed;
                setIsCollapsed(newCollapsed);
                onCollapseChange?.(newCollapsed);
              }}
            >
              {isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
            </IconButton>
          </Flex>
        </Box>

        {/* Menu Items */}
        <Stack gap={2} p={3} flex="1">
          {menuItems.map((item) => (
            <Box key={item.id}>
              <MenuButton item={item} />
              {item.subItems && location.pathname.startsWith(item.path) && !isCollapsed && (
                <Stack gap={1} ml={4} mt={1}>
                  {item.subItems.map((subItem) => (
                    <Button
                      key={subItem.id}
                      asChild
                      variant="ghost"
                      size="sm"
                      w="full"
                      justifyContent="flex-start"
                      bg={location.pathname === subItem.path ? 'blue.50' : 'transparent'}
                      color={location.pathname === subItem.path ? 'blue.600' : 'gray.600'}
                      _hover={{
                        bg: location.pathname === subItem.path ? 'blue.100' : 'gray.100',
                      }}
                      pl={8}
                    >
                      <Link to={subItem.path}>
                        {subItem.label}
                      </Link>
                    </Button>
                  ))}
                </Stack>
              )}
            </Box>
          ))}
        </Stack>

        {/* Environment Selector */}
        {!isCollapsed && (
          <Box p={3} borderTop="1px solid" borderColor="gray.200">
            <EnvironmentSelector />
          </Box>
        )}
      </Flex>
    </Box>
  );

  // Mobile Drawer
  const MobileDrawer = () => (
    <>
      <IconButton
        aria-label="Open Menu"
        position="fixed"
        top="4"
        left="4"
        display={{ base: 'flex', md: 'none' }}
        onClick={() => setIsOpen(true)}
        bg="white"
        shadow="md"
        zIndex="1000"
        _hover={{ bg: 'gray.100' }}
      >
        <FiMenu />
      </IconButton>

      <Drawer.Root open={isOpen} placement="start" onOpenChange={(e) => setIsOpen(e.open)}>
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Flex justify="space-between" align="center">
                  <Text fontSize="xl" fontWeight="bold" color="blue.600">
                    CygnusWealth
                  </Text>
                  <Drawer.CloseTrigger asChild>
                    <IconButton
                      aria-label="Close menu"
                      variant="ghost"
                      size="sm"
                    >
                      <FiX />
                    </IconButton>
                  </Drawer.CloseTrigger>
                </Flex>
              </Drawer.Header>
              <Drawer.Body p={0}>
                <Stack gap={0}>
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    
                    return (
                      <Box key={item.id}>
                        <Button
                          asChild
                          variant="ghost"
                          w="full"
                          justifyContent="flex-start"
                          bg={active ? 'blue.50' : 'transparent'}
                          color={active ? 'blue.600' : 'gray.700'}
                          _hover={{
                            bg: active ? 'blue.100' : 'gray.100',
                          }}
                          px={6}
                          py={6}
                          borderRadius="0"
                          onClick={() => !item.subItems && setIsOpen(false)}
                        >
                          <Link to={item.path}>
                            <Icon size={20} />
                            {item.label}
                          </Link>
                        </Button>
                        {item.subItems && location.pathname.startsWith(item.path) && (
                          <Stack gap={0}>
                            {item.subItems.map((subItem) => (
                              <Button
                                key={subItem.id}
                                asChild
                                variant="ghost"
                                w="full"
                                justifyContent="flex-start"
                                bg={location.pathname === subItem.path ? 'blue.50' : 'transparent'}
                                color={location.pathname === subItem.path ? 'blue.600' : 'gray.600'}
                                _hover={{
                                  bg: location.pathname === subItem.path ? 'blue.100' : 'gray.100',
                                }}
                                pl={16}
                                py={4}
                                borderRadius="0"
                                fontSize="sm"
                                onClick={() => setIsOpen(false)}
                              >
                                <Link to={subItem.path}>
                                  {subItem.label}
                                </Link>
                              </Button>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </>
  );

  return (
    <>
      <DesktopSidebar />
      <MobileDrawer />
    </>
  );
}