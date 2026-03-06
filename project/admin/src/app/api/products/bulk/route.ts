import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withValidation, bulkProductUpdateSchema } from '@/lib/validation';
import { withAuth } from '@/lib/auth-middleware';

export const PATCH = withAuth(withValidation(bulkProductUpdateSchema, async (req: NextRequest, validatedData) => {
  try {
    const { ids, status } = validatedData;

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
}));
