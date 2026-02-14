declare global {
  interface EthereumProvider {
    isMetaMask?: boolean;
    isRabby?: boolean;
    isCoinbaseWallet?: boolean;
    isBraveWallet?: boolean;
    selectedAddress?: string | null;
    chainId?: string | null;
    networkVersion?: string | null;
    _metamask?: any;

    request: (args: {
      method: string;
      params?: any[];
    }) => Promise<any>;

    on?: (event: string, handler: (...args: any[]) => void) => void;
    removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    send?: (method: string, params?: any[]) => Promise<any>;
    sendAsync?: (request: any, callback: (error: any, response: any) => void) => void;
    enable?: () => Promise<string[]>;

    providers?: EthereumProvider[];
  }

  interface Window {
    ethereum?: EthereumProvider;
    solana?: any;
    suiet?: any;
    sui?: any;
    __walletManager?: any;
  }
}

export {};
