/**
 * Zod validation schemas for admin API routes
 * Re-exports all schemas from the central validation module
 * + additional schemas for blog, themes, designs, categories, orders
 */
export {
  productSchema,
  orderUpdateSchema,
  designModerationSchema,
  brandConfigSchema,
  settingsSchema,
  categorySchema,
  bulkOrderUpdateSchema,
  bulkProductUpdateSchema,
  withValidation,
} from '@/lib/validation';

export {
  blogPostSchema,
  themeSchema,
  themeUpdateSchema,
  designUpdateSchema,
  categoryUpdateSchema,
  orderStatusUpdateSchema,
} from '@/lib/schemas/extended';
