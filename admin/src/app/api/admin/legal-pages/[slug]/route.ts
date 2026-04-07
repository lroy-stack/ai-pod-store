/**
 * Legal Page API (Individual)
 * GET /api/admin/legal-pages/[slug] - Get single page by slug
 * PUT /api/admin/legal-pages/[slug] - Update page and create version
 */

import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { withPermission } from '@/lib/rbac';

export const GET = withAuth(async (req, session, context) => {
  try {
    const { slug } = await context.params;
    const supabase = createClient();

    const { data: page, error } = await supabase
      .from('legal_pages')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('Error fetching legal page:', error);
      return NextResponse.json(
        { error: 'Legal page not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error('Error in legal-pages/[slug] GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})

export const PUT = withPermission('settings', 'update', async (req, session, context) => {
  try {
    const { slug } = await context.params;
    const body = await req.json();
    const supabase = createClient();

    const {
      title_en,
      title_es,
      title_de,
      content_en,
      content_es,
      content_de,
      changed_by = 'admin',
    } = body;

    // Validate required fields
    if (!title_en || !title_es || !title_de || !content_en || !content_es || !content_de) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current page to create version
    const { data: currentPage, error: fetchError } = await supabase
      .from('legal_pages')
      .select('*')
      .eq('slug', slug)
      .single();

    if (fetchError) {
      console.error('Error fetching current page:', fetchError);
      return NextResponse.json(
        { error: 'Legal page not found' },
        { status: 404 }
      );
    }

    // Get next version number
    const { data: versions, error: versionsError } = await supabase
      .from('legal_page_versions')
      .select('version_number')
      .eq('legal_page_id', currentPage.id)
      .order('version_number', { ascending: false })
      .limit(1);

    if (versionsError) {
      console.error('Error fetching versions:', versionsError);
    }

    const nextVersion = versions && versions.length > 0
      ? versions[0].version_number + 1
      : 1;

    // Create version snapshot BEFORE updating
    const { error: versionError } = await supabase
      .from('legal_page_versions')
      .insert({
        legal_page_id: currentPage.id,
        version_number: nextVersion,
        title_en: currentPage.title_en,
        title_es: currentPage.title_es,
        title_de: currentPage.title_de,
        content_en: currentPage.content_en,
        content_es: currentPage.content_es,
        content_de: currentPage.content_de,
        changed_by,
      });

    if (versionError) {
      console.error('Error creating version:', versionError);
      return NextResponse.json(
        { error: 'Failed to create version' },
        { status: 500 }
      );
    }

    // Update the page
    const { data: updatedPage, error: updateError } = await supabase
      .from('legal_pages')
      .update({
        title_en,
        title_es,
        title_de,
        content_en,
        content_es,
        content_de,
      })
      .eq('slug', slug)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating legal page:', updateError);
      return NextResponse.json(
        { error: 'Failed to update legal page' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      page: updatedPage,
      version: nextVersion,
    });
  } catch (error) {
    console.error('Error in legal-pages/[slug] PUT API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})
