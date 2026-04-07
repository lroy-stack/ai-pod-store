/**
 * EscalationManager — Multi-tier alerting and escalation
 *
 * Implements L1/L2/L3 escalation tiers for production issues:
 * - L1: Informational (logs only)
 * - L2: Warning (Slack notification)
 * - L3: Critical (Slack + PagerDuty + admin email)
 *
 * @module reliability/escalation
 */

export type EscalationLevel = 'L1' | 'L2' | 'L3'

export interface EscalationContext {
  service?: string
  endpoint?: string
  userId?: string
  orderId?: string
  errorCode?: string
  timestamp?: string
  metadata?: Record<string, any>
}

export interface EscalationResult {
  success: boolean
  level: EscalationLevel
  notified: string[] // Channels that were notified (e.g., ['console', 'slack'])
  error?: string
}

/**
 * Escalation tier definitions
 */
const ESCALATION_TIERS = {
  L1: {
    name: 'Informational',
    description: 'Low-priority issue, logs only',
    actions: ['console'],
  },
  L2: {
    name: 'Warning',
    description: 'Medium-priority issue, notify team',
    actions: ['console', 'slack'],
  },
  L3: {
    name: 'Critical',
    description: 'High-priority issue, urgent response required',
    actions: ['console', 'slack', 'pagerduty', 'email'],
  },
}

/**
 * Escalate an issue to the appropriate tier
 *
 * @param level - Escalation level (L1, L2, L3)
 * @param message - Human-readable error message
 * @param context - Additional context about the issue
 * @returns Promise<EscalationResult>
 *
 * @example
 * ```typescript
 * // L1: Informational
 * await escalate('L1', 'User viewed product page', {
 *   service: 'frontend',
 *   endpoint: '/products/123',
 *   userId: 'user-456'
 * })
 *
 * // L2: Warning
 * await escalate('L2', 'Stripe webhook retry exhausted', {
 *   service: 'webhook-processor',
 *   endpoint: '/api/webhooks/stripe',
 *   errorCode: 'WEBHOOK_RETRY_EXHAUSTED'
 * })
 *
 * // L3: Critical
 * await escalate('L3', 'Database connection pool exhausted', {
 *   service: 'api',
 *   endpoint: '/api/orders',
 *   errorCode: 'DB_POOL_EXHAUSTED',
 *   metadata: { activeConnections: 100, maxConnections: 100 }
 * })
 * ```
 */
export async function escalate(
  level: EscalationLevel,
  message: string,
  context: EscalationContext = {}
): Promise<EscalationResult> {
  const tier = ESCALATION_TIERS[level]
  const notified: string[] = []

  try {
    const timestamp = context.timestamp || new Date().toISOString()
    const fullContext = {
      ...context,
      timestamp,
      level,
      tier: tier.name,
    }

    console.log(`[Escalation] ${level} (${tier.name}): ${message}`, fullContext)

    // Action 1: Console (always)
    notified.push('console')

    // Action 2: Slack (L2+)
    if (tier.actions.includes('slack')) {
      const slackResult = await notifySlack(level, message, fullContext)
      if (slackResult) {
        notified.push('slack')
      }
    }

    // Action 3: PagerDuty (L3 only)
    if (tier.actions.includes('pagerduty')) {
      const pagerdutyResult = await notifyPagerDuty(level, message, fullContext)
      if (pagerdutyResult) {
        notified.push('pagerduty')
      }
    }

    // Action 4: Email (L3 only)
    if (tier.actions.includes('email')) {
      const emailResult = await notifyEmail(level, message, fullContext)
      if (emailResult) {
        notified.push('email')
      }
    }

    // Record escalation in database for audit trail
    try {
      await recordEscalation(level, message, fullContext)
    } catch (recordError) {
      console.error('[Escalation] Failed to record in database:', recordError)
    }

    return {
      success: true,
      level,
      notified,
    }
  } catch (error: any) {
    console.error('[Escalation] Failed to escalate:', error)
    return {
      success: false,
      level,
      notified,
      error: error?.message || 'Unknown escalation error',
    }
  }
}

/**
 * Send Slack notification
 */
