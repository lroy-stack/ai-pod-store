/**
 * GET /api/printful/catalog — Browse Printful product catalog
 * Query params: ?offset=0&limit=100&category_id=24
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { printfulFetch } from '@/lib/printful';

export const GET = withPermission('products', 'read', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const offset = searchParams.get('offset') || '0';
  const limit = searchParams.get('limit') || '100';
  const categoryId = searchParams.get('category_id');

  try {
    const path = categoryId
      ? `/products?offset=${offset}&limit=${limit}&category_id=${categoryId}`
      : `/products?offset=${offset}&limit=${limit}`;

    const { data, paging } = await printfulFetch<unknown[]>(path);

    return NextResponse.json({ products: data, paging });
  } catch (error) {
    console.error('Printful catalog error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch catalog' },
      { status: 500 }
    );
  }
});
