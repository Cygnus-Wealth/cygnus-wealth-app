declare global {
  interface EthereumProvider {
    isMetaMask?: boolean;
    isRabby?: boolean;
    isCoinbaseWallet?: boolean;
    isBraveWallet?: boolean;
    selectedAddress?: string | null;
    chainId?: string | null;
    networkVersion?: string | null;
    _metamask?: Record<string, unknown>;

    request: (args: {
      method: string;
      params?: unknown[];
    }) => Promise<unknown>;

    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    send?: (method: string, params?: unknown[]) => Promise<unknown>;
    sendAsync?: (request: unknown, callback: (error: unknown, response: unknown) => void) => void;
    enable?: () => Promise<string[]>;

    providers?: EthereumProvider[];
  }

  interface Window {
    ethereum?: EthereumProvider;
    solana?: Record<string, unknown>;
    suiet?: Record<string, unknown>;
    sui?: Record<string, unknown>;
    __walletManager?: Record<string, unknown>;
  }
}

export {};
