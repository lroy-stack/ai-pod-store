/**
 * Product mockup generator
 * Composes AI-generated designs onto product templates using Sharp (libvips)
 * Supports watermarking for anonymous users and Supabase Storage upload
 */

import sharp from 'sharp'
import path from 'path'
import { supabaseAdmin } from './supabase-admin'
import { PRINT_AREAS, TEMPLATE_COLORS } from './print-areas'
import { BRAND } from './store-config'

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
 * Generate a product mockup with design overlay using Sharp
 *
 * @param options.designUrl - URL of the AI-generated design image
 * @param options.productType - Product type for template selection
 * @param options.color - Template color variant (default: first available)
 * @param options.watermark - If true, output is 512px with "Store" watermark (anonymous users)
 */
export async function generateMockup(options: MockupOptions): Promise<MockupResult> {
  const { designUrl, productType, color, watermark = false } = options

  try {
    const area = PRINT_AREAS[productType] || PRINT_AREAS['tshirt']
    const availableColors = TEMPLATE_COLORS[productType] || ['white']
    const templateColor = color && availableColors.includes(color) ? color : availableColors[0]

    // Resolve template path
    const templatePath = path.join(
      process.cwd(), 'public', 'mockup-templates',
      `${productType}-${templateColor}.png`
    )

    // Fetch design image from URL
    let designBuffer: Buffer
    try {
      const response = await fetch(designUrl)
      if (!response.ok) {
        return { success: false, error: `Failed to fetch design image: ${response.status}` }
      }
      designBuffer = Buffer.from(await response.arrayBuffer())
    } catch (fetchError) {
      return { success: false, error: 'Failed to download design image' }
    }

    // Resize design to fit print area
    const resizedDesign = await sharp(designBuffer)
      .resize(area.w, area.h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()

    // Check if template file exists; if not, create a solid color background
    let baseImage: sharp.Sharp
    try {
      baseImage = sharp(templatePath)
      await baseImage.metadata() // Verify file is readable
      baseImage = sharp(templatePath) // Re-create since metadata() consumes the stream
    } catch {
      // Template not found — create a plain background as fallback
      const bgColor = templateColor === 'black'
        ? { r: 30, g: 30, b: 30 }
        : templateColor === 'natural'
          ? { r: 235, g: 225, b: 210 }
          : { r: 245, g: 245, b: 245 }

      baseImage = sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 3,
          background: bgColor,
        },
      }).png()
    }

    // Compose design onto template
    let composite = baseImage.composite([
      { input: resizedDesign, left: area.x, top: area.y, blend: 'over' },
    ])

    // Add watermark for anonymous users
    if (watermark) {
      const watermarkSvg = Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
        <text x="512" y="512" font-size="80" font-family="Arial, sans-serif"
              fill="rgba(255,255,255,0.35)" text-anchor="middle"
              dominant-baseline="middle"
              transform="rotate(-30 512 512)">${BRAND.name}</text>
        <text x="512" y="620" font-size="40" font-family="Arial, sans-serif"
              fill="rgba(255,255,255,0.25)" text-anchor="middle"
              dominant-baseline="middle"
              transform="rotate(-30 512 620)">PREVIEW</text>
      </svg>`)
      composite = composite.composite([{ input: watermarkSvg, blend: 'over' }])
    }

    const finalSize = watermark ? 512 : 1024
    const mockupBuffer = await composite
      .resize(finalSize, finalSize)
      .png()
      .toBuffer()

    // Upload to Supabase Storage
    const filename = `mockups/${crypto.randomUUID()}.png`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('mockups')
      .upload(filename, mockupBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('Mockup upload error:', uploadError)
      // Fallback: return as base64 data URL if storage upload fails
      const base64 = mockupBuffer.toString('base64')
      return {
        success: true,
        mockupUrl: `data:image/png;base64,${base64}`,
        placeholder: false,
        watermarked: watermark,
        resolution: finalSize,
      }
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('mockups')
      .getPublicUrl(filename)

    return {
      success: true,
      mockupUrl: publicUrl,
      placeholder: false,
      watermarked: watermark,
      resolution: finalSize,
    }
  } catch (error) {
    console.error('Mockup generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown mockup generation error',
    }
  }
}

/**
 * Generate mockup using POD provider's product images (if product already exists)
 */
export async function generatePrintifyMockup(options: {
  printifyProductId: string
}): Promise<MockupResult> {
  try {
    const { getProvider, initializeProviders } = await import('@/lib/pod')
    initializeProviders()
    const provider = getProvider()

    const product = await provider.getProduct(options.printifyProductId)
    const mockupUrl = product.images?.[0]?.src

    if (!mockupUrl) {
      return { success: false, error: 'No mockups available from provider' }
    }

    return { success: true, mockupUrl, placeholder: false }
  } catch (error) {
    console.error('POD provider mockup error:', error)
    return { success: false, error: 'Failed to fetch provider mockup' }
  }
}
