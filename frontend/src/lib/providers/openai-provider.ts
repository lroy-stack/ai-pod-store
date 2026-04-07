/**
 * OpenAI GPT Image 1 provider.
 * Best for: photorealism (5/5), native transparency.
 * Returns base64 only — requires upload to Supabase Storage.
 */

import type { ImageProvider, GenerationRequest, GenerationResponse, ProviderCapabilities } from './types'
import { uploadBase64ToStorage } from './storage-upload'

export class OpenAIProvider implements ImageProvider {
  readonly name = 'openai' as const
  readonly capabilities: ProviderCapabilities = {
    maxWidth: 1536,
    maxHeight: 1536,
    supportsTransparentBg: true,
    supportsSvg: false,
    supportsImg2Img: false,
    textQuality: 4,
    photorealism: 5,
    maxBatchSize: 10,
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY
  }

  estimateCost(req: GenerationRequest): number {
    const n = req.numImages || 1
    return 0.042 * n // medium quality default
  }

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    const startMs = Date.now()
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return {
        success: false,
        images: [],
        provider: this.name,
        costUsd: 0,
        latencyMs: 0,
        error: 'OPENAI_API_KEY not configured',
      }
    }

    try {
      const size = resolveSize(req.width, req.height)
      const body: Record<string, unknown> = {
        model: 'gpt-image-1',
        prompt: req.prompt,
        n: req.numImages || 1,
        size,
        quality: 'medium',
        output_format: 'png',
      }

      if (req.transparentBg) {
        body.background = 'transparent'
      }

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error('OpenAI image error:', errText)

        // NSFW / safety rejection
        if (response.status === 400 && errText.toLowerCase().includes('safety')) {
          return {
            success: false,
            images: [],
            provider: this.name,
            costUsd: 0,
            latencyMs: Date.now() - startMs,
            error: 'Design rejected by safety checker. Please modify your prompt.',
            nsfw: true,
          }
        }

        return {
          success: false,
          images: [],
          provider: this.name,
          costUsd: 0,
          latencyMs: Date.now() - startMs,
          error: `OpenAI provider failed: ${response.status}`,
        }
      }

      const data = await response.json()
      const items: Array<{ b64_json: string }> = data.data || []

      if (items.length === 0) {
        return {
          success: false,
          images: [],
          provider: this.name,
          costUsd: 0,
          latencyMs: Date.now() - startMs,
          error: 'No images in OpenAI response',
        }
      }

      // Upload base64 to Supabase Storage (fallback to data URL if upload fails)
      const images = await Promise.all(
        items.map(async (item) => {
          let url: string
          try {
            url = await uploadBase64ToStorage(item.b64_json, {
              prefix: 'openai',
              format: 'png',
            })
          } catch (err) {
            console.warn('OpenAI image upload failed, using data URL fallback:', err)
            url = `data:image/png;base64,${item.b64_json}`
          }
          return {
            url,
            width: parseSizeWidth(size),
            height: parseSizeHeight(size),
            format: 'png' as const,
            hasTransparentBg: !!req.transparentBg,
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
      console.error('OpenAI image error:', error)
      return {
        success: false,
        images: [],
        provider: this.name,
        costUsd: 0,
        latencyMs: Date.now() - startMs,
        error: 'OpenAI provider error',
      }
    }
  }
}

function resolveSize(width?: number, height?: number): string {
  if (!width && !height) return '1024x1024'
  if (width && height) {
    if (width > height) return '1536x1024'
    if (height > width) return '1024x1536'
  }
  return '1024x1024'
}

function parseSizeWidth(size: string): number {
  return parseInt(size.split('x')[0], 10)
}

function parseSizeHeight(size: string): number {
  return parseInt(size.split('x')[1], 10)
}
