/**
 * POST /api/products/[id]/files — Upload a digital file for a product
 * Body: multipart form data with 'file' field
 *
 * GET /api/products/[id]/files — List digital files for a product
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase';

export const GET = withPermission('products', 'read', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params;

  const { data: product, error } = await supabaseAdmin
    .from('products')
    .select('id, digital_files')
    .eq('id', id)
    .single();

  if (error || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ files: product.digital_files || [] });
});

export const POST = withPermission('products', 'update', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const storagePath = `digital-products/${id}/${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from('digital-products')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Digital file upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Update product digital_files JSONB
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('digital_files')
      .eq('id', id)
      .single();

    const currentFiles = product?.digital_files || [];
    const newFile = {
      name: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
      mime_type: file.type,
      uploaded_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        digital_files: [...currentFiles, newFile],
      })
      .eq('id', id);

    if (updateError) {
      console.error('Digital files update error:', updateError);
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    return NextResponse.json({ file: newFile }, { status: 201 });
  } catch (error) {
    console.error('Digital file upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
});
