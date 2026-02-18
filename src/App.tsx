import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import Connections from './components/settings/Connections'
import WalletDetails from './components/settings/WalletDetails'
import Layout from './components/Layout'
import { IntegrationProvider } from './providers/IntegrationProvider'

function App() {
  return (
    <ChakraProvider value={defaultSystem}>
      <IntegrationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="settings" element={<Settings />}>
                <Route path="connections" element={<Connections />} />
                <Route path="wallet-details/:connectionType" element={<WalletDetails />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </IntegrationProvider>
    </ChakraProvider>
  )
}

export default App
