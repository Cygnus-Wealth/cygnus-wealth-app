/**
 * Base Domain Error class
 * 
 * Provides a base class for all domain-specific errors.
 * Follows DDD principles by expressing business rule violations
 * and domain constraint failures in a structured way.
 */

export abstract class DomainError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  protected constructor(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create a serializable representation of the error
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }

  /**
   * Get a user-friendly error message
   */
  public abstract getUserMessage(): string;

  /**
   * Check if this error should be logged
   */
  public shouldLog(): boolean {
    return true;
  }

  /**
   * Check if this error should be retried
   */
  public isRetryable(): boolean {
    return false;
  }

  /**
   * Get error severity level
   */
  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'medium';
  }
}

/**
 * Validation Error - for business rule violations
 */
export class ValidationError extends DomainError {
  constructor(message: string, field?: string, value?: unknown) {
    super(
      message,
      'VALIDATION_ERROR',
      field ? { field, value } : undefined
    );
  }

  public getUserMessage(): string {
    const field = this.details?.field;
    return field 
      ? `Invalid ${field}: ${this.message}`
      : `Validation error: ${this.message}`;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'low';
  }
}

/**
 * Business Rule Violation Error
 */
export class BusinessRuleViolationError extends DomainError {
  constructor(rule: string, message: string, context?: Record<string, unknown>) {
    super(
      message,
      'BUSINESS_RULE_VIOLATION',
      { rule, ...context }
    );
  }

  public getUserMessage(): string {
    return `Business rule violation: ${this.message}`;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'high';
  }
}

/**
 * Not Found Error - for when requested resources don't exist
 */
export class NotFoundError extends DomainError {
  constructor(resource: string, identifier: string | number) {
    super(
      `${resource} not found`,
      'NOT_FOUND',
      { resource, identifier }
    );
  }

  public getUserMessage(): string {
    const { resource, identifier } = this.details!;
    return `${resource} with identifier "${identifier}" was not found.`;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'low';
  }
}

/**
 * Configuration Error - for system configuration issues
 */
export class ConfigurationError extends DomainError {
  constructor(setting: string, message: string, currentValue?: unknown) {
    super(
      message,
      'CONFIGURATION_ERROR',
      { setting, currentValue }
    );
  }

  public getUserMessage(): string {
    const { setting } = this.details!;
    return `Configuration error with ${setting}: ${this.message}`;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'high';
  }
}

/**
 * External Service Error - for third-party service failures
 */
export class ExternalServiceError extends DomainError {
  constructor(
    service: string, 
    operation: string, 
    message: string, 
    originalError?: Error,
    statusCode?: number
  ) {
    super(
      message,
      'EXTERNAL_SERVICE_ERROR',
      { 
        service, 
        operation, 
        originalError: originalError?.message,
        statusCode 
      }
    );
  }

  public getUserMessage(): string {
    const { service, operation } = this.details!;
    return `Failed to ${operation} with ${service}. Please try again later.`;
  }

  public isRetryable(): boolean {
    const statusCode = this.details?.statusCode as number | undefined;
    // Retry on 5xx errors and timeouts, but not on 4xx client errors
    return !statusCode || statusCode >= 500 || statusCode === 408;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    const statusCode = this.details?.statusCode as number | undefined;
    if (statusCode && statusCode >= 500) return 'high';
    return 'medium';
  }
}

/**
 * Network Error - for network-related failures
 */
export class NetworkError extends DomainError {
  constructor(operation: string, message: string, endpoint?: string) {
    super(
      message,
      'NETWORK_ERROR',
      { operation, endpoint }
    );
  }

  public getUserMessage(): string {
    return 'Network connection failed. Please check your internet connection and try again.';
  }

  public isRetryable(): boolean {
    return true;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'medium';
  }
}

/**
 * Insufficient Permissions Error
 */
export class InsufficientPermissionsError extends DomainError {
  constructor(resource: string, action: string, requiredPermissions?: string[]) {
    super(
      `Insufficient permissions to ${action} ${resource}`,
      'INSUFFICIENT_PERMISSIONS',
      { resource, action, requiredPermissions }
    );
  }

  public getUserMessage(): string {
    const { resource, action } = this.details!;
    return `You don't have permission to ${action} ${resource}.`;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'medium';
  }
}

/**
 * Concurrency Error - for race conditions and conflicts
 */
export class ConcurrencyError extends DomainError {
  constructor(resource: string, message: string) {
    super(
      message,
      'CONCURRENCY_ERROR',
      { resource }
    );
  }

  public getUserMessage(): string {
    return 'The resource was modified by another operation. Please refresh and try again.';
  }

  public isRetryable(): boolean {
    return true;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'medium';
  }
}

/**
 * Timeout Error - for operations that exceed time limits
 */
export class TimeoutError extends DomainError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation "${operation}" timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR',
      { operation, timeoutMs }
    );
  }

  public getUserMessage(): string {
    const { operation } = this.details!;
    return `The ${operation} operation took too long to complete. Please try again.`;
  }

  public isRetryable(): boolean {
    return true;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'medium';
  }
}

/**
 * Generic Service Error - for general service-level errors
 */
export class ServiceError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message, code, details);
  }

  public getUserMessage(): string {
    return this.message;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    return 'medium';
  }
}

/**
 * Aggregate Error - for collecting multiple errors
 */
export class AggregateError extends DomainError {
  public readonly errors: DomainError[];

  constructor(errors: DomainError[], message?: string) {
    const defaultMessage = `${errors.length} error(s) occurred`;
    super(
      message || defaultMessage,
      'AGGREGATE_ERROR',
      { errorCount: errors.length }
    );
    this.errors = errors;
  }

  public getUserMessage(): string {
    const errorCount = this.errors.length;
    if (errorCount === 1) {
      return this.errors[0].getUserMessage();
    }
    return `Multiple errors occurred (${errorCount}). Please review the details.`;
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    // Return the highest severity from all errors
    const severities = this.errors.map(e => e.getSeverity());
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  public isRetryable(): boolean {
    // Retryable only if all errors are retryable
    return this.errors.every(e => e.isRetryable());
  }

  /**
   * Get all errors of a specific type
   */
  public getErrorsOfType<T extends DomainError>(errorClass: new (...args: unknown[]) => T): T[] {
    return this.errors.filter(e => e instanceof errorClass) as T[];
  }

  /**
   * Check if the aggregate contains a specific error type
   */
  public hasErrorType<T extends DomainError>(errorClass: new (...args: unknown[]) => T): boolean {
    return this.errors.some(e => e instanceof errorClass);
  }
}