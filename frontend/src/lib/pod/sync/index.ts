/**
 * Barrel exports for the provider-agnostic sync engine.
 */

export type { SyncResult, SyncReport, SyncOptions } from './types'
export { inferCategorySlug, inferCategoryId } from './category-inferrer'
export { calculateEngagementPrice, auditMargins } from './margin-auditor'
export { shouldPreserveAdminEdits } from './conflict-resolver'
export { syncProductFromProvider } from './sync-product'
export { deleteProductCascade } from './delete-product'
