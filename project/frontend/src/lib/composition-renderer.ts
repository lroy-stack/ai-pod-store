/**
 * Design Composition Renderer
 *
 * Renders multi-layer design compositions using Sharp for image compositing
 * and node-canvas for text rendering. Supports preview (1024x1024) and
 * production-resolution output (per PRODUCTION_DIMENSIONS).
 */

import sharp from 'sharp'
import { createCanvas, registerFont } from 'canvas'
import path from 'path'
import fs from 'fs'
import { PRINT_AREAS, PRODUCTION_DIMENSIONS, PrintArea } from '@/lib/print-areas'
import { FONT_FILES } from '@/lib/font-config'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ── Font registration ────────────────────────────────────────────────

let fontsRegistered = false

function ensureFontsRegistered(): void {
  if (fontsRegistered) return
  Object.entries(FONT_FILES).forEach(([fontName, fileName]) => {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName)
    if (fs.existsSync(fontPath)) {
      try {
        registerFont(fontPath, { family: fontName })
      } catch {
        // Font may already be registered
      }
    }
  })
  fontsRegistered = true
}

// ── Layer types ──────────────────────────────────────────────────────

export interface CompositionLayer {
  type: 'text' | 'image' | 'ai'
  url?: string
  text?: string
  font?: string
  color?: string
  fontSize?: string // 'small' | 'medium' | 'large' or pixel value
  position?: string // 'top' | 'center' | 'bottom'
  textAlign?: string // 'left' | 'center' | 'right'
}

// ── Position mapping ─────────────────────────────────────────────────

const POSITION_Y_RATIO: Record<string, number> = {
  top: 0.15,
  center: 0.5,
  bottom: 0.85,
}

// ── Font size parsing ────────────────────────────────────────────────

function parseFontSize(fontSize: string | undefined, baseHeight: number): number {
  if (!fontSize) return Math.round(baseHeight * 0.08) // default: 8% of height
  if (fontSize === 'small') return Math.round(baseHeight * 0.05)
  if (fontSize === 'medium') return Math.round(baseHeight * 0.08)
  if (fontSize === 'large') return Math.round(baseHeight * 0.12)
  // Try parsing as numeric pixel value
  const parsed = parseInt(fontSize, 10)
  if (!isNaN(parsed) && parsed > 0) return parsed
  return Math.round(baseHeight * 0.08)
}

// ── Text rendering via canvas ────────────────────────────────────────

function renderTextToBuffer(
  text: string,
  font: string,
  fontSize: number,
  color: string,
  width: number,
  height: number,
  textAlign: CanvasTextAlign = 'center',
  positionY: number = 0.5
): Buffer {
  ensureFontsRegistered()

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Transparent background
  ctx.clearRect(0, 0, width, height)

  // Resolve font family
  const selectedFont = FONT_FILES[font] ? font : 'Inter'
  ctx.font = `${fontSize}px "${selectedFont}"`
  ctx.fillStyle = color || '#000000'
  ctx.textAlign = textAlign
  ctx.textBaseline = 'middle'

  // Calculate x position based on alignment
  let x: number
  switch (textAlign) {
    case 'left':
      x = Math.round(width * 0.05) // 5% margin
      break
    case 'right':
      x = Math.round(width * 0.95)
      break
    default:
      x = Math.round(width / 2)
  }

  // Multi-line text rendering
  const lineHeight = fontSize * 1.3
  const textLines = text.split('\n')
  const totalTextHeight = textLines.length * lineHeight
  const startY = Math.round(height * positionY - totalTextHeight / 2 + lineHeight / 2)

  textLines.forEach((line, index) => {
    const y = startY + index * lineHeight
    ctx.fillText(line, x, y)
  })

  return canvas.toBuffer('image/png')
}

// ── Preview rendering ────────────────────────────────────────────────

/**
 * Render a multi-layer design composition as a 1024x1024 preview PNG.
 *
 * @param layers - Array of composition layers (text, image, ai)
 * @param productType - Product type key (tshirt, hoodie, mug, etc.)
 * @returns PNG buffer of the composed preview
 */
