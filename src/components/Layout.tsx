import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import SideMenu from './SideMenu';
import TestnetBanner from './TestnetBanner';
import EnvironmentIndicator from './EnvironmentIndicator';

export default function Layout() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <Box minH="100vh" bg="gray.50">
      <TestnetBanner />
      <SideMenu onCollapseChange={setIsCollapsed} />

      {/* Main Content Area */}
      <Box
        ml={{ base: 0, md: isCollapsed ? '70px' : '240px' }}
        transition="margin-left 0.2s"
        pt={{ base: 16, md: 0 }}
      >
        <Outlet />
      </Box>
      <EnvironmentIndicator />
    </Box>
  );
}