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
  // Store information from environment — all required except description and currency
  const { requiredEnv, optionalEnv } = await import('../lib/env.js');
  const storeName = requiredEnv('NEXT_PUBLIC_SITE_NAME');
  const storeDescription = optionalEnv('STORE_DESCRIPTION');

  return {
    success: true,
    store: {
      name: storeName,
      description: storeDescription,
      tagline: requiredEnv('NEXT_PUBLIC_SITE_TAGLINE'),
      supported_currencies: ['EUR', 'USD', 'GBP'],
      default_currency: optionalEnv('DEFAULT_CURRENCY', 'EUR'),
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
