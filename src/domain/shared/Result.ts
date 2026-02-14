/**
 * Result Type for Error Handling
 * 
 * Provides a functional approach to error handling without exceptions.
 * Either contains a success value or an error, but never both.
 * Inspired by Rust's Result type and functional programming patterns.
 */

import { DomainError } from './DomainError';

export type Result<T, E = DomainError> = Success<T, E> | Failure<T, E>;

export class Success<T, E = DomainError> {
  public readonly isSuccess = true;
  public readonly isFailure = false;
  private readonly _value: T;

  constructor(value: T) {
    this._value = value;
  }

  public get value(): T {
    return this._value;
  }

  public get error(): E {
    throw new Error('Cannot get error from Success result');
  }

  /**
   * Map the success value to a new type
   */
  public map<U>(fn: (value: T) => U): Result<U, E> {
    try {
      return Result.success(fn(this._value));
    } catch (error) {
      return Result.failure(error as E);
    }
  }

  /**
   * Flat map - chain operations that return Results
   */
  public flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    try {
      return fn(this._value);
    } catch (error) {
      return Result.failure(error as E);
    }
  }

  /**
   * Map the error (no-op for Success)
   */
  public mapError<F>(_fn: (error: E) => F): Result<T, F> {
    return this as any;
  }

  /**
   * Get the value or throw an error
   */
  public unwrap(): T {
    return this._value;
  }

  /**
   * Get the value or return the default
   */
  public unwrapOr(_defaultValue: T): T {
    return this._value;
  }

  /**
   * Get the value or compute it from the error
   */
  public unwrapOrElse(_fn: (error: E) => T): T {
    return this._value;
  }

  /**
   * Match pattern for handling both success and failure cases
   */
  public match<U>(cases: { success: (value: T) => U; failure: (error: E) => U }): U {
    return cases.success(this._value);
  }

  /**
   * Execute a function if this is a success (side effect)
   */
  public ifSuccess(fn: (value: T) => void): Result<T, E> {
    fn(this._value);
    return this;
  }

  /**
   * Execute a function if this is a failure (no-op for Success)
   */
  public ifFailure(_fn: (error: E) => void): Result<T, E> {
    return this;
  }

  public toString(): string {
    return `Success(${this._value})`;
  }
}

export class Failure<T, E = DomainError> {
  public readonly isSuccess = false;
  public readonly isFailure = true;
  private readonly _error: E;

  constructor(error: E) {
    this._error = error;
  }

  public get value(): T {
    throw new Error('Cannot get value from Failure result');
  }

  public get error(): E {
    return this._error;
  }

  /**
   * Map the success value (no-op for Failure)
   */
  public map<U>(_fn: (value: T) => U): Result<U, E> {
    return this as any;
  }

  /**
   * Flat map (no-op for Failure)
   */
  public flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return this as any;
  }

  /**
   * Map the error to a new type
   */
  public mapError<F>(fn: (error: E) => F): Result<T, F> {
    try {
      return Result.failure(fn(this._error));
    } catch (error) {
      return Result.failure(error as F);
    }
  }

  /**
   * Get the value or throw the error
   */
  public unwrap(): T {
    if (this._error instanceof Error) {
      throw this._error;
    }
    throw new Error(`Result failed: ${this._error}`);
  }

  /**
   * Get the value or return the default
   */
  public unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Get the value or compute it from the error
   */
  public unwrapOrElse(fn: (error: E) => T): T {
    return fn(this._error);
  }

  /**
   * Match pattern for handling both success and failure cases
   */
  public match<U>(cases: { success: (value: T) => U; failure: (error: E) => U }): U {
    return cases.failure(this._error);
  }

  /**
   * Execute a function if this is a success (no-op for Failure)
   */
  public ifSuccess(_fn: (value: T) => void): Result<T, E> {
    return this;
  }

  /**
   * Execute a function if this is a failure (side effect)
   */
  public ifFailure(fn: (error: E) => void): Result<T, E> {
    fn(this._error);
    return this;
  }

  public toString(): string {
    return `Failure(${this._error})`;
  }
}

/**
 * Result factory functions (namespace-free for erasableSyntaxOnly compatibility)
 */

function success<T, E = DomainError>(value: T): Result<T, E> {
  return new Success<T, E>(value);
}

function failure<T, E = DomainError>(error: E): Result<T, E> {
  return new Failure<T, E>(error);
}

function from<T, E = DomainError>(fn: () => T, errorMapper?: (error: unknown) => E): Result<T, E> {
  try {
    return success(fn());
  } catch (error) {
    const mappedError = errorMapper ? errorMapper(error) : error as E;
    return failure(mappedError);
  }
}

async function fromAsync<T, E = DomainError>(
  fn: () => Promise<T>,
  errorMapper?: (error: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return success(value);
  } catch (error) {
    const mappedError = errorMapper ? errorMapper(error) : error as E;
    return failure(mappedError);
  }
}

function all<T extends readonly unknown[], E = DomainError>(
  results: { [K in keyof T]: Result<T[K], E> },
): Result<T, E> {
  const values: unknown[] = [];
  for (const result of results) {
    if (result.isFailure) {
      return result as any;
    }
    values.push(result.value);
  }
  return success(values as unknown as T);
}

function any<T, E = DomainError>(results: Result<T, E>[]): Result<T, E> {
  if (results.length === 0) {
    return failure(new Error('No results provided') as E);
  }
  let lastFailure: Result<T, E> | null = null;
  for (const result of results) {
    if (result.isSuccess) return result;
    lastFailure = result;
  }
  return lastFailure!;
}

function partition<T, E = DomainError>(
  results: Result<T, E>[],
): { successes: T[]; failures: E[] } {
  const successes: T[] = [];
  const failures: E[] = [];
  for (const result of results) {
    if (result.isSuccess) successes.push(result.value);
    else failures.push(result.error);
  }
  return { successes, failures };
}

function traverse<T, U, E = DomainError>(
  values: T[],
  fn: (value: T) => Result<U, E>,
): Result<U[], E> {
  const results: U[] = [];
  for (const value of values) {
    const result = fn(value);
    if (result.isFailure) return result as any;
    results.push(result.value);
  }
  return success(results);
}

function isResult<T, E>(value: any): value is Result<T, E> {
  return value instanceof Success || value instanceof Failure;
}

/** Drop-in replacement for `Result.success()`, `Result.failure()`, etc. */
export const Result = {
  success,
  failure,
  from,
  fromAsync,
  all,
  any,
  partition,
  traverse,
  isResult,
};