import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STORE_DEFAULTS } from '@/lib/store-config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface ShippingZone {
  id: string;
  country_code: string;
  zip_pattern: string | null;
  state_code: string | null;
  base_rate: number;
  per_item_rate: number;
  free_shipping_threshold: number | null;
  estimated_days_min: number;
  estimated_days_max: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zipCode, countryCode = STORE_DEFAULTS.country, cartTotal, itemCount = 1 } = body;

    if (!zipCode || !countryCode) {
      return NextResponse.json(
        { error: 'Zip code and country code are required' },
        { status: 400 }
      );
    }

    // Normalize zip code (remove spaces, dashes)
    const normalizedZip = zipCode.toString().replace(/[\s-]/g, '');

    // Query shipping zones
    // First try to find a specific zone matching the zip pattern
    const { data: zones, error } = await supabase
      .from('shipping_zones')
      .select('*')
      .eq('country_code', countryCode.toUpperCase())
      .eq('active', true)
      .order('zip_pattern', { ascending: false }); // More specific patterns first

    if (error) {
      console.error('Shipping zones query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch shipping zones' },
        { status: 500 }
      );
    }

    if (!zones || zones.length === 0) {
      return NextResponse.json(
        { error: 'Shipping not available for this country' },
        { status: 404 }
      );
    }

    // Find best matching zone
    let selectedZone: ShippingZone | null = null;

    // Try to find zip-specific zone first
    for (const zone of zones as ShippingZone[]) {
      if (!zone.zip_pattern || zone.zip_pattern === '%') {
        continue; // Skip default zone for now
      }

      // Convert SQL LIKE pattern to regex
      const pattern = zone.zip_pattern.replace(/%/g, '.*');
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(normalizedZip)) {
        selectedZone = zone;
        break; // Found specific match
      }
    }

    // Fallback to default zone for country
    if (!selectedZone) {
      selectedZone = (zones as ShippingZone[]).find(z => z.zip_pattern === '%' || !z.zip_pattern) || zones[0] as ShippingZone;
    }

    if (!selectedZone) {
      return NextResponse.json(
        { error: 'No shipping zone found' },
        { status: 404 }
      );
    }

    // Calculate shipping cost
    let shippingCost = selectedZone.base_rate + (selectedZone.per_item_rate * (itemCount - 1));

    // Check for free shipping threshold
    const isFreeShipping = selectedZone.free_shipping_threshold && cartTotal >= selectedZone.free_shipping_threshold;
    if (isFreeShipping) {
      shippingCost = 0;
    }

    return NextResponse.json({
      success: true,
      shipping: {
        cost: parseFloat(shippingCost.toFixed(2)),
        isFree: isFreeShipping,
        freeShippingThreshold: selectedZone.free_shipping_threshold,
        estimatedDaysMin: selectedZone.estimated_days_min,
        estimatedDaysMax: selectedZone.estimated_days_max,
        zone: {
          country: selectedZone.country_code,
          state: selectedZone.state_code,
        },
      },
    });
  } catch (error) {
    console.error('Shipping estimate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
