/**
 * Categories API
 * GET /api/admin/categories - Returns all categories with product counts
 * POST /api/admin/categories - Create a new category
 */

import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { withPermission } from '@/lib/rbac';
import { withValidation, categorySchema } from '@/lib/validation';

export const GET = withAuth(async (req, session) => {
  try {
    const supabase = createClient();

    // Fetch all categories
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    // Get product counts per category
    const { data: productCounts } = await supabase
      .from('products')
      .select('category')
      .eq('status', 'active');

    const countMap = new Map<string, number>();
    if (productCounts) {
      for (const product of productCounts) {
        const category = product.category;
        if (category) {
          countMap.set(category, (countMap.get(category) || 0) + 1);
        }
      }
    }

    // Add product counts to categories
    const categoriesWithCounts = (categories || []).map(cat => ({
      ...cat,
      product_count: countMap.get(cat.slug) || 0,
    }));

    return NextResponse.json(categoriesWithCounts);
  } catch (error) {
    console.error('Error in categories GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})

export const POST = withPermission('settings', 'update', withValidation(categorySchema, async (req, validatedData, session) => {
  try {
    const supabase = createClient();

    const { data: category, error } = await supabase
      .from('categories')
      .insert(validatedData)
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json(
        { error: 'Failed to create category' },
        { status: 500 }
      );
    }

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error in categories POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}))
