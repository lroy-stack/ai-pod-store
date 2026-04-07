/**
 * Conflict resolver — admin-edit-preservation logic.
 * Extracted from printify-sync.ts to be provider-agnostic.
 */

/**
 * Determine if a product's admin edits should be preserved during sync.
 * Returns true when admin_edited_at is more recent than last_synced_at,
 * meaning an admin has manually edited the product since the last provider sync.
 *
 * When true, the sync engine should preserve the existing title, description,
 * and tags rather than overwriting them with provider data.
 *
 * @param existingProduct - The existing product row from Supabase
 * @returns true if admin edits should take priority over provider data
 */
export function shouldPreserveAdminEdits(
  existingProduct: { admin_edited_at?: string | null; last_synced_at?: string | null },
): boolean {
  const hasAdminEdits = existingProduct.admin_edited_at != null
  if (!hasAdminEdits) return false

  const lastSyncAt = existingProduct.last_synced_at
    ? new Date(existingProduct.last_synced_at)
    : null
  const adminEditAt = existingProduct.admin_edited_at
    ? new Date(existingProduct.admin_edited_at)
    : null

  return !!(adminEditAt && lastSyncAt && adminEditAt > lastSyncAt)
}
