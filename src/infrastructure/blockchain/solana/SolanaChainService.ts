/**
 * Solana Chain Service
 * 
 * Implements chain-specific operations for Solana blockchain.
 * Uses the RPC Configuration Service to manage endpoints and provides
 * a clean interface for balance fetching, token operations, and health checks.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import type { ParsedAccountData } from '@solana/web3.js';
import { rpcConfigService } from '../../rpc/RpcConfigurationService';
import { ChainId } from '../../../domain/chain/ChainId';
import { AssetValue } from '../../../domain/asset/AssetValue';
import { Result } from '../../../domain/shared/Result';
import { 
  ExternalServiceError, 
  NetworkError, 
  ValidationError, 
  TimeoutError 
} from '../../../domain/shared/DomainError';

export interface SolanaBalance {
  publicKey: string;
  balance: AssetValue;
}

export interface SolanaTokenBalance {
  publicKey: string;
  mint: string;
  balance: AssetValue;
  tokenAccount: string;
  symbol?: string;
  name?: string;
}

export interface SolanaAccountInfo {
  publicKey: string;
  solBalance: AssetValue;
  tokenBalances: SolanaTokenBalance[];
  totalAccounts: number;
}

export class SolanaChainService {
  private connection: Connection;
  private readonly chainId: ChainId;
  private readonly maxRetries: number = 3;
  private readonly requestTimeout: number = 10000; // 10 seconds

  constructor() {
    this.chainId = ChainId.fromChainType('solana');
    this.connection = this.createConnection();
  }

  /**
   * Create a new Solana connection using the active RPC endpoint
   */
  private createConnection(): Connection {
    const rpcUrl = rpcConfigService.getActiveEndpoint('solana');
    return new Connection(rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: undefined, // We'll use HTTP only for now
      confirmTransactionInitialTimeout: this.requestTimeout,
    });
  }

  /**
   * Reconnect to a different RPC endpoint
   */
  private async reconnect(): Promise<void> {
    const currentUrl = rpcConfigService.getActiveEndpoint('solana');
    const nextUrl = rpcConfigService.getNextHealthyEndpoint('solana', currentUrl);
    
    if (nextUrl && nextUrl !== currentUrl) {
      rpcConfigService.setActiveEndpoint('solana', nextUrl);
      this.connection = this.createConnection();
    }
  }

  /**
   * Execute an RPC operation with retry logic and fallback endpoints
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<Result<T, ExternalServiceError | NetworkError | TimeoutError>> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Add timeout to the operation
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), this.requestTimeout);
        });

        const result = await Promise.race([operation(), timeoutPromise]);
        
        // Mark endpoint as healthy on successful request
        const currentUrl = rpcConfigService.getActiveEndpoint('solana');
        rpcConfigService.updateEndpointHealth('solana', currentUrl, true);
        
        return Result.success(result);
      } catch (error) {
        lastError = error as Error;
        const currentUrl = rpcConfigService.getActiveEndpoint('solana');
        
        // Mark endpoint as unhealthy
        rpcConfigService.updateEndpointHealth('solana', currentUrl, false);
        
        // If this is the last attempt, don't try to reconnect
        if (attempt === this.maxRetries) {
          break;
        }
        
        // Try to reconnect to a different endpoint
        await this.reconnect();
        
        // Wait before retry (exponential backoff)
        await this.delay(Math.pow(2, attempt - 1) * 1000);
      }
    }
    
    // Determine error type based on the last error
    if (lastError?.message.includes('timeout') || lastError?.message.includes('TIMEOUT')) {
      return Result.failure(new TimeoutError(operationName, this.requestTimeout));
    }
    
    if (lastError?.message.includes('network') || lastError?.message.includes('NETWORK_ERROR')) {
      return Result.failure(new NetworkError(operationName, lastError.message, rpcConfigService.getActiveEndpoint('solana')));
    }
    
    return Result.failure(new ExternalServiceError(
      'Solana RPC',
      operationName,
      lastError?.message || 'Unknown error occurred',
      lastError
    ));
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate a Solana public key
   */
  private validatePublicKey(publicKeyString: string): Result<PublicKey, ValidationError> {
    try {
      const publicKey = new PublicKey(publicKeyString);
      return Result.success(publicKey);
    } catch {
      return Result.failure(new ValidationError(
        `Invalid Solana public key: ${publicKeyString}`,
        'publicKey',
        publicKeyString
      ));
    }
  }

  /**
   * Get SOL balance for a public key
   */
  public async getSolBalance(publicKeyString: string): Promise<Result<SolanaBalance, ExternalServiceError | NetworkError | ValidationError | TimeoutError>> {
    const publicKeyResult = this.validatePublicKey(publicKeyString);
    if (publicKeyResult.isFailure) {
      return Result.failure(publicKeyResult.error);
    }
    
    const publicKey = publicKeyResult.value;
    
    const balanceResult = await this.executeWithRetry(
      async () => {
        const lamports = await this.connection.getBalance(publicKey);
        return lamports;
      },
      'getSolBalance'
    );
    
    if (balanceResult.isFailure) {
      return Result.failure(balanceResult.error);
    }
    
    const balance = AssetValue.fromWei(balanceResult.value.toString(), 'SOL', 9);
    
    return Result.success({
      publicKey: publicKeyString,
      balance
    });
  }

  /**
   * Get all token balances for a public key
   */
  public async getTokenBalances(publicKeyString: string): Promise<Result<SolanaTokenBalance[], ExternalServiceError | NetworkError | ValidationError | TimeoutError>> {
    const publicKeyResult = this.validatePublicKey(publicKeyString);
    if (publicKeyResult.isFailure) {
      return Result.failure(publicKeyResult.error);
    }
    
    const publicKey = publicKeyResult.value;
    
    const tokenAccountsResult = await this.executeWithRetry(
      async () => {
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        );
        return tokenAccounts;
      },
      'getTokenBalances'
    );
    
    if (tokenAccountsResult.isFailure) {
      return Result.failure(tokenAccountsResult.error);
    }
    
    const tokenAccounts = tokenAccountsResult.value.value;
    const tokenBalances: SolanaTokenBalance[] = [];
    
    for (const tokenAccount of tokenAccounts) {
      const accountData = tokenAccount.account.data as ParsedAccountData;
      const parsedInfo = accountData.parsed.info;
      
      if (parsedInfo.tokenAmount && parsedInfo.tokenAmount.uiAmount > 0) {
        const mint = parsedInfo.mint;
        const balance = AssetValue.fromString(
          parsedInfo.tokenAmount.uiAmountString,
          'TOKEN', // Generic symbol, can be resolved later
          parsedInfo.tokenAmount.decimals,
          mint
        );
        
        tokenBalances.push({
          publicKey: publicKeyString,
          mint,
          balance,
          tokenAccount: tokenAccount.pubkey.toString(),
          symbol: undefined, // To be resolved by token metadata
          name: undefined
        });
      }
    }
    
    return Result.success(tokenBalances);
  }

  /**
   * Get comprehensive account information (SOL + tokens)
   */
  public async getAccountInfo(publicKeyString: string): Promise<Result<SolanaAccountInfo, ExternalServiceError | NetworkError | ValidationError | TimeoutError>> {
    // Get SOL balance
    const solBalanceResult = await this.getSolBalance(publicKeyString);
    if (solBalanceResult.isFailure) {
      return Result.failure(solBalanceResult.error);
    }
    
    // Get token balances
    const tokenBalancesResult = await this.getTokenBalances(publicKeyString);
    if (tokenBalancesResult.isFailure) {
      return Result.failure(tokenBalancesResult.error);
    }
    
    const accountInfo: SolanaAccountInfo = {
      publicKey: publicKeyString,
      solBalance: solBalanceResult.value.balance,
      tokenBalances: tokenBalancesResult.value,
      totalAccounts: 1 + tokenBalancesResult.value.length
    };
    
    return Result.success(accountInfo);
  }

  /**
   * Get account info for multiple public keys
   */
  public async getMultipleAccountsInfo(publicKeys: string[]): Promise<Result<SolanaAccountInfo[], ExternalServiceError | NetworkError | ValidationError | TimeoutError>> {
    const results: SolanaAccountInfo[] = [];
    
    // Process accounts in parallel with controlled concurrency
    const batchSize = 5;
    for (let i = 0; i < publicKeys.length; i += batchSize) {
      const batch = publicKeys.slice(i, i + batchSize);
      const batchPromises = batch.map(publicKey => this.getAccountInfo(publicKey));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.isSuccess) {
            results.push(result.value.value);
          }
          // Note: Individual failures are ignored in batch processing
          // This allows partial success when some accounts are invalid
        }
      } catch (error) {
        return Result.failure(new ExternalServiceError(
          'Solana RPC',
          'getMultipleAccountsInfo',
          `Batch processing failed: ${error}`,
          error as Error
        ));
      }
    }
    
    return Result.success(results);
  }

  /**
   * Check RPC endpoint health
   */
  public async checkHealth(): Promise<Result<boolean, ExternalServiceError | NetworkError | TimeoutError>> {
    const healthResult = await this.executeWithRetry(
      async () => {
        // Use getVersion as a health check since getHealth() doesn't exist in all RPC implementations
        await this.connection.getVersion();
        return true;
      },
      'checkHealth'
    );

    return healthResult;
  }

  /**
   * Get current slot (block number equivalent)
   */
  public async getCurrentSlot(): Promise<Result<number, ExternalServiceError | NetworkError | TimeoutError>> {
    const slotResult = await this.executeWithRetry(
      async () => {
        const slot = await this.connection.getSlot();
        return slot;
      },
      'getCurrentSlot'
    );
    
    return slotResult;
  }

  /**
   * Get RPC version info
   */
  public async getVersion(): Promise<Result<unknown, ExternalServiceError | NetworkError | TimeoutError>> {
    const versionResult = await this.executeWithRetry(
      async () => {
        const version = await this.connection.getVersion();
        return version;
      },
      'getVersion'
    );
    
    return versionResult;
  }

  /**
   * Get the current RPC endpoint being used
   */
  public getCurrentRpcUrl(): string {
    return rpcConfigService.getActiveEndpoint('solana');
  }

  /**
   * Switch to a different RPC endpoint
   */
  public async switchRpcEndpoint(url: string): Promise<Result<void, ValidationError>> {
    try {
      rpcConfigService.setActiveEndpoint('solana', url);
      this.connection = this.createConnection();
      return Result.success(undefined);
    } catch {
      return Result.failure(new ValidationError(
        `Failed to switch to RPC endpoint: ${url}`,
        'rpcEndpoint',
        url
      ));
    }
  }

  /**
   * Get chain ID
   */
  public getChainId(): ChainId {
    return this.chainId;
  }

  /**
   * Check if the service is ready
   */
  public async isReady(): Promise<boolean> {
    const healthResult = await this.checkHealth();
    return healthResult.isSuccess && healthResult.value;
  }
}