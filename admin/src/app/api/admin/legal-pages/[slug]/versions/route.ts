/**
 * Legal Page Versions API
 * GET /api/admin/legal-pages/[slug]/versions - Get version history
 */

import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, session, context) => {
  try {
    const { slug } = await context.params;
    const supabase = createClient();

    // Get page ID from slug
    const { data: page, error: pageError } = await supabase
      .from('legal_pages')
      .select('id')
      .eq('slug', slug)
      .single();

    if (pageError) {
      console.error('Error fetching legal page:', pageError);
      return NextResponse.json(
        { error: 'Legal page not found' },
        { status: 404 }
      );
    }

    // Get version history
    const { data: versions, error: versionsError } = await supabase
      .from('legal_page_versions')
      .select('*')
      .eq('legal_page_id', page.id)
      .order('version_number', { ascending: false });

    if (versionsError) {
      console.error('Error fetching versions:', versionsError);
      return NextResponse.json(
        { error: 'Failed to fetch versions' },
        { status: 500 }
      );
    }

    return NextResponse.json(versions || []);
  } catch (error) {
    console.error('Error in legal-pages/[slug]/versions GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})
