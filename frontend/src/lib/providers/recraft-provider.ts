/**
 * Recraft V3 provider.
 * Best for: SVG/vector (native), logos, clean illustrations.
 * URLs are stable (~24h), no immediate persistence needed.
 */

import type { ImageProvider, GenerationRequest, GenerationResponse, ProviderCapabilities } from './types'
import { persistEphemeralUrl } from './storage-upload'

export class RecraftProvider implements ImageProvider {
  readonly name = 'recraft' as const
  readonly capabilities: ProviderCapabilities = {
    maxWidth: 2048,
    maxHeight: 2048,
    supportsTransparentBg: false,
    supportsSvg: true,
    supportsImg2Img: false,
    textQuality: 3,
    photorealism: 4,
    maxBatchSize: 6,
  }

  isAvailable(): boolean {
    return !!process.env.RECRAFT_API_TOKEN
  }

  estimateCost(req: GenerationRequest): number {
    const n = req.numImages || 1
    const isSvg = req.format === 'svg'
    return (isSvg ? 0.08 : 0.04) * n
  }

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    const startMs = Date.now()
    const apiToken = process.env.RECRAFT_API_TOKEN

    if (!apiToken) {
      return {
        success: false,
        images: [],
        provider: this.name,
        costUsd: 0,
        latencyMs: 0,
        error: 'RECRAFT_API_TOKEN not configured',
      }
    }

    try {
      const style = mapRecraftStyle(req.style, req.format)
      const body: Record<string, unknown> = {
        model: 'recraftv3',
        prompt: req.prompt,
        n: req.numImages || 1,
        style,
        response_format: 'url',
      }

      if (req.negativePrompt) {
        body.negative_prompt = req.negativePrompt
      }

      // Recraft expects size as "WIDTHxHEIGHT"
      const width = req.width || 1024
      const height = req.height || 1024
      body.size = `${width}x${height}`

      const response = await fetch('https://external.api.recraft.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error('Recraft error:', errText)
        return {
          success: false,
          images: [],
          provider: this.name,
          costUsd: 0,
          latencyMs: Date.now() - startMs,
          error: `Recraft provider failed: ${response.status}`,
        }
      }

      const data = await response.json()
      const items: Array<{ url: string }> = data.data || []

      if (items.length === 0) {
        return {
          success: false,
          images: [],
          provider: this.name,
          costUsd: 0,
          latencyMs: Date.now() - startMs,
          error: 'No images in Recraft response',
        }
      }

      const isSvg = style === 'vector_illustration'
      const format = isSvg ? 'svg' : 'png'

      // Persist Recraft URLs (~24h expiry) to Supabase Storage
      const images = await Promise.all(
        items.map(async (item) => {
          let url: string
          try {
            url = await persistEphemeralUrl(item.url, { prefix: 'recraft', format })
          } catch (err) {
            console.warn('Recraft URL persistence failed, using original URL:', err)
            url = item.url
          }
          return {
            url,
            width: req.width || 1024,
            height: req.height || 1024,
            format: format as 'svg' | 'png',
            hasTransparentBg: false,
          }
        })
      )

      return {
        success: true,
        images,
        provider: this.name,
        costUsd: this.estimateCost(req),
        latencyMs: Date.now() - startMs,
      }
    } catch (error) {
      console.error('Recraft error:', error)
      return {
        success: false,
        images: [],
        provider: this.name,
        costUsd: 0,
        latencyMs: Date.now() - startMs,
        error: 'Recraft provider error',
      }
    }
  }
}

function mapRecraftStyle(style?: string, format?: string): string {
  if (format === 'svg') return 'vector_illustration'
  if (!style) return 'digital_illustration'

  const lower = style.toLowerCase()
  if (lower.includes('vector') || lower.includes('svg') || lower.includes('icon') || lower.includes('flat')) {
    return 'vector_illustration'
  }
  if (lower.includes('realistic') || lower.includes('photo')) {
    return 'realistic_image'
  }
  if (lower.includes('logo')) {
    return 'logo_raster'
  }
  return 'digital_illustration'
}
