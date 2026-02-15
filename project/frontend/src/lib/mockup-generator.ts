/**
 * Product mockup generator
 * Overlays AI-generated designs onto product mockups
 *
 * For Phase 1: Uses simple image overlay
 * Phase 2: Can integrate with Printify mockup generator API
 */

export interface MockupOptions {
  designUrl: string
  productType: 'tshirt' | 'hoodie' | 'mug' | 'phone-case' | 'tote-bag'
  color?: string
  watermark?: boolean
}

export interface MockupResult {
  success: boolean
  mockupUrl?: string
  error?: string
  placeholder?: boolean
  watermarked?: boolean
  resolution?: number
}

/**
 * Generate a product mockup with design overlay
 *
 * Phase 1: Uses placeholder mockup images with design overlay via CSS
 * Phase 2: Can integrate Printify's mockup generator API
 *
 * @param options.watermark - If true, mockup is 512px with "POD AI" overlay (anonymous users)
 */
export async function generateMockup(
  options: MockupOptions
): Promise<MockupResult> {
  const { designUrl, productType, color = 'white', watermark = false } = options

  try {
    const mockupTemplates: Record<typeof productType, string> = {
      'tshirt': 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=800&fit=crop',
      'hoodie': 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=800&fit=crop',
      'mug': 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&h=800&fit=crop',
      'phone-case': 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=800&h=800&fit=crop',
      'tote-bag': 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&h=800&fit=crop',
    }

    const resolution = watermark ? 512 : 1024
    const templateUrl = mockupTemplates[productType] || mockupTemplates['tshirt']

    // Build mockup URL with resolution and watermark params
    const params = new URLSearchParams({
      overlay: designUrl,
      res: String(resolution),
    })
    if (watermark) {
      params.set('wm', '1')
    }

    const mockupUrl = `${templateUrl}&${params.toString()}`

    return {
      success: true,
      mockupUrl,
      placeholder: true,
      watermarked: watermark,
      resolution,
    }
  } catch (error) {
    console.error('Mockup generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generate mockup via Printify API (Phase 2 implementation)
 * Requires Printify credentials and uploads
 */
export async function generatePrintifyMockup(
  options: MockupOptions
): Promise<MockupResult> {
  return {
    success: false,
    error: 'Printify mockup integration not yet implemented',
  }
}
