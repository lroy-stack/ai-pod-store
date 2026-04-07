import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';

export const listShippingAddressesSchema = z.object({});

export type ListShippingAddressesInput = z.infer<typeof listShippingAddressesSchema>;

export interface ListShippingAddressesResult {
  success: boolean;
  error?: string;
  addresses: Array<{
    id: string;
    label: string | null;
    full_name: string;
    street_line1: string;
    street_line2: string | null;
    city: string;
    state: string | null;
    postal_code: string;
    country_code: string;
    phone: string | null;
    is_default: boolean;
  }>;
}

export async function listShippingAddresses(
  _input: ListShippingAddressesInput,
  authInfo?: AuthInfo
): Promise<ListShippingAddressesResult> {
  if (!authInfo || !authInfo.extra?.userId) {
    return { success: false, error: 'Authentication required', addresses: [] };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('shipping_addresses')
      .select('id, label, full_name, street_line1, street_line2, city, state, postal_code, country_code, phone, is_default')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[list_shipping_addresses] Database error:', error);
      return { success: false, error: 'Failed to fetch addresses', addresses: [] };
    }

    return {
      success: true,
      addresses: (data || []).map((a) => ({
        id: a.id,
        label: a.label || null,
        full_name: a.full_name,
        street_line1: a.street_line1,
        street_line2: a.street_line2 || null,
        city: a.city,
        state: a.state || null,
        postal_code: a.postal_code,
        country_code: a.country_code,
        phone: a.phone || null,
        is_default: a.is_default || false,
      })),
    };
  } catch (err) {
    console.error('[list_shipping_addresses] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred', addresses: [] };
  }
}
