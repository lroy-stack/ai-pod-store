/**
 * GET /api/printful/catalog/[id]/printfiles — Get placement specs (dimensions, DPI)
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
    const { data } = await printfulFetch(`/v2/catalog-products/${id}/catalog-variants`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Printful printfiles error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch printfiles' },
      { status: 500 }
    );
  }
});
