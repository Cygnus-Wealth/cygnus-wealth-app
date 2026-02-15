/**
 * ChainId Value Object
 * 
 * Represents a blockchain network identifier in a type-safe way.
 * Provides validation and normalization for different chain formats.
 */

import { ValueObject } from '../shared/ValueObject';
import { ValidationError } from '../shared/DomainError';

export type SupportedChainType = 
  | 'ethereum' 
  | 'polygon' 
  | 'arbitrum' 
  | 'optimism' 
  | 'bsc' 
  | 'avalanche' 
  | 'base' 
  | 'solana' 
  | 'sui';

export interface ChainInfo {
  name: string;
  symbol: string;
  numericId?: number;
  isEvm: boolean;
  category: 'evm' | 'solana' | 'sui';
}

export class ChainId extends ValueObject<SupportedChainType> {
  private static readonly CHAIN_INFO_MAP: Record<SupportedChainType, ChainInfo> = {
    ethereum: { 
      name: 'Ethereum', 
      symbol: 'ETH', 
      numericId: 1, 
      isEvm: true, 
      category: 'evm' 
    },
    polygon: { 
      name: 'Polygon', 
      symbol: 'MATIC', 
      numericId: 137, 
      isEvm: true, 
      category: 'evm' 
    },
    arbitrum: { 
      name: 'Arbitrum', 
      symbol: 'ETH', 
      numericId: 42161, 
      isEvm: true, 
      category: 'evm' 
    },
    optimism: { 
      name: 'Optimism', 
      symbol: 'ETH', 
      numericId: 10, 
      isEvm: true, 
      category: 'evm' 
    },
    bsc: { 
      name: 'BNB Smart Chain', 
      symbol: 'BNB', 
      numericId: 56, 
      isEvm: true, 
      category: 'evm' 
    },
    avalanche: { 
      name: 'Avalanche', 
      symbol: 'AVAX', 
      numericId: 43114, 
      isEvm: true, 
      category: 'evm' 
    },
    base: { 
      name: 'Base', 
      symbol: 'ETH', 
      numericId: 8453, 
      isEvm: true, 
      category: 'evm' 
    },
    solana: { 
      name: 'Solana', 
      symbol: 'SOL', 
      isEvm: false, 
      category: 'solana' 
    },
    sui: { 
      name: 'SUI', 
      symbol: 'SUI', 
      isEvm: false, 
      category: 'sui' 
    }
  };

  // Mapping from numeric chain IDs to chain types (for EVM chains)
  private static readonly NUMERIC_ID_MAP: Record<number, SupportedChainType> = {
    1: 'ethereum',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    56: 'bsc',
    43114: 'avalanche',
    8453: 'base'
  };

  private constructor(chainType: SupportedChainType) {
    super(chainType);
    this.validate();
  }

  protected validate(): void {
    if (!ChainId.CHAIN_INFO_MAP[this._value]) {
      throw new ValidationError(
        `Unsupported chain type: ${this._value}`,
        'chainId',
        this._value
      );
    }
  }

  /**
   * Create ChainId from chain type string
   */
  public static fromChainType(chainType: string): ChainId {
    const normalizedType = chainType.toLowerCase() as SupportedChainType;
    
    if (!ChainId.CHAIN_INFO_MAP[normalizedType]) {
      throw new ValidationError(
        `Invalid chain type: ${chainType}. Supported chains: ${ChainId.getSupportedChainTypes().join(', ')}`,
        'chainId',
        chainType
      );
    }
    
    return new ChainId(normalizedType);
  }

  /**
   * Create ChainId from numeric chain ID (EVM chains only)
   */
  public static fromNumericId(numericId: number): ChainId {
    const chainType = ChainId.NUMERIC_ID_MAP[numericId];
    
    if (!chainType) {
      throw new ValidationError(
        `Unsupported numeric chain ID: ${numericId}`,
        'numericChainId',
        numericId
      );
    }
    
    return new ChainId(chainType);
  }

