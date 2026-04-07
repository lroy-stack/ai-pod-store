/**
 * Design models — upload inputs, results, and mockup generation.
 */

export interface DesignUploadInput {
  /** Public URL of the design file (preferred for Printful) */
  url?: string
  /** Base64-encoded file content (Printify supports this) */
  base64?: string
  fileName: string
  mimeType?: string
}

export interface UploadedDesign {
  /** Provider's file/upload ID */
  id: string
  fileName: string
  previewUrl: string
}

export interface MockupInput {
  productExternalId: string
  variantIds?: string[]
  position?: string
}

export interface MockupResult {
  /** Task ID for async mockup generation (Printful) */
  taskId: string | null
  /** Map of variant ID to mockup URL */
  mockupsByVariant: Record<string, string>
  status: 'completed' | 'pending' | 'failed'
  error?: string
}
