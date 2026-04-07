/**
 * Legal Pages API
 * GET /api/admin/legal-pages - Returns all legal pages
 */

import { createClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, session) => {
  try {
    const supabase = createClient();

    const { data: pages, error } = await supabase
      .from('legal_pages')
      .select('*')
      .order('slug', { ascending: true });

    if (error) {
      console.error('Error fetching legal pages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch legal pages' },
        { status: 500 }
      );
    }

    return NextResponse.json(pages || []);
  } catch (error) {
    console.error('Error in legal-pages GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})
