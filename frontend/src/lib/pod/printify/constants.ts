/**
 * Printify-specific constants.
 */

export const PRINTIFY_BASE_URL = 'https://api.printify.com/v1'

/** Max items per page in Printify API */
export const PRINTIFY_MAX_PAGE_SIZE = 50

/** EU-approved Printify provider IDs */
export const EU_APPROVED_PROVIDER_IDS = new Set([26, 410, 90, 23, 30, 255, 86])

/** Printify webhook event types */
export const PRINTIFY_WEBHOOK_EVENTS = [
  'order:created',
  'order:shipped',
  'order:delivered',
  'order:cancelled',
  'order:failed',
  'product:publish:started',
  'product:publish:succeeded',
  'product:created',
  'product:updated',
  'product:deleted',
] as const
