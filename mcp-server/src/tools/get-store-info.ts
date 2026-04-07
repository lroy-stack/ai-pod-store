import { z } from 'zod';

/**
 * MCP Tool: get_store_info
 *
 * Get general information about the store, including name, description,
 * supported currencies, and other metadata.
 *
 * This is a PUBLIC tool (no authentication required).
 */

export const getStoreInfoSchema = z.object({
  // No parameters needed
});

export type GetStoreInfoInput = z.infer<typeof getStoreInfoSchema>;

export interface GetStoreInfoResult {
  success: boolean;
  store: {
    name: string;
    description: string;
    tagline: string;
    supported_currencies: string[];
    default_currency: string;
    supported_locales: string[];
    default_locale: string;
    features: string[];
  };
}

export async function getStoreInfo(
  _input: GetStoreInfoInput
): Promise<GetStoreInfoResult> {
  // Store information from environment or hardcoded defaults
  const storeName = process.env.STORE_NAME || process.env.NEXT_PUBLIC_SITE_NAME || 'My Store';
  const storeDescription =
    process.env.STORE_DESCRIPTION ||
    'Unique fashion & accessories designed with you, made in Europe. AI-powered print-on-demand with conversational commerce.';

  return {
    success: true,
    store: {
      name: storeName,
      description: storeDescription,
      tagline: process.env.STORE_TAGLINE || 'Wear what you mean',
      supported_currencies: ['EUR', 'USD', 'GBP'],
      default_currency: process.env.DEFAULT_CURRENCY || 'EUR',
      supported_locales: ['en', 'es', 'de'],
      default_locale: 'en',
      features: [
        'AI-powered product search',
        'Conversational shopping experience',
        'Custom product personalization',
        'Print-on-demand fulfillment',
        'Multi-language support (EN, ES, DE)',
        'Multi-currency support',
        'Secure Stripe payments',
        'Social login (Google, Apple)',
      ],
    },
  };
}
