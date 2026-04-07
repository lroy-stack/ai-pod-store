import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { SUPPORTED_COUNTRY_CODES } from '../lib/product-helpers.js';

export const manageShippingAddressSchema = z.object({
  action: z.enum(['create', 'update', 'delete']).describe('Action to perform'),
  address_id: z.string().uuid().optional().describe('Address UUID (required for update/delete)'),
  label: z.string().max(50).optional().describe('Address label (e.g., "Home", "Office")'),
  full_name: z.string().min(1).max(100).optional().describe('Full name for shipping'),
  street_line1: z.string().min(1).max(200).optional().describe('Street address line 1'),
  street_line2: z.string().max(200).optional().describe('Street address line 2'),
  city: z.string().min(1).max(100).optional().describe('City'),
  state: z.string().max(100).optional().describe('State/Province/Region'),
  postal_code: z.string().min(1).max(20).optional().describe('Postal/ZIP code'),
  country_code: z.enum(SUPPORTED_COUNTRY_CODES).optional().describe('ISO 3166-1 alpha-2 country code'),
  phone: z.string().max(30).optional().describe('Phone number'),
  is_default: z.boolean().optional().describe('Set as default address'),
});

export type ManageShippingAddressInput = z.infer<typeof manageShippingAddressSchema>;

export interface ManageShippingAddressResult {
  success: boolean;
  error?: string;
  message?: string;
  address?: {
    id: string;
    label: string | null;
    full_name: string;
    is_default: boolean;
  };
}

export async function manageShippingAddress(
  input: ManageShippingAddressInput,
  authInfo?: AuthInfo
): Promise<ManageShippingAddressResult> {
  if (!authInfo || !authInfo.extra?.userId) {
    return { success: false, error: 'Authentication required' };
  }

  const userId = authInfo.extra.userId as string;

  try {
    const supabase = getSupabaseClient();
    const { action, address_id, ...fields } = input;

    // --- DELETE ---
    if (action === 'delete') {
      if (!address_id) {
        return { success: false, error: 'address_id is required for delete' };
      }

      // Verify ownership
      const { data: existing } = await supabase
        .from('shipping_addresses')
        .select('id, user_id')
        .eq('id', address_id)
        .single();

      if (!existing || existing.user_id !== userId) {
        return { success: false, error: 'Address not found' };
      }

      const { error: deleteError } = await supabase
        .from('shipping_addresses')
        .delete()
        .eq('id', address_id);

      if (deleteError) {
        console.error('[manage_shipping_address] Delete error:', deleteError);
        return { success: false, error: 'Failed to delete address' };
      }

      return { success: true, message: 'Address deleted successfully' };
    }

    // --- UPDATE ---
    if (action === 'update') {
      if (!address_id) {
        return { success: false, error: 'address_id is required for update' };
      }

      // Verify ownership
      const { data: existing } = await supabase
        .from('shipping_addresses')
        .select('id, user_id')
        .eq('id', address_id)
        .single();

      if (!existing || existing.user_id !== userId) {
        return { success: false, error: 'Address not found' };
      }

      // If setting as default, unset other defaults
      if (fields.is_default) {
        await supabase
          .from('shipping_addresses')
          .update({ is_default: false })
          .eq('user_id', userId)
          .neq('id', address_id);
      }

      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (fields.label !== undefined) updateData.label = fields.label;
      if (fields.full_name !== undefined) updateData.full_name = fields.full_name;
      if (fields.street_line1 !== undefined) updateData.street_line1 = fields.street_line1;
      if (fields.street_line2 !== undefined) updateData.street_line2 = fields.street_line2;
      if (fields.city !== undefined) updateData.city = fields.city;
      if (fields.state !== undefined) updateData.state = fields.state;
      if (fields.postal_code !== undefined) updateData.postal_code = fields.postal_code;
      if (fields.country_code !== undefined) updateData.country_code = fields.country_code;
      if (fields.phone !== undefined) updateData.phone = fields.phone;
      if (fields.is_default !== undefined) updateData.is_default = fields.is_default;

      const { data: updated, error: updateError } = await supabase
        .from('shipping_addresses')
        .update(updateData)
        .eq('id', address_id)
        .select('id, label, full_name, is_default')
        .single();

      if (updateError) {
        console.error('[manage_shipping_address] Update error:', updateError);
        return { success: false, error: 'Failed to update address' };
      }

      return {
        success: true,
        message: 'Address updated successfully',
        address: {
          id: updated.id,
          label: updated.label,
          full_name: updated.full_name,
          is_default: updated.is_default,
        },
      };
    }

    // --- CREATE ---
    if (!fields.full_name || !fields.street_line1 || !fields.city || !fields.postal_code || !fields.country_code) {
      return {
        success: false,
        error: 'Required fields for create: full_name, street_line1, city, postal_code, country_code',
      };
    }

    // If setting as default, unset other defaults
    if (fields.is_default) {
      await supabase
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { data: created, error: createError } = await supabase
      .from('shipping_addresses')
      .insert({
        user_id: userId,
        label: fields.label || null,
        full_name: fields.full_name,
        street_line1: fields.street_line1,
        street_line2: fields.street_line2 || null,
        city: fields.city,
        state: fields.state || null,
        postal_code: fields.postal_code,
        country_code: fields.country_code,
        phone: fields.phone || null,
        is_default: fields.is_default || false,
      })
      .select('id, label, full_name, is_default')
      .single();

    if (createError) {
      console.error('[manage_shipping_address] Create error:', createError);
      return { success: false, error: 'Failed to create address' };
    }

    return {
      success: true,
      message: 'Address created successfully',
      address: {
        id: created.id,
        label: created.label,
        full_name: created.full_name,
        is_default: created.is_default,
      },
    };
  } catch (err) {
    console.error('[manage_shipping_address] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
