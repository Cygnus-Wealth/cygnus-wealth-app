/**
 * Base Value Object class
 * 
 * Value objects are immutable objects that are defined by their attributes rather than identity.
 * Two value objects are equal if all their attributes are equal.
 * 
 * This is a foundational DDD pattern for representing concepts that don't have identity
 * but are important to the domain (e.g., Money, Address, AssetAmount).
 */

export abstract class ValueObject<T> {
  protected readonly _value: T;

  protected constructor(value: T) {
    this._value = value;
  }

  /**
   * Get the underlying value
   */
  public get value(): T {
    return this._value;
  }

  /**
   * Compare two value objects for equality
   * Two value objects are equal if their values are deeply equal
   */
  public equals(other: ValueObject<T>): boolean {
    if (this === other) return true;
    if (!other) return false;
    if (this.constructor !== other.constructor) return false;

    return this.deepEquals(this._value, other._value);
  }

  /**
   * Deep equality check for complex values
   */
  private deepEquals(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    
    if (a === null || b === null || a === undefined || b === undefined) {
      return a === b;
    }
    
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const objA = a as Record<string, unknown>;
      const objB = b as Record<string, unknown>;
      const keysA = Object.keys(objA);
      const keysB = Object.keys(objB);

      if (keysA.length !== keysB.length) return false;

      return keysA.every(key =>
        keysB.includes(key) && this.deepEquals(objA[key], objB[key])
      );
    }
    
    return false;
  }

  /**
   * Get string representation of the value object
   */
  public toString(): string {
    if (typeof this._value === 'string') {
      return this._value;
    }
    
    if (typeof this._value === 'object' && this._value !== null) {
      return JSON.stringify(this._value);
    }
    
    return String(this._value);
  }

  /**
   * Get JSON representation of the value object
   */
  public toJSON(): T {
    return this._value;
  }

  /**
   * Create a copy of this value object
   * Since value objects are immutable, this returns the same instance
   */
  public copy(): this {
    return this;
  }

  /**
   * Validate the value object's invariants
   * Override in subclasses to implement domain-specific validation
   */
  protected validate(): void {
    // Default implementation does nothing
    // Subclasses should override to implement validation rules
  }

  /**
   * Get hash code for this value object
   * Useful for use in Sets and as Map keys
   */
  public hashCode(): string {
    return this.generateHashCode(this._value);
  }

  /**
   * Generate hash code for any value
   */
  private generateHashCode(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'string') {
      return this.stringHash(value);
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (value instanceof Date) {
      return value.getTime().toString();
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const hashParts = keys.map(key =>
        `${key}:${this.generateHashCode(obj[key])}`
      );
      return this.stringHash(hashParts.join('|'));
    }

    return String(value);
  }

  /**
   * Simple string hash function
   */
  private stringHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }
}

/**
 * Simple value object for primitive values
 * Useful for wrapping strings, numbers, etc. with domain meaning
 */
export class SimpleValueObject<T extends string | number | boolean> extends ValueObject<T> {
  constructor(value: T) {
    super(value);
    this.validate();
  }

  protected validate(): void {
    if (this._value === null || this._value === undefined) {
      throw new Error(`${this.constructor.name} cannot be null or undefined`);
    }
  }

  /**
   * Factory method for creating simple value objects
   */
  public static create<T extends string | number | boolean>(value: T): SimpleValueObject<T> {
    return new SimpleValueObject(value);
  }
}