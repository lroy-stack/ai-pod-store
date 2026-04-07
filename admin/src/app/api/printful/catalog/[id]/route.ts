/**
 * GET /api/printful/catalog/[id] — Get single catalog product with variants
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { printfulFetch } from '@/lib/printful';

export const GET = withPermission('products', 'read', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params;

  try {
    const { data } = await printfulFetch(`/products/${id}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Printful catalog product error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch product' },
      { status: 500 }
    );
  }
});
