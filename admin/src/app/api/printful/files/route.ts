/**
 * POST /api/printful/files — Upload design file to Printful file library
 * Body: { url: string } (public URL of the design image)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { printfulFetch } from '@/lib/printful';

export const POST = withPermission('products', 'create', async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { url, filename } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const { data } = await printfulFetch('/files', {
      method: 'POST',
      body: JSON.stringify({
        url,
        filename: filename || 'design.png',
      }),
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Printful file upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
});
