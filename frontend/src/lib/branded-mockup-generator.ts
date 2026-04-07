/**
 * Branded mockup generator — composites Printify mockups onto branded backgrounds.
 *
 * Pipeline: fetch mockup → remove white bg → composite on branded SVG → output
 *
 * Background removal strategies (in priority order):
 * 1. rembg sidecar (HTTP POST to rembg:8080) — best quality, AI-based
 * 2. Sharp threshold — for white-background mockups, converts near-white to transparent
 *
 * Used by: scripts/generate-branded-mockups.mjs (batch) and gallery preview
 */

import sharp from 'sharp'
import { getBackgroundForCategory, type MockupBackground } from './mockup-backgrounds'

// ── Types ───────────────────────────────────────────────────────────────────

export interface BrandedMockupInput {
  /** Product ID (for naming output files) */
  productId: string
  /** First mockup URL from Printify (white background) */
  mockupUrl: string
  /** Category slug to select background template */
  categorySlug: string
}

export interface BrandedMockupResult {
  success: boolean
  /** Local file path (for gallery mode) or public URL (for upload mode) */
  outputPath?: string
  /** The background template used */
  backgroundId?: string
  error?: string
}

export interface GeneratorOptions {
  /** Output width (default: 1200) */
  width?: number
  /** Output height (default: 1200) */
  height?: number
  /** Output format */
  format?: 'webp' | 'png'
  /** Quality for WebP (default: 85) */
  quality?: number
  /** rembg sidecar URL (default: http://localhost:8080) */
  rembgUrl?: string
  /** Skip rembg, use Sharp threshold removal */
  forceThreshold?: boolean
}

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 1200
const DEFAULT_QUALITY = 85

// White threshold for Sharp-based background removal
// Pixels with R, G, B all > this value become transparent
const WHITE_THRESHOLD = 235

// ── Background Removal ──────────────────────────────────────────────────────

/**
 * Remove background using rembg HTTP sidecar.
 * Returns null if rembg is unavailable.
 */
async function removeBackgroundRembg(
  imageBuffer: Buffer,
  rembgUrl: string
): Promise<Buffer | null> {
  try {
    const response = await fetch(`${rembgUrl}/api/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(imageBuffer),
      signal: AbortSignal.timeout(30000), // 30s timeout
    })

    if (!response.ok) {
      console.warn(`rembg returned ${response.status}`)
      return null
    }

    return Buffer.from(await response.arrayBuffer())
  } catch (err) {
    // rembg not available — silently fall back
    return null
  }
}

/**
 * Remove white background using Sharp threshold.
 * Converts near-white pixels (R,G,B > threshold) to transparent.
 * Works well for Printify mockups with clean white backgrounds.
 */
async function removeBackgroundThreshold(
  imageBuffer: Buffer,
  threshold: number = WHITE_THRESHOLD
): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const channels = info.channels // should be 4 (RGBA)

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]

    // If pixel is near-white, make transparent
    if (r > threshold && g > threshold && b > threshold) {
      pixels[i + 3] = 0 // set alpha to 0
    }
    // Smooth transition for near-white pixels (anti-aliasing)
    else if (r > threshold - 20 && g > threshold - 20 && b > threshold - 20) {
      const avg = (r + g + b) / 3
      const factor = Math.max(0, (avg - (threshold - 20)) / 20)
      pixels[i + 3] = Math.round(255 * (1 - factor))
    }
  }

  return sharp(Buffer.from(pixels.buffer), {
    raw: { width: info.width, height: info.height, channels: info.channels as 4 },
  })
    .png()
    .toBuffer()
}

// ── Composition ─────────────────────────────────────────────────────────────

/**
 * Generate a single branded mockup.
 *
 * 1. Fetch mockup image from URL
 * 2. Remove white background (rembg or threshold)
 * 3. Render branded SVG background
 * 4. Composite product onto background
 * 5. Return as buffer
 */
export async function generateBrandedMockup(
  input: BrandedMockupInput,
  options: GeneratorOptions = {}
): Promise<{ buffer: Buffer; backgroundId: string } | { error: string }> {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    format = 'webp',
    quality = DEFAULT_QUALITY,
    rembgUrl = 'http://localhost:8080',
    forceThreshold = false,
  } = options

  try {
    // 1. Fetch mockup from Printify CDN
    const response = await fetch(input.mockupUrl, {
      headers: { 'User-Agent': 'POD-AI-Store/1.0' },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return { error: `Failed to fetch mockup: HTTP ${response.status}` }
    }

    const mockupBuffer = Buffer.from(await response.arrayBuffer())

    // 2. Remove background
    let transparentProduct: Buffer

    if (!forceThreshold) {
      // Try rembg first
      const rembgResult = await removeBackgroundRembg(mockupBuffer, rembgUrl)
      if (rembgResult) {
        transparentProduct = rembgResult
      } else {
        // Fallback to threshold
        console.log(`  rembg unavailable, using threshold removal for ${input.productId}`)
        transparentProduct = await removeBackgroundThreshold(mockupBuffer)
      }
    } else {
      transparentProduct = await removeBackgroundThreshold(mockupBuffer)
    }

    // 3. Get background template
    const background = getBackgroundForCategory(input.categorySlug)
    const zone = background.productZone

    // 4. Render background SVG to PNG
    const bgBuffer = await sharp(Buffer.from(background.svg))
      .resize(width, height)
      .png()
      .toBuffer()

    // 5. Resize product to fit zone (maintain aspect ratio, fit inside)
    const productResized = await sharp(transparentProduct)
      .resize(zone.w, zone.h, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()

    // Get actual dimensions after resize to center in zone
    const productMeta = await sharp(productResized).metadata()
    const productW = productMeta.width || zone.w
    const productH = productMeta.height || zone.h

    // Center product within the zone
    const offsetX = zone.x + Math.round((zone.w - productW) / 2)
    const offsetY = zone.y + Math.round((zone.h - productH) / 2)

    // 6. Composite: background + product
    let composite = sharp(bgBuffer).composite([
      {
        input: productResized,
        left: offsetX,
        top: offsetY,
        blend: 'over',
      },
    ])

    // 7. Output in requested format
    let outputBuffer: Buffer
    if (format === 'webp') {
      outputBuffer = await composite.webp({ quality }).toBuffer()
    } else {
      outputBuffer = await composite.png({ quality: Math.min(quality, 100) }).toBuffer()
    }

    return { buffer: outputBuffer, backgroundId: background.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: `Mockup generation failed: ${message}` }
  }
}

/**
 * Generate branded mockup and save to a local file path.
 * Used by the gallery preview mode.
 */
export async function generateAndSaveLocal(
  input: BrandedMockupInput,
  outputDir: string,
  options: GeneratorOptions = {}
): Promise<BrandedMockupResult> {
  const fs = await import('fs')
  const path = await import('path')
  const format = options.format || 'webp'

  const result = await generateBrandedMockup(input, options)

  if ('error' in result) {
    return { success: false, error: result.error }
  }

  const filename = `${input.productId}.${format}`
  const outputPath = path.join(outputDir, filename)

  // Ensure directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, result.buffer)

  return {
    success: true,
    outputPath,
    backgroundId: result.backgroundId,
  }
}
