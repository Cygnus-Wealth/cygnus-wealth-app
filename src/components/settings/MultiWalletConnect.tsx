import { useState } from 'react';
import {
  Button,
  Menu,
  Box,
  Text,
  Stack,
  createToaster,
  Image
} from '@chakra-ui/react';
import { FiExternalLink } from 'react-icons/fi';
import { useStore } from '../../store/useStore';
import {
  IntegrationSource
} from '@cygnus-wealth/wallet-integration-system';
import phantomIcon from '../../assets/phantom-icon.svg';
import slushIcon from '../../assets/slush-icon.svg';

const toaster = createToaster({
  placement: 'top'
});

interface WalletProvider {
  name: string;
  icon?: string;
  source: IntegrationSource;
  check: () => boolean;
  type: 'evm' | 'solana' | 'sui';
}

// Window interfaces for Solana and SUI are declared in src/types/global.d.ts

/** Cast window.ethereum to our full EthereumProvider type (the library ships a narrow one) */
function eth(): EthereumProvider | undefined {
  return window.ethereum as EthereumProvider | undefined;
}

const WALLET_PROVIDERS: WalletProvider[] = [
  // EVM Wallets
  {
    name: 'MetaMask',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
    source: IntegrationSource.METAMASK,
    type: 'evm',
    check: () => {
      if (eth()?.providers?.length) {
        return eth()!.providers!.some((p: any) => p.isMetaMask) as boolean;
      }
      return eth()?.isMetaMask || false;
    }
  },
  {
    name: 'Rabby',
    icon: 'https://rabby.io/assets/logo.png',
    source: IntegrationSource.RABBY,
    type: 'evm',
    check: () => {
      if (eth()?.providers?.length) {
        return eth()!.providers!.some((p: any) => p.isRabby) as boolean;
      }
      return eth()?.isRabby || false;
    }
  },
  {
    name: 'Coinbase Wallet',
    source: IntegrationSource.COINBASE,
    type: 'evm',
    check: () => {
      if (eth()?.providers?.length) {
        return eth()!.providers!.some((p: any) => p.isCoinbaseWallet) as boolean;
      }
      return eth()?.isCoinbaseWallet || false;
    }
  },
  {
    name: 'Brave Wallet',
    source: IntegrationSource.METAMASK, // Brave uses MetaMask-like interface
    type: 'evm',
    check: () => {
      const eth = window.ethereum as any;
      if (eth?.providers?.length) {
        return eth.providers.some((p: any) => p.isBraveWallet) as boolean;
      }
      return eth?.isBraveWallet || false;
    }
  },
  // Solana Wallets
  {
    name: 'Phantom',
    icon: phantomIcon,
    source: IntegrationSource.PHANTOM,
    type: 'solana',
    check: () => window.solana?.isPhantom || false
  },
  // SUI Wallets
  {
    name: 'Slush',
    icon: slushIcon,
    source: IntegrationSource.SLUSH,
    type: 'sui',
    check: () => {
      // Slush uses Wallet Standard, so we check for it differently
      // For now, we'll assume it's available if no legacy Sui wallet is detected
      return typeof window !== 'undefined' && !window.suiet;
    }
  },
  {
    name: 'Suiet',
    icon: 'https://suiet.app/favicon.ico',
    source: IntegrationSource.SUIET,
    type: 'sui',
    check: () => window.suiet !== undefined
  }
];


