import { Button } from '@chakra-ui/react';
import { FiInfo } from 'react-icons/fi';

export default function WalletDiagnostics() {
  const runDiagnostics = () => {
    console.log('=== Wallet Diagnostics ===');

    // Check for window.ethereum
    console.log('window.ethereum exists:', !!window.ethereum);

    if (window.ethereum) {
      const eth = window.ethereum as any;
      console.log('ethereum object:', eth);
      console.log('isMetaMask:', eth.isMetaMask);
      console.log('selectedAddress:', eth.selectedAddress);
      console.log('chainId:', eth.chainId);
      console.log('networkVersion:', eth.networkVersion);

      // Check for providers array (multiple wallets)
      if (eth.providers && Array.isArray(eth.providers)) {
        console.log('Multiple providers found:', eth.providers.length);
        eth.providers.forEach((provider: any, index: number) => {
          console.log(`Provider ${index}:`, {
            isMetaMask: provider.isMetaMask,
            isCoinbaseWallet: provider.isCoinbaseWallet,
            isRabby: provider.isRabby,
            isBraveWallet: provider.isBraveWallet,
            _metamask: !!provider._metamask
          });
        });
      } else if (eth.providers) {
        console.log('Providers property exists but is not an array:', typeof eth.providers);
      }

      // Try to access methods
      console.log('Available methods:');
      console.log('- request:', typeof window.ethereum.request);
      console.log('- send:', typeof eth.send);
      console.log('- sendAsync:', typeof eth.sendAsync);
      console.log('- enable:', typeof eth.enable);

      // Check for other wallet indicators
      console.log('\nOther wallet checks:');
      console.log('window.solana:', !!window.solana);
      console.log('window.ethereum.isCoinbaseWallet:', eth.isCoinbaseWallet);
      console.log('window.ethereum.isRabby:', eth.isRabby);
      console.log('window.ethereum.isBraveWallet:', eth.isBraveWallet);
      
      // Try a safe RPC call
      if (typeof window.ethereum.request === 'function') {
        console.log('\nTrying eth_chainId...');
        window.ethereum.request({ method: 'eth_chainId' })
          .then((chainId: string) => console.log('Current chain ID:', chainId))
          .catch((error: any) => console.error('Error getting chain ID:', error));
      } else {
        console.log('Request method not available');
      }
    } else {
      console.log('No ethereum provider found!');
    }
    
    console.log('=== End Diagnostics ===');
  };

  return (
    <Button
      variant="outline"
      onClick={runDiagnostics}
    >
      <FiInfo />
      Run Diagnostics
    </Button>
  );
}