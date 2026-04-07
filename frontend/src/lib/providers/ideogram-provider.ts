/**
 * Ideogram V3 provider.
 * Best for: text rendering (5/5), typography, logos with text.
 * URLs are ephemeral — requires persistence to Supabase Storage.
 */

import type { ImageProvider, GenerationRequest, GenerationResponse, ProviderCapabilities } from './types'
import { persistEphemeralUrl } from './storage-upload'

export class IdeogramProvider implements ImageProvider {
  readonly name = 'ideogram' as const
  readonly capabilities: ProviderCapabilities = {
    maxWidth: 2048,
    maxHeight: 2048,
    supportsTransparentBg: false,
    supportsSvg: false,
    supportsImg2Img: false,
    textQuality: 5,
    photorealism: 3,
    maxBatchSize: 4,
  }

  isAvailable(): boolean {
    return !!process.env.IDEOGRAM_API_KEY
  }

  estimateCost(req: GenerationRequest): number {
    const n = req.numImages || 1
    return 0.04 * n // TURBO speed default
  }

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    const startMs = Date.now()
    const apiKey = process.env.IDEOGRAM_API_KEY

    if (!apiKey) {
      return {
        success: false,
        images: [],
        provider: this.name,
        costUsd: 0,
        latencyMs: 0,
        error: 'IDEOGRAM_API_KEY not configured',
      }
    }

    try {
      const body: Record<string, unknown> = {
        prompt: req.prompt,
        rendering_speed: 'TURBO',
        magic_prompt: 'AUTO',
        aspect_ratio: resolveAspectRatio(req.width, req.height),
        num_images: req.numImages || 1,
      }

      if (req.negativePrompt) {
        body.negative_prompt = req.negativePrompt
      }

      // Map style to Ideogram's style_type
      if (req.style) {
        body.style_type = mapStyleType(req.style)
      }

      const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error('Ideogram error:', errText)
        return {
          success: false,
          images: [],
          provider: this.name,
          costUsd: 0,
          latencyMs: Date.now() - startMs,
          error: `Ideogram provider failed: ${response.status}`,
        }
      }

      const data = await response.json()
      const items: Array<{ url: string; is_image_safe: boolean }> = data.data || []

      // Check NSFW
      const unsafeItem = items.find((item) => item.is_image_safe === false)
      if (unsafeItem) {
        return {
          success: false,
          images: [],
          provider: this.name,
          costUsd: this.estimateCost(req),
          latencyMs: Date.now() - startMs,
          error: 'Design rejected by safety checker. Please modify your prompt.',
          nsfw: true,
        }
      }

      if (items.length === 0) {
        return {
          success: false,
          images: [],
          provider: this.name,
          costUsd: 0,
          latencyMs: Date.now() - startMs,
          error: 'No images in Ideogram response',
        }
      }

      // Persist ephemeral URLs to Supabase Storage
      const images = await Promise.all(
        items.map(async (item) => {
          let url: string
          try {
            url = await persistEphemeralUrl(item.url, { prefix: 'ideogram' })
          } catch (err) {
            console.warn('Ideogram URL persistence failed, using ephemeral URL:', err)
            url = item.url
          }
          return {
            url,
            width: req.width || 1024,
            height: req.height || 1024,
            format: 'png' as const,
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
      console.error('Ideogram error:', error)
      return {
        success: false,
        images: [],
        provider: this.name,
        costUsd: 0,
        latencyMs: Date.now() - startMs,
        error: 'Ideogram provider error',
      }
    }
  }
}

function resolveAspectRatio(width?: number, height?: number): string {
  if (!width || !height) return '1x1'
  if (width === height) return '1x1'
  if (width > height) return '16x9'
  return '9x16'
}

function mapStyleType(style: string): string {
  const lower = style.toLowerCase()
  if (lower.includes('realistic') || lower.includes('photo')) return 'REALISTIC'
  if (lower.includes('design') || lower.includes('graphic')) return 'DESIGN'
  if (lower.includes('fiction') || lower.includes('fantasy') || lower.includes('anime')) return 'FICTION'
  return 'AUTO'
}
