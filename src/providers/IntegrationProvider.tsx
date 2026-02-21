import React, { createContext, useContext, useMemo } from 'react';
import { buildRpcProviderConfig } from '../config/buildRpcProviderConfig';
import { createEvmIntegration, createSolIntegration } from '../config/integrationServices';
import { detectEnvironment } from '../config/environment';
import type { AppRpcProviderConfig } from '../config/rpc-provider-config.types';
import type { ChainRegistry } from '@cygnus-wealth/evm-integration';
import type { SolanaIntegrationFacade } from '@cygnus-wealth/sol-integration';

export interface IntegrationContextValue {
  rpcConfig: AppRpcProviderConfig;
  evmRegistry: InstanceType<typeof ChainRegistry>;
  solanaFacade: InstanceType<typeof SolanaIntegrationFacade>;
}

const IntegrationContext = createContext<IntegrationContextValue | null>(null);

export function IntegrationProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => {
    const env = detectEnvironment();
    const rpcConfig = buildRpcProviderConfig(env, { envVars: import.meta.env });
    const evmRegistry = createEvmIntegration(rpcConfig);
    const solanaFacade = createSolIntegration(rpcConfig);

    return { rpcConfig, evmRegistry, solanaFacade };
  }, []);

  return (
    <IntegrationContext.Provider value={value}>
      {children}
    </IntegrationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIntegration(): IntegrationContextValue {
  const ctx = useContext(IntegrationContext);
  if (!ctx) {
    throw new Error('useIntegration must be used within IntegrationProvider');
  }
  return ctx;
}
