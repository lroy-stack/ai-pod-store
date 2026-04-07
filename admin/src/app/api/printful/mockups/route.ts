/**
 * POST /api/printful/mockups — Generate mockup for a store product
 * Body: { product_id: number (Printful store product ID) }
 *
 * GET /api/printful/mockups?task_key=xxx — Check mockup generation status
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { printfulFetch } from '@/lib/printful';

export const POST = withPermission('products', 'create', async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { product_id } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }

    const { data } = await printfulFetch(`/mockup-generator/create-task/${product_id}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Mockup generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create mockup' },
      { status: 500 }
    );
  }
});

export const GET = withPermission('products', 'read', async (req: NextRequest) => {
  const taskKey = new URL(req.url).searchParams.get('task_key');

  if (!taskKey) {
    return NextResponse.json({ error: 'task_key is required' }, { status: 400 });
  }

  try {
    const { data } = await printfulFetch(`/mockup-generator/task?task_key=${taskKey}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Mockup status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check mockup status' },
      { status: 500 }
    );
  }
});