  /**
   * Create ChainId from chain name (case-insensitive)
   */
  public static fromChainName(name: string): ChainId {
    const normalizedName = name.toLowerCase();
    
    for (const [chainType, info] of Object.entries(ChainId.CHAIN_INFO_MAP)) {
      if (info.name.toLowerCase() === normalizedName) {
        return new ChainId(chainType as SupportedChainType);
      }
    }
    
    throw new ValidationError(
      `Chain name not found: ${name}. Supported chains: ${ChainId.getSupportedChainNames().join(', ')}`,
      'chainName',
      name
    );
  }

  /**
   * Get chain information
   */
  public getInfo(): ChainInfo {
    return ChainId.CHAIN_INFO_MAP[this._value];
  }

  /**
   * Get chain name (human-readable)
   */
  public getName(): string {
    return this.getInfo().name;
  }

  /**
   * Get chain symbol (native token symbol)
   */
  public getSymbol(): string {
    return this.getInfo().symbol;
  }

  /**
   * Get numeric chain ID (EVM chains only)
   */
  public getNumericId(): number | undefined {
    return this.getInfo().numericId;
  }

  /**
   * Check if this is an EVM-compatible chain
   */
  public isEvmChain(): boolean {
    return this.getInfo().isEvm;
  }

  /**
   * Check if this is a Solana chain
   */
  public isSolanaChain(): boolean {
    return this.getInfo().category === 'solana';
  }

  /**
   * Check if this is a SUI chain
   */
  public isSuiChain(): boolean {
    return this.getInfo().category === 'sui';
  }

  /**
   * Get chain category
   */
  public getCategory(): 'evm' | 'solana' | 'sui' {
    return this.getInfo().category;
  }

  /**
   * Check if two chains are compatible (same category)
   */
  public isCompatibleWith(other: ChainId): boolean {
    return this.getCategory() === other.getCategory();
  }

  /**
   * Get the chain type value
   */
  public getChainType(): SupportedChainType {
    return this._value;
  }

  /**
   * Static method to get all supported chain types
   */
  public static getSupportedChainTypes(): SupportedChainType[] {
    return Object.keys(ChainId.CHAIN_INFO_MAP) as SupportedChainType[];
  }

  /**
   * Static method to get all supported chain names
   */
  public static getSupportedChainNames(): string[] {
    return Object.values(ChainId.CHAIN_INFO_MAP).map(info => info.name);
  }

  /**
   * Static method to get EVM chain types only
   */
  public static getEvmChainTypes(): SupportedChainType[] {
    return Object.entries(ChainId.CHAIN_INFO_MAP)
      .filter(([, info]) => info.isEvm)
      .map(([chainType]) => chainType as SupportedChainType);
  }

  /**
   * Static method to get non-EVM chain types
   */
  public static getNonEvmChainTypes(): SupportedChainType[] {
    return Object.entries(ChainId.CHAIN_INFO_MAP)
      .filter(([, info]) => !info.isEvm)
      .map(([chainType]) => chainType as SupportedChainType);
  }

  /**
   * Check if a string is a valid chain type
   */
  public static isValidChainType(chainType: string): chainType is SupportedChainType {
    return chainType.toLowerCase() in ChainId.CHAIN_INFO_MAP;
  }

  /**
   * Check if a numeric ID is a valid EVM chain ID
   */
  public static isValidNumericChainId(numericId: number): boolean {
    return numericId in ChainId.NUMERIC_ID_MAP;
  }

  /**
   * Get display string for UI
   */
  public getDisplayName(): string {
    const info = this.getInfo();
    return `${info.name} (${info.symbol})`;
  }

  /**
   * Convert to string representation
   */
  public toString(): string {
    return this._value;
  }

  /**
   * Create a detailed JSON representation with chain info
   */
  public toDetailedJSON(): {
    chainType: SupportedChainType;
    name: string;
    symbol: string;
    numericId?: number;
    isEvm: boolean;
    category: 'evm' | 'solana' | 'sui';
  } {
    const info = this.getInfo();
    return {
      chainType: this._value,
      name: info.name,
      symbol: info.symbol,
      numericId: info.numericId,
      isEvm: info.isEvm,
      category: info.category
    };
  }
}