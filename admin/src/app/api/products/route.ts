import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermission } from '@/lib/rbac';
import { logCreate } from '@/lib/audit';
import { withValidation, productSchema } from '@/lib/validation';
import { sanitizeSearch } from '@/lib/query-sanitizer';

// GET requires 'read' permission on 'products' resource
export const GET = withPermission('products', 'read', async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const rawSearch = searchParams.get('search') || '';
    const search = rawSearch ? sanitizeSearch(rawSearch) : '';
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Add search filter if provided
    if (search) {
      query = query.or(`title.ilike.%${search}%,category.ilike.%${search}%`);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;

    if (error) {
      console.error('Products fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      products: products || [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('Products error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
});

// POST requires 'create' permission on 'products' resource
export const POST = withPermission('products', 'create', withValidation(productSchema, async (req: NextRequest, validatedData, session) => {
  try {
    const {
      title,
      name,
      description,
      base_price_cents,
      currency,
      category,
      tags,
      stock,
      design_id,
      image_url,
      status,
      product_details,
      seo_title,
      seo_description,
    } = validatedData;

    // Support both 'title' and 'name' fields (schema already validates at least one exists)
    const productName = name || title;

    const insertData: any = {
      title: productName,
      description: description || '',
      base_price_cents,
      currency: currency.toLowerCase(),
      category: category || 'apparel',
      tags: tags || [],
      status: status || 'active',
    };

    // Add image_url to images array if provided
    if (image_url) {
      insertData.images = [{ src: image_url, alt: productName }];
    }

    // GPSR compliance data (EU Regulation 2023/988)
    if (product_details) {
      insertData.product_details = product_details;
    }

    // SEO metadata
    if (seo_title) insertData.seo_title = seo_title;
    if (seo_description) insertData.seo_description = seo_description;

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Product creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create product' },
        { status: 500 }
      );
    }

    // Log audit event
    await logCreate(session.userId, 'product', product.id, product, session.email);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Product creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}));
