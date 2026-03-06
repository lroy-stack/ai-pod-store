import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  try {
    const { locale } = await params;

    // Validate locale
    if (!['en', 'es', 'de'].includes(locale)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('seo_meta_tags')
      .select('title, description, keywords')
      .eq('locale', locale)
      .single();

    if (error) {
      console.error('Error fetching SEO meta tags:', error);
      // Return defaults if not found
      return NextResponse.json({
        title: 'SKAPARA',
        description: '',
        keywords: '',
      });
    }

    return NextResponse.json(data || { title: 'SKAPARA', description: '', keywords: '' });
  } catch (error) {
    console.error('Error in SEO API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