export default function MultiWalletConnect() {
  const [isConnecting, setIsConnecting] = useState(false);
  const { addAccount } = useStore();

  const detectWallets = () => {
    return WALLET_PROVIDERS.filter(wallet => {
      try {
        return wallet.check();
      } catch (e) {
        console.error(`Error checking ${wallet.name}:`, e);
        return false;
      }
    });
  };

  const handleConnect = async (wallet: WalletProvider) => {
    setIsConnecting(true);
    
    try {
      // Generate a unique wallet ID
      const walletId = `wallet-${wallet.name.toLowerCase()}-${Date.now()}`;
      console.log(`Connecting with ${wallet.name}...`);
      
      // Handle different wallet types
      if (wallet.type === 'solana') {
        await handleSolanaConnect(wallet, walletId);
      } else if (wallet.type === 'sui') {
        await handleSuiConnect(wallet, walletId);
      } else {
        // Existing EVM logic
        await handleEvmConnect(wallet, walletId);
      }
    } catch (error) {
      console.error('Connection error:', error);
      
      let message = 'Failed to connect wallet';
      const errorCode = (error as any).code;
      const errorMessage = (error as any).message?.toLowerCase() || '';
      
      if (errorCode === 4001) {
        message = 'You rejected the connection';
      } else if (errorCode === -32002) {
        message = 'A connection request is already pending. Please check your wallet.';
      } else if (errorMessage.includes('unexpected error') || errorMessage.includes('selectextension')) {
        // Firefox-specific error when multiple wallets are installed
        message = `Please make sure ${wallet.name} is unlocked and try again. If you have multiple wallets installed, you may need to disable other wallet extensions temporarily.`;
      } else if ((error as any).message) {
        message = (error as any).message;
      }
      
      toaster.create({
        title: 'Connection Failed',
        description: message,
        type: 'error',
        duration: 5000,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSolanaConnect = async (wallet: WalletProvider, walletId: string) => {
    if (!window.solana) {
      throw new Error('Phantom wallet not found');
    }

    const resp = await window.solana.connect();
    const publicKey = resp.publicKey.toString();
    
    addAccount({
      id: `${walletId}-account-0`,
      type: 'wallet',
      platform: 'Solana',
      label: `${wallet.name} Account`,
      address: publicKey,
      status: 'connected',
      metadata: {
        walletManagerId: walletId,
        chains: ['Solana'],
        source: wallet.source,
        walletType: wallet.name,
        detectedChains: ['Solana'],
        allAddresses: [publicKey],
        accountCount: 1,
        walletId: walletId,
        connectionType: wallet.name,
        walletLabel: `${wallet.name} Wallet`,
        useWalletManager: false
      }
    });
    
    // Store connection info for balance fetching
    (window as any).__cygnusConnections = (window as any).__cygnusConnections || {};
    (window as any).__cygnusConnections[walletId] = {
      provider: window.solana,
      chains: ['Solana'],
      accounts: [publicKey],
      type: 'solana'
    };
    
    toaster.create({
      title: 'Wallet Connected',
      description: `Connected ${wallet.name} wallet on Solana`,
      type: 'success',
      duration: 5000,
    });
  };

  const handleSuiConnect = async (wallet: WalletProvider, walletId: string) => {
    try {
      // Use WalletManager with the proper IntegrationSource
      const { WalletManager, Chain } = await import('@cygnus-wealth/wallet-integration-system');
      const { getPreferredRpcEndpoint } = await import('../../config/rpc');
      
      // Configure WalletManager with SUI RPC
      const walletManager = new WalletManager({
        rpcUrl: getPreferredRpcEndpoint('sui')
      });
      
      // Connect to the SUI wallet
      const connection = await walletManager.connectWallet(Chain.SUI, wallet.source);
      
      if (!connection.accounts || connection.accounts.length === 0) {
        throw new Error('No SUI accounts found');
      }
      
      // Add each account
      connection.accounts.forEach((account, index) => {
        addAccount({
          id: `${walletId}-account-${index}`,
          type: 'wallet',
          platform: 'SUI',
          label: `${wallet.name} Account ${index + 1}`,
          address: account.address,
          status: 'connected',
          metadata: {
            walletManagerId: walletId,
            chains: ['SUI'],
            source: wallet.source,
            walletType: wallet.name,
            detectedChains: ['SUI'],
            allAddresses: [account.address],
            accountCount: 1,
            walletId: walletId,
            connectionType: wallet.name,
            walletLabel: `${wallet.name} Wallet`,
            useWalletManager: true,
          }
        });
      });
      
      // Store the wallet manager instance for balance fetching
      (window as any).__cygnusWalletManager = walletManager;
      
      toaster.create({
        title: 'Wallet Connected',
        description: `Connected ${connection.accounts.length} ${wallet.name} account${connection.accounts.length > 1 ? 's' : ''} on SUI`,
        type: 'success',
        duration: 5000,
      });
    } catch (error) {
      console.error('Failed to connect SUI wallet:', error);
      
      // Fallback to legacy method for Suiet
      if (wallet.source === IntegrationSource.SUIET && window.suiet) {
        const provider = window.suiet;

        // Request permissions
        await provider.requestPermissions?.();
        
        // Get accounts
        const accounts = await provider.getAccounts();
        if (!accounts || accounts.length === 0) {
          throw new Error('No Sui accounts found');
        }
        
        // Add each account
        accounts.forEach((account: string, index: number) => {
          addAccount({
            id: `${walletId}-account-${index}`,
            type: 'wallet',
            platform: 'SUI',
            label: `${wallet.name} Account ${index + 1}`,
            address: account,
            status: 'connected',
            metadata: {
              walletManagerId: walletId,
              chains: ['SUI'],
              source: wallet.source,
              walletType: wallet.name,
              detectedChains: ['SUI'],
              allAddresses: [account],
              accountCount: 1,
              walletId: walletId,
              connectionType: wallet.name,
              walletLabel: `${wallet.name} Wallet`,
              useWalletManager: false
            }
          });
        });
        
        toaster.create({
          title: 'Wallet Connected',
          description: `Connected ${accounts.length} ${wallet.name} account${accounts.length > 1 ? 's' : ''} on SUI`,
          type: 'success',
          duration: 5000,
        });
      } else {
        throw error;
      }
    }
  };

  const handleEvmConnect = async (wallet: WalletProvider, walletId: string) => {
      // Connect to each configured chain
      const connectedChains: string[] = [];
      let allAccountsArray: any[] = [];
      
      // Get the correct provider based on the wallet
      let provider = window.ethereum;
      const eth = window.ethereum as any;

      // Handle multiple providers case (common in Firefox)
      if (eth?.providers?.length) {
        // Find the specific provider for this wallet
        if (wallet.name === 'MetaMask') {
          provider = eth.providers.find((p: any) => p.isMetaMask && !p.isRabby && !p.isBraveWallet) || window.ethereum;
        } else if (wallet.name === 'Rabby') {
          provider = eth.providers.find((p: any) => p.isRabby) || window.ethereum;
        } else if (wallet.name === 'Brave Wallet') {
          provider = eth.providers.find((p: any) => p.isBraveWallet) || window.ethereum;
        }
      }

      if (!provider) {
        throw new Error('No Ethereum provider found');
      }
      
      // Request all accounts
      console.log(`Getting all accounts from ${wallet.name}...`);
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }
      
      allAccountsArray = accounts;
      console.log(`Found ${accounts.length} accounts from ${wallet.name}`);
      
      // Try to detect which chains are configured
      const chainChecks = [
        { chainId: '0x1', name: 'Ethereum' },
        { chainId: '0x89', name: 'Polygon' },
        { chainId: '0x38', name: 'BSC' },
        { chainId: '0xa4b1', name: 'Arbitrum' },
        { chainId: '0xa', name: 'Optimism' },
        { chainId: '0xa86a', name: 'Avalanche' },
        { chainId: '0x2105', name: 'Base' }
      ];
      
      // Get current chain
      const currentChainId = await provider.request({ method: 'eth_chainId' });
      
      // Try each chain
      for (const chain of chainChecks) {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chain.chainId }]
          });
          connectedChains.push(chain.name);
          console.log(`Chain ${chain.name} is configured`);
        } catch (error: any) {
          if (error.code === 4902) {
            console.log(`Chain ${chain.name} not configured`);
          } else if (error.code === 4001) {
            console.log('User rejected chain switch');
            break;
          }
        }
      }
      
      // Switch back to original chain
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: currentChainId }]
        });
      } catch {}
      
      if (connectedChains.length === 0) {
        connectedChains.push('Ethereum'); // At least Ethereum should work
      }
      
      console.log(`Connected to ${connectedChains.length} chains with ${allAccountsArray.length} accounts`);
      
      // Add each account as a separate entry in our store
      allAccountsArray.forEach((account, index) => {
        const accountId = `${walletId}-account-${index}`;
        const address = account.address || account; // Handle both account objects and plain addresses
        
        addAccount({
          id: accountId,
          type: 'wallet',
          platform: 'Multi-Chain EVM',
          label: account.label || `${wallet.name} Account ${index + 1}`,
          address: address,
          status: 'connected',
          metadata: {
            walletManagerId: walletId,
            chains: connectedChains,
            source: wallet.source,
            walletType: wallet.name,
            detectedChains: connectedChains,
            allAddresses: [address],
            accountCount: 1,
            walletId: walletId,
            connectionType: wallet.name,
            walletLabel: `${wallet.name} Wallet`,
            useWalletManager: false // Not using WalletManager
          }
        });
      });
      
      // Store connection info globally for balance fetching
      (window as any).__cygnusConnections = (window as any).__cygnusConnections || {};
      (window as any).__cygnusConnections[walletId] = {
        provider,
        chains: connectedChains,
        accounts: allAccountsArray
      };
      
      toaster.create({
        title: 'Wallet Connected',
        description: `Connected ${allAccountsArray.length} ${wallet.name} account${allAccountsArray.length > 1 ? 's' : ''} across ${connectedChains.length} chain${connectedChains.length > 1 ? 's' : ''}`,
        type: 'success',
        duration: 5000,
      });
  };

  const availableWallets = detectWallets();

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          colorPalette="purple"
          loading={isConnecting}
          loadingText="Connecting..."
        >
          <FiExternalLink />
          Multi-Chain Connect
        </Button>
      </Menu.Trigger>
      
      <Menu.Positioner>
        <Menu.Content minW="250px">
          <Box p={2}>
            <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={2}>
              Select Wallet
            </Text>
            <Stack gap={1}>
              {availableWallets.length === 0 ? (
                <Text fontSize="sm" color="gray.500" p={2}>
                  No wallets detected. Please install a wallet extension.
                </Text>
              ) : (
                availableWallets.map((wallet) => (
                  <Menu.Item
                    key={wallet.name}
                    value={wallet.name}
                    onClick={() => handleConnect(wallet)}
                  >
                    <Box display="flex" alignItems="center" gap={2} w="full">
                      {wallet.icon && (
                        <Image src={wallet.icon} alt={wallet.name} w={5} h={5} />
                      )}
                      <Text>{wallet.name}</Text>
                    </Box>
                  </Menu.Item>
                ))
              )}
            </Stack>
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}