import { withAuth } from '@/lib/auth-middleware'
import { withPermission } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// DELETE /api/blog/[id] - Delete blog post
export const DELETE = withPermission('blog', 'delete', async (req, session, context) => {
  try {
    const { id } = await context.params;

    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete blog post:', error);
      return NextResponse.json({ error: 'Failed to delete blog post' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Blog API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})

// GET /api/blog/[id] - Get single blog post
export const GET = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params;

    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Blog API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})
