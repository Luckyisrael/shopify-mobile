/**
 * Base SDK error class
 * All SDK errors extend from this class
 */
export class SDKError extends Error {
  public readonly statusCode?: number;
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'SDKError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SDKError);
    }
  }

  /**
   * Serialize error to JSON
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      retryable: this.retryable,
    };
  }
}

/**
 * Network error - typically retryable
 */
export class NetworkError extends SDKError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', undefined, true);
    this.name = 'NetworkError';
  }
}

/**
 * Authentication error - not retryable
 */
export class AuthenticationError extends SDKError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401, false);
    this.name = 'AuthenticationError';
  }
}

/**
 * Validation error - not retryable
 */
export class ValidationError extends SDKError {
  public readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400, false);
    this.name = 'ValidationError';
    this.fields = fields;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fields: this.fields,
    };
  }
}

/**
 * Offline error - retryable
 */
export class OfflineError extends SDKError {
  constructor(message: string) {
    super(message, 'OFFLINE_ERROR', undefined, true);
    this.name = 'OfflineError';
  }
}

/**
 * Legacy error class for backward compatibility
 * @deprecated Use SDKError or specific error classes instead
 */
export class ShopifyMobileError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'UNKNOWN_ERROR',
    details?: unknown
  ) {
    super(message);
    this.name = 'ShopifyMobileError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ShopifyMobileError);
    }
  }

  static fromResponse(response: unknown): ShopifyMobileError {
    const res = response as {
      data?: { error?: string; code?: string; details?: unknown };
      statusText?: string;
      status?: number;
    };
    const message = res.data?.error || res.statusText || 'Unknown error';
    const statusCode = res.status || 500;
    const code = res.data?.code || 'API_ERROR';
    const details = res.data?.details;

    return new ShopifyMobileError(message, statusCode, code, details);
  }
}