import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/auth-middleware';
import { withPermission } from '@/lib/rbac';
import { withValidation } from '@/lib/validation';
import { z } from 'zod';

const campaignCreateSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(200),
  status: z.enum(['draft', 'scheduled', 'active', 'archived']).default('draft'),
  priority: z.number().int().min(0).max(100).default(0),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  title: z.record(z.string(), z.string()).default({}),
  subtitle: z.record(z.string(), z.string()).default({}),
  cta_text: z.record(z.string(), z.string()).default({}),
  cta_url: z.string().min(1).default('/shop'),
  sub_cta_text: z.record(z.string(), z.string()).default({}),
  image_url: z.string().nullable().optional(),
  shop_hero_image_url: z.string().nullable().optional(),
  image_alt: z.record(z.string(), z.string()).default({}),
  og_image_url: z.string().nullable().optional(),
  collection_id: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/admin/campaigns
 * List all hero campaigns with optional status filter
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const supabase = createClient();

    let query = supabase
      .from('hero_campaigns')
      .select('*, collection:collections(id, slug, name)')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching campaigns:', error);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    return NextResponse.json({ campaigns: data || [] });
  } catch (error) {
    console.error('Error in GET /api/admin/campaigns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * POST /api/admin/campaigns
 * Create a new hero campaign
 */
export const POST = withPermission('settings', 'create', withValidation(campaignCreateSchema, async (req, validated) => {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('hero_campaigns')
      .insert(validated)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A campaign with this slug already exists' }, { status: 409 });
      }
      console.error('Error creating campaign:', error);
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    return NextResponse.json({ campaign: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/campaigns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}));
