import { z } from 'zod';

/**
 * Blog post creation/update schema
 */
export const blogPostSchema = z.object({
  slug: z.string().min(1, 'Slug is required').max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title_en: z.string().min(1, 'English title is required').max(300),
  title_es: z.string().min(1, 'Spanish title is required').max(300),
  title_de: z.string().min(1, 'German title is required').max(300),
  content_en: z.string().min(1, 'English content is required'),
  content_es: z.string().min(1, 'Spanish content is required'),
  content_de: z.string().min(1, 'German content is required'),
  excerpt_en: z.string().max(500).optional(),
  excerpt_es: z.string().max(500).optional(),
  excerpt_de: z.string().max(500).optional(),
  featured_image: z.string().url().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  published_at: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

/**
 * Theme creation schema
 */
export const themeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  category: z.enum(['light', 'dark', 'high_contrast', 'custom']).optional(),
  css_variables: z.record(z.string(), z.string()).optional(),
  css_variables_dark: z.record(z.string(), z.string()).optional(),
  fonts: z.object({
    heading: z.string().max(100).optional(),
    body: z.string().max(100).optional(),
    mono: z.string().max(100).optional(),
  }).optional(),
  border_radius: z.enum(['none', 'small', 'medium', 'large', 'full']).optional(),
  shadow_preset: z.enum(['none', 'small', 'medium', 'large', 'extra_large']).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

/**
 * Theme update schema (all fields optional)
 */
export const themeUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(['light', 'dark', 'high_contrast', 'custom']).optional(),
  css_variables: z.record(z.string(), z.string()).optional(),
  css_variables_dark: z.record(z.string(), z.string()).optional(),
  fonts: z.object({
    heading: z.string().max(100).optional(),
    body: z.string().max(100).optional(),
    mono: z.string().max(100).optional(),
  }).optional(),
  border_radius: z.enum(['none', 'small', 'medium', 'large', 'full']).optional(),
  shadow_preset: z.enum(['none', 'small', 'medium', 'large', 'extra_large']).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

/**
 * Design update schema
 */
export const designUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().optional(),
  thumbnail_url: z.string().url().optional().nullable(),
  file_url: z.string().url().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Category update schema (partial — all optional)
 */
export const categoryUpdateSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  name_en: z.string().min(1).max(100).optional(),
  name_es: z.string().min(1).max(100).optional(),
  name_de: z.string().min(1).max(100).optional(),
  description_en: z.string().max(500).optional(),
  description_es: z.string().max(500).optional(),
  description_de: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  parent_id: z.string().uuid().optional().nullable(),
  is_portal: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

/**
 * Order status update schema
 */
export const orderStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  tracking_number: z.string().max(100).optional().nullable(),
  tracking_url: z.string().url().optional().nullable(),
  carrier: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  estimated_delivery: z.string().datetime().optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);
