import { z } from 'zod';

/**
 * MCP Tool: get_store_policies
 *
 * Get store policies including shipping, returns, and privacy information.
 * This information helps users understand the store's terms and conditions.
 *
 * This is a PUBLIC tool (no authentication required).
 */

export const getStorePoliciesSchema = z.object({
  // No parameters needed
});

export type GetStorePoliciesInput = z.infer<typeof getStorePoliciesSchema>;

export interface GetStorePoliciesResult {
  success: boolean;
  policies: {
    shipping: {
      title: string;
      content: string;
    };
    returns: {
      title: string;
      content: string;
    };
    privacy: {
      title: string;
      content: string;
    };
  };
}

export async function getStorePolicies(
  _input: GetStorePoliciesInput
): Promise<GetStorePoliciesResult> {
  // In a production system, this would fetch from a database or CMS
  // For now, we return comprehensive policy text
  return {
    success: true,
    policies: {
      shipping: {
        title: 'Shipping Policy',
        content: `We offer worldwide shipping on all products. Orders are processed within 2-5 business days and shipped via our fulfillment partners.

**Shipping Times:**
- United States: 3-7 business days
- Europe: 5-10 business days
- Rest of World: 7-14 business days

**Shipping Costs:**
Calculated at checkout based on destination and order value. Free shipping on orders over €50 (or equivalent in your currency).

**Tracking:**
You will receive a tracking number via email once your order ships. Track your order through the tracking link provided.

**Custom Products:**
Please note that all products are custom-made on demand. This means production takes a few days before shipping begins.`,
      },
      returns: {
        title: 'Returns & Refunds Policy',
        content: `We want you to be completely satisfied with your purchase. If you're not happy with your order, we offer a 30-day return policy for most products.

**Eligibility:**
- Products must be returned within 30 days of delivery
- Items must be unworn, unused, and in original condition
- Custom personalized items may not be eligible for return unless defective

**How to Return:**
1. Contact our support team with your order number
2. We'll provide a return shipping label
3. Ship the item back to us
4. Refund processed within 5-7 business days after receipt

**Refunds:**
Refunds are issued to the original payment method. Shipping costs are non-refundable unless the return is due to our error.

**Damaged or Defective Items:**
If you receive a damaged or defective product, please contact us immediately with photos. We'll send a replacement at no charge.`,
      },
      privacy: {
        title: 'Privacy Policy',
        content: `At ${process.env.STORE_NAME || process.env.NEXT_PUBLIC_SITE_NAME || 'My Store'}, we respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information.

**Information We Collect:**
- Account information (name, email, shipping address)
- Payment information (processed securely through Stripe)
- Order history and preferences
- Chat conversations with our AI assistant
- Cookies and usage data for site improvement

**How We Use Your Data:**
- Process and fulfill your orders
- Communicate about your orders and account
- Improve our AI assistant and personalization features
- Send marketing emails (you can opt out anytime)
- Comply with legal obligations

**Data Security:**
We use industry-standard encryption and security measures to protect your data. Payment information is never stored on our servers - it's handled securely by Stripe.

**Your Rights:**
You have the right to access, correct, or delete your personal data. You can also request a copy of your data or opt out of marketing communications at any time.

**GDPR Compliance:**
For EU customers, we comply with GDPR regulations. You have additional rights including data portability and the right to be forgotten.

**Contact:**
For privacy questions or to exercise your rights, contact our Data Protection Officer at ${process.env.STORE_PRIVACY_EMAIL || 'privacy@example.com'}.

**Updates:**
We may update this policy from time to time. The latest version is always available at /privacy.

Last updated: February 2026`,
      },
    },
  };
}
