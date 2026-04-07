/**
 * POD Provider error hierarchy.
 * All provider-specific errors extend PODError for consistent handling.
 */

export class PODError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly rawResponse?: unknown,
  ) {
    super(message)
    this.name = 'PODError'
  }
}

export class PODProviderError extends PODError {
  constructor(provider: string, message: string, statusCode?: number, rawResponse?: unknown) {
    super(message, provider, statusCode, rawResponse)
    this.name = 'PODProviderError'
  }
}

export class PODNotFoundError extends PODError {
  constructor(
    provider: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
  ) {
    super(`${resourceType} '${resourceId}' not found`, provider, 404)
    this.name = 'PODNotFoundError'
  }
}

export class PODRateLimitError extends PODError {
  constructor(
    provider: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(
      `Rate limited${retryAfterSeconds ? ` — retry after ${retryAfterSeconds}s` : ''}`,
      provider,
      429,
    )
    this.name = 'PODRateLimitError'
  }
}

export class PODValidationError extends PODError {
  constructor(
    provider: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message, provider, 400)
    this.name = 'PODValidationError'
  }
}

export class PODAuthError extends PODError {
  constructor(provider: string, message = 'Authentication failed') {
    super(message, provider, 401)
    this.name = 'PODAuthError'
  }
}

export class PODUnsupportedOperationError extends PODError {
  constructor(
    public readonly operation: string,
    provider: string,
  ) {
    super(`Operation '${operation}' is not supported by ${provider}`, provider)
    this.name = 'PODUnsupportedOperationError'
  }
}

export class PODWebhookVerificationError extends PODError {
  constructor(provider: string, message = 'Webhook signature verification failed') {
    super(message, provider, 401)
    this.name = 'PODWebhookVerificationError'
  }
}
