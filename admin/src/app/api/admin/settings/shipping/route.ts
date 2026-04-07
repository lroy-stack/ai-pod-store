/**
 * GET/PUT /api/admin/settings/shipping — Manage shipping configuration
 *
 * Stores shipping rates, free threshold, and allowed countries in
 * the store_settings table (key: 'shipping').
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const shippingConfigSchema = z.object({
  free_shipping_threshold_cents: z.number().int().min(0),
  allowed_countries: z.array(z.string().length(2)),
  rates: z.array(z.object({
    country_code: z.string().length(2),
    standard_rate_cents: z.number().int().min(0),
    express_rate_cents: z.number().int().min(0).optional(),
    standard_days_min: z.number().int().min(1),
    standard_days_max: z.number().int().min(1),
    express_days_min: z.number().int().min(1).optional(),
    express_days_max: z.number().int().min(1).optional(),
  })),
  express_enabled: z.boolean(),
});

export const GET = withPermission('settings', 'read', async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('store_settings')
      .select('value')
      .eq('key', 'shipping')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Shipping settings fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Return defaults if not yet configured
    const defaults = {
      free_shipping_threshold_cents: 5000,
      allowed_countries: ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE', 'GB', 'US', 'CA'],
      rates: [
        { country_code: 'DE', standard_rate_cents: 399, standard_days_min: 3, standard_days_max: 5 },
        { country_code: 'FR', standard_rate_cents: 499, standard_days_min: 4, standard_days_max: 6 },
        { country_code: 'ES', standard_rate_cents: 499, standard_days_min: 4, standard_days_max: 6 },
        { country_code: 'US', standard_rate_cents: 1299, standard_days_min: 10, standard_days_max: 14 },
      ],
      express_enabled: false,
    };

    return NextResponse.json(data?.value || defaults);
  } catch (error) {
    console.error('Shipping settings error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
});

export const PUT = withPermission('settings', 'update', async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = shippingConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { error } = await supabaseAdmin
      .from('store_settings')
      .upsert({
        key: 'shipping',
        value: parsed.data,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.error('Shipping settings update error:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ status: 'saved', config: parsed.data });
  } catch (error) {
    console.error('Shipping settings error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
});
