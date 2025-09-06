/**
 * Base error class for all library-specific errors
 */
export abstract class BalancedKGroupsError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends BalancedKGroupsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

/**
 * Error thrown when an algorithm fails to execute properly
 */
export class AlgorithmError extends BalancedKGroupsError {
  public readonly algorithm: string;

  constructor(
    message: string,
    algorithm: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'ALGORITHM_ERROR', { ...context, algorithm });
    this.algorithm = algorithm;
  }
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends BalancedKGroupsError {
  public readonly timeoutMs: number;

  constructor(
    message: string,
    timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'TIMEOUT_ERROR', { ...context, timeoutMs });
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when the problem is infeasible
 */
export class InfeasibleError extends BalancedKGroupsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INFEASIBLE_ERROR', context);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends BalancedKGroupsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', context);
  }
}

/**
 * Error thrown when numerical precision issues occur
 */
export class NumericalError extends BalancedKGroupsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NUMERICAL_ERROR', context);
  }
}

/**
 * Error thrown when memory limits are exceeded
 */
export class MemoryError extends BalancedKGroupsError {
  public readonly memoryUsageBytes: number;

  constructor(
    message: string,
    memoryUsageBytes: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'MEMORY_ERROR', { ...context, memoryUsageBytes });
    this.memoryUsageBytes = memoryUsageBytes;
  }
}

/**
 * Error thrown when an unsupported operation is attempted
 */
export class UnsupportedError extends BalancedKGroupsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'UNSUPPORTED_ERROR', context);
  }
}

/**
 * Type guard to check if an error is a library-specific error
 */
export function isBalancedKGroupsError(
  error: unknown
): error is BalancedKGroupsError {
  return error instanceof BalancedKGroupsError;
}

/**
 * Type guard to check if an error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is an algorithm error
 */
export function isAlgorithmError(error: unknown): error is AlgorithmError {
  return error instanceof AlgorithmError;
}

/**
 * Type guard to check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Type guard to check if an error is an infeasible error
 */
export function isInfeasibleError(error: unknown): error is InfeasibleError {
  return error instanceof InfeasibleError;
}

/**
 * Utility function to create a validation error with context
 */
export function createValidationError(
  field: string,
  value: unknown,
  expected: string,
  additional?: string
): ValidationError {
  const message = `Invalid ${field}: expected ${expected}${additional ? `, ${additional}` : ''}`;
  return new ValidationError(message, { field, value, expected });
}

/**
 * Utility function to create an algorithm error with context
 */
export function createAlgorithmError(
  algorithm: string,
  operation: string,
  reason: string,
  context?: Record<string, unknown>
): AlgorithmError {
  const message = `Algorithm '${algorithm}' failed during ${operation}: ${reason}`;
  return new AlgorithmError(message, algorithm, {
    operation,
    reason,
    ...context,
  });
}

/**
 * Utility function to create a timeout error with context
 */
export function createTimeoutError(
  operation: string,
  timeoutMs: number,
  context?: Record<string, unknown>
): TimeoutError {
  const message = `Operation '${operation}' timed out after ${timeoutMs}ms`;
  return new TimeoutError(message, timeoutMs, { operation, ...context });
}
