import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';
import { SUPPORTED_COUNTRY_CODES } from '../lib/product-helpers.js';

export const estimateShippingSchema = z.object({
  country_code: z.enum(SUPPORTED_COUNTRY_CODES).describe('ISO 3166-1 alpha-2 country code (e.g., "DE", "ES", "FR")'),
  zip_code: z.string().min(1).max(20).describe('Postal/ZIP code'),
  cart_total: z.number().min(0).describe('Cart total in EUR (e.g., 49.99)'),
  item_count: z.number().int().min(1).optional().default(1).describe('Number of items in cart'),
});

export type EstimateShippingInput = z.infer<typeof estimateShippingSchema>;

export interface EstimateShippingResult {
  success: boolean;
  error?: string;
  shipping: {
    estimated_cost: number;
    currency: string;
    estimated_days_min: number;
    estimated_days_max: number;
    free_shipping_threshold: number | null;
    free_shipping_eligible: boolean;
    zone_name: string;
  } | null;
}

export async function estimateShipping(
  input: EstimateShippingInput
): Promise<EstimateShippingResult> {
  try {
    const supabase = getAnonClient();
    const { country_code, zip_code, cart_total, item_count } = input;

    // Normalize zip code (remove spaces, dashes)
    const normalizedZip = zip_code.toString().replace(/[\s-]/g, '');

    // Find matching shipping zone by country_code
    const { data: zones, error } = await supabase
      .from('shipping_zones')
      .select('*')
      .eq('country_code', country_code.toUpperCase())
      .eq('active', true)
      .order('zip_pattern', { ascending: false }); // More specific patterns first

    if (error) {
      console.error('[estimate_shipping] Database error:', error);
      return { success: false, error: 'Failed to fetch shipping zones', shipping: null };
    }

    if (!zones || zones.length === 0) {
      return {
        success: true,
        shipping: null,
        error: `Shipping not available to ${country_code}`,
      };
    }

    // Find best matching zone — zip-specific first, then default
    let matchedZone: any = null;

    for (const zone of zones) {
      if (!zone.zip_pattern || zone.zip_pattern === '%') continue;
      // Convert SQL LIKE pattern to regex
      const pattern = zone.zip_pattern.replace(/%/g, '.*');
      try {
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(normalizedZip)) {
          matchedZone = zone;
          break;
        }
      } catch {
        // Invalid pattern, skip
      }
    }

    // Fallback to default zone for country
    if (!matchedZone) {
      matchedZone = zones.find((z: any) => z.zip_pattern === '%' || !z.zip_pattern) || zones[0];
    }

    if (!matchedZone) {
      return {
        success: true,
        shipping: null,
        error: `No shipping zone found for ${country_code} ${zip_code}`,
      };
    }

    // Calculate cost — fields are base_rate/per_item_rate (EUR, not cents)
    const freeThreshold = matchedZone.free_shipping_threshold
      ? Number(matchedZone.free_shipping_threshold)
      : null;
    const isFreeShipping = freeThreshold !== null && cart_total >= freeThreshold;

    let estimatedCost = 0;
    if (!isFreeShipping) {
      const baseCost = Number(matchedZone.base_rate || 0);
      const perItemCost = Number(matchedZone.per_item_rate || 0);
      estimatedCost = baseCost + perItemCost * Math.max(0, (item_count || 1) - 1);
    }

    return {
      success: true,
      shipping: {
        estimated_cost: parseFloat(estimatedCost.toFixed(2)),
        currency: 'EUR',
        estimated_days_min: matchedZone.estimated_days_min || 3,
        estimated_days_max: matchedZone.estimated_days_max || 7,
        free_shipping_threshold: freeThreshold,
        free_shipping_eligible: isFreeShipping,
        zone_name: matchedZone.name || matchedZone.zone_name || 'Standard',
      },
    };
  } catch (err) {
    console.error('[estimate_shipping] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred', shipping: null };
  }
}
