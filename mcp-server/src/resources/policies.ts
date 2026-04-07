import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { requiredEnv } from '../lib/env.js';

const SUPPORT_EMAIL = requiredEnv('STORE_SUPPORT_EMAIL');
const BASE_URL = requiredEnv('NEXT_PUBLIC_BASE_URL');

/**
 * MCP Resource: store://policies
 * Returns store policies as formatted text.
 *
 * Includes:
 * - Shipping policy
 * - Returns & refunds policy
 * - Privacy policy summary
 */
export async function readStorePolicies(
  uri: URL
): Promise<ReadResourceResult> {
  try {
    // TODO: In production, fetch these from database or CMS
    // For now, return static policies
    const policies = `# Store Policies

## Shipping Policy

We partner with Printful for print-on-demand fulfillment. Orders are processed and shipped within 2-7 business days.

**Shipping Times:**
- US: 3-5 business days
- Canada: 5-10 business days
- Europe: 7-14 business days
- International: 10-21 business days

**Shipping Costs:**
- Calculated at checkout based on destination
- Free shipping on orders over $50 (US only)

## Returns & Refunds Policy

We want you to be completely satisfied with your purchase.

**Return Window:**
- 30 days from delivery date
- Items must be unworn, unwashed, and in original condition
- Custom personalized items cannot be returned unless defective

**Refund Process:**
1. Contact ${SUPPORT_EMAIL} with order number and reason
2. We'll provide a return shipping label
3. Refund processed within 5-7 business days after receiving the return

**Defective Items:**
- Free replacement or full refund for manufacturing defects
- Report within 14 days of delivery

## Privacy Policy Summary

**Data We Collect:**
- Name, email, shipping address for order fulfillment
- Payment information (processed securely via Stripe)
- Optional: marketing preferences

**How We Use Your Data:**
- Process and fulfill orders
- Send order updates and shipping notifications
- Marketing communications (opt-in only)

**Your Rights:**
- Access your data at any time
- Request data export or deletion
- Unsubscribe from marketing emails

**Data Security:**
- All data encrypted in transit and at rest
- PCI-DSS compliant payment processing
- Regular security audits

For full policies, visit: ${BASE_URL}/policies
`;

    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'text/plain',
          text: policies
        }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'text/plain',
          text: `Error loading policies: ${errorMessage}`
        }
      ]
    };
  }
}
