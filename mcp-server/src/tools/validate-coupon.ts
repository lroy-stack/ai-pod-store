import { z } from 'zod';
import { getAnonClient } from '../lib/supabase.js';

export const validateCouponSchema = z.object({
  code: z.string().min(1).max(50).describe('The coupon code to validate'),
  cart_total: z.number().min(0).describe('Current cart total in EUR (e.g., 49.99)'),
});

export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

export interface ValidateCouponResult {
  success: boolean;
  error?: string;
  valid: boolean;
  coupon?: {
    code: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    discount_amount: number;
    new_total: number;
    min_purchase_amount: number | null;
    expires_at: string | null;
  };
}

export async function validateCoupon(
  input: ValidateCouponInput
): Promise<ValidateCouponResult> {
  try {
    const supabase = getAnonClient();
    const { code, cart_total } = input;

    // Case-insensitive lookup (matching frontend coupon-validation.ts)
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('id, code, discount_type, discount_value, min_purchase_amount, max_discount_amount, usage_limit, times_used, valid_from, valid_until, active')
      .ilike('code', code.trim())
      .eq('active', true)
      .single();

    if (error || !coupon) {
      return { success: true, valid: false, error: 'Invalid coupon code' };
    }

    // Date range validation
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return { success: true, valid: false, error: 'Coupon is not yet valid' };
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return { success: true, valid: false, error: 'Coupon has expired' };
    }

    // Global usage limit
    if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
      return { success: true, valid: false, error: 'Coupon usage limit reached' };
    }

    // Minimum purchase amount
    const minAmount = coupon.min_purchase_amount ? Number(coupon.min_purchase_amount) : null;
    if (minAmount !== null && cart_total < minAmount) {
      return {
        success: true,
        valid: false,
        error: `Minimum purchase amount is €${minAmount.toFixed(2)}`,
      };
    }

    // Calculate discount
    let discountAmount = 0;
    const discountType = coupon.discount_type || 'percentage';
    const discountValue = Number(coupon.discount_value || 0);

    if (discountType === 'percentage') {
      discountAmount = (cart_total * discountValue) / 100;
      // Apply max discount cap if set
      if (coupon.max_discount_amount && discountAmount > Number(coupon.max_discount_amount)) {
        discountAmount = Number(coupon.max_discount_amount);
      }
    } else {
      // fixed_amount
      discountAmount = discountValue;
    }

    // Cap discount at cart total
    discountAmount = Math.min(discountAmount, cart_total);
    discountAmount = parseFloat(discountAmount.toFixed(2));

    const newTotal = parseFloat((cart_total - discountAmount).toFixed(2));

    return {
      success: true,
      valid: true,
      coupon: {
        code: coupon.code,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        new_total: newTotal,
        min_purchase_amount: minAmount,
        expires_at: coupon.valid_until || null,
      },
    };
  } catch (err) {
    console.error('[validate_coupon] Unexpected error:', err);
    return { success: false, valid: false, error: 'An unexpected error occurred' };
  }
}
