/**
 * Provider-agnostic product cascade deletion.
 *
 * Soft-deletes a product from Supabase by its provider product ID.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Child tables with product_id FK — designs are EXCLUDED (preserved in bucket) */
const CHILD_TABLES = [
  'product_variants',
  'marketing_content',
  'wishlist_items',
  'cart_items',
]

/**
 * Soft delete a product from Supabase by its provider product ID.
 * Sets deleted_at timestamp instead of hard DELETE.
 * Cascades to child tables but PRESERVES designs (only unlinks them).
 *
 * @param providerProductId - The provider's external product ID
 * @param supabase - Admin Supabase client (bypasses RLS)
 * @param deletedBy - Actor ID for audit log (admin user ID or 'system')
 * @returns Whether the deletion succeeded and any error message
 */
export async function deleteProductCascade(
  providerProductId: string,
  supabase: SupabaseClient,
  deletedBy?: string,
): Promise<{ deleted: boolean; error?: string }> {
  // Find the product UUID by provider_product_id
  let productId: string | null = null

  const { data: byProvider } = await supabase
    .from('products')
    .select('id')
    .eq('provider_product_id', providerProductId)
    .is('deleted_at', null)

  if (byProvider?.length) {
    productId = byProvider[0].id
  }

  if (!productId) {
    console.warn('pod-sync: product not found for delete', providerProductId)
    return { deleted: false, error: 'Product not found' }
  }

  // Unlink designs (preserve them — they cost money)
  await supabase
    .from('designs')
    .update({ product_id: null })
    .eq('product_id', productId)

  // Delete child table rows
  for (const table of CHILD_TABLES) {
    await supabase.from(table).delete().eq('product_id', productId)
  }

  // Soft delete the product itself
  const { error: deleteError } = await supabase
    .from('products')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy || null,
    })
    .eq('id', productId)

  if (deleteError) {
    console.error('pod-sync: soft delete failed', providerProductId, deleteError.message)
    return { deleted: false, error: deleteError.message }
  }

  // Log deletion to audit_log
  await supabase
    .from('audit_log')
    .insert({
      actor_type: deletedBy ? 'admin' : 'system',
      actor_id: deletedBy || 'system',
      action: 'soft_delete',
      resource_type: 'product',
      resource_id: productId,
      metadata: {
        provider_product_id: providerProductId,
        reason: 'Product soft deleted',
      },
    })
    .select()

  console.log('pod-sync: soft deleted product', providerProductId)
  return { deleted: true }
}
