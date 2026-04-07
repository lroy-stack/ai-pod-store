import { withAuth } from '@/lib/auth-middleware'
import { withPermission } from '@/lib/rbac'
import { withValidation } from '@/lib/validation'
import { blogPostSchema } from '@/lib/schemas/extended'
import { logCreate } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET /api/blog - List all blog posts
export const GET = withAuth(async (req, session) => {
  try {
    const { data: posts, error } = await supabase
      .from('blog_posts')
      .select('id, slug, title_en, title_es, title_de, status, published_at, views, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch blog posts:', error);
      return NextResponse.json({ error: 'Failed to fetch blog posts' }, { status: 500 });
    }

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Blog API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})

// POST /api/blog - Create new blog post
export const POST = withPermission('blog', 'create', withValidation(blogPostSchema, async (req, validatedData, session) => {
  try {
    const {
      slug,
      title_en,
      title_es,
      title_de,
      content_en,
      content_es,
      content_de,
      excerpt_en,
      excerpt_es,
      excerpt_de,
      featured_image,
      status,
      published_at,
      tags,
    } = validatedData;

    // Insert blog post
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        slug,
        title_en,
        title_es,
        title_de,
        content_en,
        content_es,
        content_de,
        excerpt_en: excerpt_en || null,
        excerpt_es: excerpt_es || null,
        excerpt_de: excerpt_de || null,
        featured_image: featured_image || null,
        status: status || 'draft',
        published_at: status === 'published' ? (published_at || new Date().toISOString()) : null,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create blog post:', error);
      return NextResponse.json({ error: 'Failed to create blog post' }, { status: 500 });
    }

    // Log audit event
    await logCreate(session.userId, 'blog_post', post.id, post, session.email);

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Blog API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}))
