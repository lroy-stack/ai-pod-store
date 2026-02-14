import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, status } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or missing ids' },
        { status: 400 }
      );
    }

    if (!status || typeof status !== 'string') {
      return NextResponse.json(
        { error: 'status must be a string' },
        { status: 400 }
      );
    }

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .update({ status })
      .in('id', ids)
      .select();

    if (error) {
      console.error('Bulk update error:', error);
      return NextResponse.json(
        { error: 'Failed to bulk update products' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: products?.length || 0,
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update products' },
      { status: 500 }
    );
  }
}
