/**
 * Individual Category API
 * GET /api/admin/categories/[id] - Get a single category
 * PATCH /api/admin/categories/[id] - Update a category
 * DELETE /api/admin/categories/[id] - Delete a category
 */

import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { withPermission } from '@/lib/rbac';
import { withValidation } from '@/lib/validation';
import { categoryUpdateSchema } from '@/lib/schemas/extended';

export const GET = withAuth(async (req, session, context) => {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data: category, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error in category GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})

export const PATCH = withPermission('settings', 'update', withValidation(categoryUpdateSchema, async (req, validatedData, session, context) => {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data: category, error } = await supabase
      .from('categories')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      return NextResponse.json(
        { error: 'Failed to update category' },
        { status: 500 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error in category PATCH API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}))

export const DELETE = withPermission('settings', 'update', async (req, session, context) => {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    // Pre-flight check: prevent deletion if products reference this category
    const { count, error: countError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category', id);

    if (countError) {
      console.error('Error checking category dependencies:', countError);
      return NextResponse.json(
        { error: 'Failed to verify category dependencies' },
        { status: 500 }
      );
    }

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} products use this category` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      return NextResponse.json(
        { error: 'Failed to delete category' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in category DELETE API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})