export async function renderCompositionPreview(
  layers: CompositionLayer[],
  productType: string
): Promise<Buffer> {
  const CANVAS_SIZE = 1024
  const area: PrintArea = PRINT_AREAS[productType] || PRINT_AREAS['tshirt']

  // Start with a transparent 1024x1024 canvas
  let composite = sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png()

  const compositeInputs: sharp.OverlayOptions[] = []

  for (const layer of layers) {
    try {
      if (layer.type === 'image' || layer.type === 'ai') {
        if (!layer.url) continue

        // Fetch the image
        const response = await fetch(layer.url)
        if (!response.ok) {
          console.error(`Failed to fetch layer image: ${response.status} ${layer.url}`)
          continue
        }
        const imageBuffer = Buffer.from(await response.arrayBuffer())

        // Resize to fit print area
        const resized = await sharp(imageBuffer)
          .resize(area.w, area.h, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer()

        compositeInputs.push({
          input: resized,
          left: area.x,
          top: area.y,
          blend: 'over',
        })
      } else if (layer.type === 'text') {
        if (!layer.text) continue

        const fontSize = parseFontSize(layer.fontSize, area.h)
        const positionY = POSITION_Y_RATIO[layer.position || 'center'] ?? 0.5
        const textAlign = (layer.textAlign as CanvasTextAlign) || 'center'

        const textBuffer = renderTextToBuffer(
          layer.text,
          layer.font || 'Inter',
          fontSize,
          layer.color || '#000000',
          area.w,
          area.h,
          textAlign,
          positionY
        )

        compositeInputs.push({
          input: textBuffer,
          left: area.x,
          top: area.y,
          blend: 'over',
        })
      }
    } catch (layerError) {
      console.error('Error processing composition layer:', layerError)
      // Continue with remaining layers
    }
  }

  if (compositeInputs.length > 0) {
    composite = composite.composite(compositeInputs)
  }

  return composite.png().toBuffer()
}

// ── Production export ────────────────────────────────────────────────

/**
 * Export a composition at production resolution for Printify fulfillment.
 *
 * Loads the composition from the database, renders at full production
 * dimensions, uploads to Supabase Storage, and updates the DB record.
 *
 * @param compositionId - UUID of the design_compositions row
 * @returns Public URL of the production-quality image
 */
export async function exportForProduction(compositionId: string): Promise<string> {
  // Load composition from DB
  const { data: composition, error } = await supabaseAdmin
    .from('design_compositions')
    .select('*')
    .eq('id', compositionId)
    .single()

  if (error || !composition) {
    throw new Error(`Composition not found: ${compositionId}`)
  }

  // If already exported, return existing URL
  if (composition.production_url) {
    return composition.production_url
  }

  const productType = composition.product_type || 'tshirt'
  // Schema v2: Fabric.js JSON — client exports production PNG directly
  if (composition.schema_version === 2) {
    // For Fabric.js compositions, the client exports the final PNG.
    // Production export is handled client-side via canvas.toDataURL() with multiplier.
    // If a production_url is already set (from client export), return it.
    if (composition.production_url) {
      return composition.production_url
    }
    // If no production_url yet, use the preview as fallback
    if (composition.preview_url) {
      return composition.preview_url
    }
    throw new Error(`Fabric.js composition ${compositionId} has no production or preview URL`)
  }

  const layers: CompositionLayer[] = composition.layers || []
  const prodDims = PRODUCTION_DIMENSIONS[productType] || PRODUCTION_DIMENSIONS['tshirt']
  const previewArea = PRINT_AREAS[productType] || PRINT_AREAS['tshirt']

  // Calculate scale factor from preview (1024) to production dimensions
  const scaleX = prodDims.w / previewArea.w
  const scaleY = prodDims.h / previewArea.h

  // Production canvas is just the print area at production resolution
  const prodWidth = prodDims.w
  const prodHeight = prodDims.h

  let composite = sharp({
    create: {
      width: prodWidth,
      height: prodHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png()

  const compositeInputs: sharp.OverlayOptions[] = []

  for (const layer of layers) {
    try {
      if (layer.type === 'image' || layer.type === 'ai') {
        if (!layer.url) continue

        const response = await fetch(layer.url)
        if (!response.ok) continue
        const imageBuffer = Buffer.from(await response.arrayBuffer())

        // Resize to fill production dimensions
        const resized = await sharp(imageBuffer)
          .resize(prodWidth, prodHeight, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer()

        compositeInputs.push({
          input: resized,
          left: 0,
          top: 0,
          blend: 'over',
        })
      } else if (layer.type === 'text') {
        if (!layer.text) continue

        // Scale font size to production resolution
        const previewFontSize = parseFontSize(layer.fontSize, previewArea.h)
        const prodFontSize = Math.round(previewFontSize * scaleY)
        const positionY = POSITION_Y_RATIO[layer.position || 'center'] ?? 0.5
        const textAlign = (layer.textAlign as CanvasTextAlign) || 'center'

        const textBuffer = renderTextToBuffer(
          layer.text,
          layer.font || 'Inter',
          prodFontSize,
          layer.color || '#000000',
          prodWidth,
          prodHeight,
          textAlign,
          positionY
        )

        compositeInputs.push({
          input: textBuffer,
          left: 0,
          top: 0,
          blend: 'over',
        })
      }
    } catch (layerError) {
      console.error('Error processing production layer:', layerError)
    }
  }

  if (compositeInputs.length > 0) {
    composite = composite.composite(compositeInputs)
  }

  const productionBuffer = await composite.png().toBuffer()

  // Upload to Supabase Storage bucket 'designs'
  const filename = `compositions/${compositionId}/production.png`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('designs')
    .upload(filename, productionBuffer, {
      contentType: 'image/png',
      cacheControl: '31536000',
      upsert: true,
    })

  if (uploadError) {
    console.error('Production upload error:', uploadError)
    // Fallback: return as base64 data URL
    const base64 = productionBuffer.toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`
    return dataUrl
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('designs')
    .getPublicUrl(filename)

  // Update composition record with production URL
  await supabaseAdmin
    .from('design_compositions')
    .update({
      production_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', compositionId)

  return publicUrl
}