async function notifySlack(
  level: EscalationLevel,
  message: string,
  context: EscalationContext
): Promise<boolean> {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL
    if (!webhookUrl) {
      console.warn('[Escalation] SLACK_WEBHOOK_URL not configured')
      return false
    }

    const color = level === 'L3' ? 'danger' : 'warning'
    const emoji = level === 'L3' ? '🚨' : '⚠️'

    const payload = {
      text: `${emoji} ${level} Escalation`,
      attachments: [
        {
          color,
          title: message,
          fields: [
            {
              title: 'Service',
              value: context.service || 'Unknown',
              short: true,
            },
            {
              title: 'Endpoint',
              value: context.endpoint || 'N/A',
              short: true,
            },
            {
              title: 'Error Code',
              value: context.errorCode || 'N/A',
              short: true,
            },
            {
              title: 'Timestamp',
              value: context.timestamp || new Date().toISOString(),
              short: true,
            },
          ],
          footer: 'Store Escalation',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('[Escalation] Slack notification failed:', response.statusText)
      return false
    }

    console.log('[Escalation] Slack notification sent')
    return true
  } catch (error) {
    console.error('[Escalation] Slack notification error:', error)
    return false
  }
}

/**
 * Send PagerDuty alert
 */
async function notifyPagerDuty(
  level: EscalationLevel,
  message: string,
  context: EscalationContext
): Promise<boolean> {
  try {
    const integrationKey = process.env.PAGERDUTY_INTEGRATION_KEY
    if (!integrationKey) {
      console.warn('[Escalation] PAGERDUTY_INTEGRATION_KEY not configured')
      return false
    }

    const payload = {
      routing_key: integrationKey,
      event_action: 'trigger',
      payload: {
        summary: message,
        severity: 'critical',
        source: context.service || 'pod-ai-store',
        component: context.endpoint || 'unknown',
        custom_details: context,
      },
    }

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('[Escalation] PagerDuty alert failed:', response.statusText)
      return false
    }

    console.log('[Escalation] PagerDuty alert sent')
    return true
  } catch (error) {
    console.error('[Escalation] PagerDuty alert error:', error)
    return false
  }
}

/**
 * Send email notification to admins
 */
async function notifyEmail(
  level: EscalationLevel,
  message: string,
  context: EscalationContext
): Promise<boolean> {
  try {
    // Call internal API to send email
    const response = await fetch('/api/internal/send-escalation-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        message,
        context,
      }),
    })

    if (!response.ok) {
      console.error('[Escalation] Email notification failed:', response.statusText)
      return false
    }

    console.log('[Escalation] Email notification sent')
    return true
  } catch (error) {
    console.error('[Escalation] Email notification error:', error)
    return false
  }
}

/**
 * Record escalation in database for audit trail
 */
async function recordEscalation(
  level: EscalationLevel,
  message: string,
  context: EscalationContext
): Promise<void> {
  try {
    // Call internal API to record escalation
    await fetch('/api/internal/record-escalation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        message,
        context,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    console.error('[Escalation] Failed to record escalation:', error)
    // Don't throw - recording is non-critical
  }
}

/**
 * Helper function for common escalation scenarios
 */
export const Escalate = {
  /**
   * Database connection issue
   */
  databaseError: (message: string, metadata?: Record<string, any>) =>
    escalate('L3', `Database Error: ${message}`, {
      service: 'database',
      errorCode: 'DB_ERROR',
      metadata,
    }),

  /**
   * Payment processing failure
   */
  paymentError: (orderId: string, message: string) =>
    escalate('L3', `Payment Error: ${message}`, {
      service: 'payment',
      orderId,
      errorCode: 'PAYMENT_ERROR',
    }),

  /**
   * Webhook processing failure (after retries exhausted)
   */
  webhookFailure: (provider: string, eventId: string, message: string) =>
    escalate('L2', `Webhook Failure: ${provider} - ${message}`, {
      service: 'webhooks',
      errorCode: 'WEBHOOK_FAILURE',
      metadata: { provider, eventId },
    }),

  /**
   * API rate limit exceeded
   */
  rateLimitExceeded: (service: string, endpoint: string) =>
    escalate('L2', `Rate Limit Exceeded: ${service}`, {
      service,
      endpoint,
      errorCode: 'RATE_LIMIT_EXCEEDED',
    }),

  /**
   * Zombie state detected (ZombieReaper)
   */
  zombieDetected: (table: string, id: string, status: string, age: number) =>
    escalate('L2', `Zombie State Detected: ${table}/${id} stuck in ${status}`, {
      service: 'zombie-reaper',
      errorCode: 'ZOMBIE_STATE',
      metadata: { table, id, status, ageMs: age },
    }),
}
