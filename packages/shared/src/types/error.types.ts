// ============================================================
// Error Types
// Application-level error codes and classes.
// ============================================================

/** Enumeration of all BHUVI error codes */
export enum BhuviErrorCode {
  // General
  UNKNOWN = 'UNKNOWN_ERROR',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL = 'INTERNAL_ERROR',

  // Authentication & Authorization (Module 02)
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_MISSING = 'TOKEN_MISSING',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Configuration
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_CONFIG = 'INVALID_CONFIG',

  // Future modules – reserved
  DATABASE_ERROR = 'DATABASE_ERROR',
  AI_ENGINE_ERROR = 'AI_ENGINE_ERROR',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
}

/** Base application error */
export class BhuviError extends Error {
  public readonly code: BhuviErrorCode;
  public readonly details?: unknown;

  constructor(code: BhuviErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'BhuviError';
    this.code = code;
    this.details = details;
    // Maintains proper stack trace in V8 (available in Node.js but not in TypeScript's Error type)
    const errorCtor = Error as unknown as {
      captureStackTrace?: (target: object, ctor: unknown) => void;
    };
    if (errorCtor.captureStackTrace) {
      errorCtor.captureStackTrace(this, BhuviError);
    }
  }
}

/** Configuration error */
export class ConfigurationError extends BhuviError {
  constructor(message: string, details?: unknown) {
    super(BhuviErrorCode.MISSING_CONFIG, message, details);
    this.name = 'ConfigurationError';
  }
}

/** Validation error */
export class ValidationError extends BhuviError {
  constructor(message: string, details?: unknown) {
    super(BhuviErrorCode.VALIDATION_FAILED, message, details);
    this.name = 'ValidationError';
  }
}

/** Authentication error */
export class AuthenticationError extends BhuviError {
  constructor(
    message: string,
    code: BhuviErrorCode = BhuviErrorCode.UNAUTHORIZED,
    details?: unknown,
  ) {
    super(code, message, details);
    this.name = 'AuthenticationError';
  }
}

/** Not found error */
export class NotFoundError extends BhuviError {
  constructor(resource: string, id?: string) {
    super(
      BhuviErrorCode.NOT_FOUND,
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
    );
    this.name = 'NotFoundError';
  }
}
