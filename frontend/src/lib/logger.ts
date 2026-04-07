/**
 * Structured JSON Logger (Pino)
 *
 * Provides consistent logging format across the application with:
 * - Timestamp (ISO 8601)
 * - Level (trace, debug, info, warn, error, fatal)
 * - Message
 * - Additional context fields
 *
 * In development, logs are formatted with pino-pretty for readability.
 * In production, logs are JSON for ingestion by log aggregators.
 */

import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'

// Configure Pino logger
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Base configuration
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },

  // Development: use pino-pretty for human-readable output
  // Production: JSON output
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),

  // Add timestamp to all logs
  timestamp: pino.stdTimeFunctions.isoTime,
})

/**
 * Log an info message
 */
export function logInfo(message: string, context?: Record<string, unknown>) {
  if (context) {
    logger.info(context, message)
  } else {
    logger.info(message)
  }
}

/**
 * Log a warning message
 */
export function logWarn(message: string, context?: Record<string, unknown>) {
  if (context) {
    logger.warn(context, message)
  } else {
    logger.warn(message)
  }
}

/**
 * Log an error message
 */
export function logError(message: string, error?: Error | unknown, context?: Record<string, unknown>) {
  const errorContext = {
    ...context,
    ...(error instanceof Error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : { error }),
  }

  logger.error(errorContext, message)
}

/**
 * Log a debug message (development only)
 */
export function logDebug(message: string, context?: Record<string, unknown>) {
  if (context) {
    logger.debug(context, message)
  } else {
    logger.debug(message)
  }
}

/**
 * Log an HTTP request
 */
export function logRequest(req: {
  method: string
  url: string
  headers?: Record<string, string | string[] | undefined>
  ip?: string
}) {
  logger.info(
    {
      type: 'http_request',
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    },
    `${req.method} ${req.url}`
  )
}

/**
 * Log an HTTP response
 */
export function logResponse(
  req: { method: string; url: string },
  statusCode: number,
  durationMs: number
) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'

  logger[level](
    {
      type: 'http_response',
      method: req.method,
      url: req.url,
      statusCode,
      durationMs,
    },
    `${req.method} ${req.url} ${statusCode} ${durationMs}ms`
  )
}
