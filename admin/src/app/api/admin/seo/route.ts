import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, session) => {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('seo_meta_tags')
      .select('locale, title, description, keywords')
      .order('locale');

    if (error) {
      console.error('Error fetching SEO meta tags:', error);
      return NextResponse.json({ error: 'Failed to fetch SEO meta tags' }, { status: 500 });
    }

    // Transform array to object keyed by locale
    const metaTags = {
      en: data.find(d => d.locale === 'en') || { title: '', description: '', keywords: '' },
      es: data.find(d => d.locale === 'es') || { title: '', description: '', keywords: '' },
      de: data.find(d => d.locale === 'de') || { title: '', description: '', keywords: '' },
    };

    return NextResponse.json(metaTags);
  } catch (error) {
    console.error('Error in SEO GET API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const supabase = createClient();
    const body = await req.json();

    // Validate request body
    if (!body.locale || !body.title || !body.description || !body.keywords) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['en', 'es', 'de'].includes(body.locale)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }

    // Update or insert meta tags for the locale
    const { error } = await supabase
      .from('seo_meta_tags')
      .upsert({
        locale: body.locale,
        title: body.title,
        description: body.description,
        keywords: body.keywords,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'locale'
      });

    if (error) {
      console.error('Error updating SEO meta tags:', error);
      return NextResponse.json({ error: 'Failed to update SEO meta tags' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in SEO POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})
