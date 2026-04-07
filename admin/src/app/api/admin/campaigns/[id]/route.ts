import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/auth-middleware';
import { withPermission } from '@/lib/rbac';
import { z } from 'zod';

const campaignUpdateSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'scheduled', 'active', 'archived']).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  title: z.record(z.string(), z.string()).optional(),
  subtitle: z.record(z.string(), z.string()).optional(),
  cta_text: z.record(z.string(), z.string()).optional(),
  cta_url: z.string().min(1).optional(),
  sub_cta_text: z.record(z.string(), z.string()).optional(),
  image_url: z.string().nullable().optional(),
  shop_hero_image_url: z.string().nullable().optional(),
  image_alt: z.record(z.string(), z.string()).optional(),
  og_image_url: z.string().nullable().optional(),
  collection_id: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/admin/campaigns/[id]
 * Fetch a single campaign by ID
 */
export const GET = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('hero_campaigns')
      .select('*, collection:collections(id, slug, name)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign: data });
  } catch (error) {
    console.error('Error in GET /api/admin/campaigns/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * PUT /api/admin/campaigns/[id]
 * Update an existing campaign
 */
export const PUT = withPermission('settings', 'update', async (req, session, context) => {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const validated = campaignUpdateSchema.parse(body);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('hero_campaigns')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A campaign with this slug already exists' }, { status: 409 });
      }
      console.error('Error updating campaign:', error);
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
      }, { status: 400 });
    }
    console.error('Error in PUT /api/admin/campaigns/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * DELETE /api/admin/campaigns/[id]
 * Delete a campaign
 */
export const DELETE = withPermission('settings', 'delete', async (req, session, context) => {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    // Fetch campaign details before deletion for audit trail
    const { data: campaign } = await supabase
      .from('hero_campaigns')
      .select('id, slug, name')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('hero_campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting campaign:', error);
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }

    // Audit log: record campaign deletion
    console.info('Campaign deleted', {
      campaignId: id,
      campaignSlug: campaign?.slug ?? 'unknown',
      campaignName: campaign?.name ?? 'unknown',
      deletedBy: session.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/campaigns/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
