export class ShopifyMobileError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'UNKNOWN_ERROR',
    details?: any
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

  static fromResponse(response: any): ShopifyMobileError {
    const message = response.data?.error || response.statusText || 'Unknown error';
    const statusCode = response.status || 500;
    const code = response.data?.code || 'API_ERROR';
    const details = response.data?.details;

    return new ShopifyMobileError(message, statusCode, code, details);
  }
}