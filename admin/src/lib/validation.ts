import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';

/**
 * Validation wrapper for admin API routes
 * Validates request body against a Zod schema before passing to handler
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: (req: NextRequest, validatedData: T, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const body = await req.json();
      const validatedData = schema.parse(body);
      return handler(req, validatedData, ...args);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.issues.map((err: z.ZodIssue) => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      // Re-throw non-validation errors
      throw error;
    }
  };
}

/**
 * Product creation/update schema
 */
/** GPSR compliance schema — EU Regulation 2023/988 */
export const gpsrSchema = z.object({
  brand: z.string().min(1).default(process.env.NEXT_PUBLIC_SITE_NAME || 'My Store'),
  manufacturer: z.string().min(1).default(process.env.STORE_COMPANY_NAME || 'Your Company Name'),
  manufacturer_address: z.string().optional(),
  manufacturing_country: z.string().length(2, 'Must be 2-letter country code').default('LV'),
  safety_information: z.string().default('Conforms to EU Regulation 2023/988 (GPSR)'),
  material: z.string().min(1, 'Material is required for GPSR compliance'),
  care_instructions: z.string().min(1, 'Care instructions required for GPSR compliance'),
  print_technique: z.enum(['dtg', 'embroidery', 'sublimation', 'dtfilm', 'uv']).default('dtg'),
})

export const productSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  name: z.string().min(1, 'Name is required').max(200, 'Name too long').optional(),
  description: z.string().max(5000, 'Description too long').optional(),
  base_price_cents: z.number().int().min(1, 'Price must be greater than 0'),
  currency: z.enum(['EUR', 'USD', 'GBP', 'eur', 'usd', 'gbp']),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  stock: z.number().int().min(0).optional(),
  design_id: z.string().uuid().optional(),
  image_url: z.string().url().optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
  product_details: gpsrSchema.optional(),
  seo_title: z.string().max(60, 'SEO title max 60 chars').optional(),
  seo_description: z.string().max(160, 'SEO description max 160 chars').optional(),
}).refine(
  (data) => data.title || data.name,
  { message: 'Either title or name is required' }
);

/**
 * Order update schema
 */
export const orderUpdateSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  tracking_number: z.string().max(100).optional(),
  tracking_url: z.string().url().optional(),
  carrier: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Design moderation schema
 */
export const designModerationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(1000).optional(),
});

/**
 * Brand config update schema
 */
export const brandConfigSchema = z.object({
  personalization_surcharge_amount: z.number().min(0).max(1000).nullable().optional(),
  brand_name: z.string().min(1).max(100).optional(),
  brand_tagline: z.string().max(200).optional(),
  copyright_text: z.string().max(200).optional(),
  support_email: z.string().email().optional(),
  logo_light_url: z.string().url().optional(),
  logo_dark_url: z.string().url().optional(),
  brand_color_primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  brand_color_secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  brand_font: z.string().max(100).optional(),
  packaging_insert_enabled: z.boolean().optional(),
  packaging_insert_text: z.string().max(500).optional(),
  gift_messages_enabled: z.boolean().optional(),
});

/**
 * Settings update schema
 */
export const settingsSchema = z.object({
  store_name: z.string().min(1).max(100).optional(),
  store_email: z.string().email().optional(),
  support_email: z.string().email().optional(),
  currency: z.enum(['EUR', 'USD', 'GBP']).optional(),
  timezone: z.string().max(50).optional(),
  tax_rate: z.number().min(0).max(1).optional(),
  shipping_fee_cents: z.number().int().min(0).optional(),
  free_shipping_threshold_cents: z.number().int().min(0).optional(),
});

/**
 * Category create/update schema
 */
export const categorySchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name_en: z.string().min(1).max(100),
  name_es: z.string().min(1).max(100),
  name_de: z.string().min(1).max(100),
  description_en: z.string().max(500).optional(),
  description_es: z.string().max(500).optional(),
  description_de: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

/**
 * Bulk order update schema
 */
export const bulkOrderUpdateSchema = z.object({
  order_ids: z.array(z.string().uuid()).min(1, 'At least one order ID required'),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  action: z.enum(['retry', 'cancel', 'archive']).optional(),
}).refine(
  (data) => data.status || data.action,
  { message: 'Either status or action is required' }
);

/**
 * Bulk product update schema
 */
export const bulkProductUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one product ID required'),
  status: z.enum(['active', 'draft', 'archived']),
});
