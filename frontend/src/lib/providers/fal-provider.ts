/**
 * fal.ai unified image generation provider.
 *
 * Supports multiple model families via a single FAL_KEY:
 * - FLUX.1 (schnell, dev, pro) — general purpose
 * - FLUX.2 Pro — premium zero-config quality
 * - Ideogram V3 — best typography/text rendering
 * - Recraft V3 — best vector/SVG output
 * - GPT Image 1.5 — photorealism + native transparency
 *
 * Each model has a different API body format and response shape.
 * The generate() method adapts per model.
 */

import type { ImageProvider, GenerationRequest, GenerationResponse, ProviderCapabilities, ProviderName } from './types'
import { persistEphemeralUrl } from './storage-upload'

export type FalModel =
  | 'schnell'
  | 'dev'
  | 'flux-pro'
  | 'flux-2-pro'
  | 'ideogram-v3'
  | 'recraft-v3'
  | 'gpt-image'

interface FalModelConfig {
  endpoint: string
  providerName: ProviderName
  inferenceSteps?: number
  costUsd: number
  maxWidth: number
  maxHeight: number
  textQuality: 1 | 2 | 3 | 4 | 5
  photorealism: 1 | 2 | 3 | 4 | 5
  supportsTransparentBg: boolean
  supportsSvg: boolean
}

const MODEL_CONFIG: Record<FalModel, FalModelConfig> = {
  schnell: {
    endpoint: 'https://fal.run/fal-ai/flux/schnell',
    providerName: 'fal-schnell',
    inferenceSteps: 4,
    costUsd: 0.003,
    maxWidth: 1024,
    maxHeight: 1024,
    textQuality: 2,
    photorealism: 3,
    supportsTransparentBg: false,
    supportsSvg: false,
  },
  dev: {
    endpoint: 'https://fal.run/fal-ai/flux/dev',
    providerName: 'fal-dev',
    inferenceSteps: 28,
    costUsd: 0.025,
    maxWidth: 2048,
    maxHeight: 2048,
    textQuality: 3,
    photorealism: 4,
    supportsTransparentBg: false,
    supportsSvg: false,
  },
  'flux-pro': {
    endpoint: 'https://fal.run/fal-ai/flux-pro/v1.1',
    providerName: 'fal-flux-pro',
    inferenceSteps: 28,
    costUsd: 0.05,
    maxWidth: 2048,
    maxHeight: 2048,
    textQuality: 4,
    photorealism: 4,
    supportsTransparentBg: false,
    supportsSvg: false,
  },
  'flux-2-pro': {
    endpoint: 'https://fal.run/fal-ai/flux-2-pro',
    providerName: 'fal-flux-2-pro',
    costUsd: 0.03,
    maxWidth: 2048,
    maxHeight: 2048,
    textQuality: 4,
    photorealism: 5,
    supportsTransparentBg: false,
    supportsSvg: false,
  },
  'ideogram-v3': {
    endpoint: 'https://fal.run/fal-ai/ideogram/v3',
    providerName: 'fal-ideogram',
    costUsd: 0.03,
    maxWidth: 2048,
    maxHeight: 2048,
    textQuality: 5,
    photorealism: 3,
    supportsTransparentBg: false,
    supportsSvg: false,
  },
  'recraft-v3': {
    endpoint: 'https://fal.run/fal-ai/recraft-v3',
    providerName: 'fal-recraft',
    costUsd: 0.04,
    maxWidth: 2048,
    maxHeight: 2048,
    textQuality: 5,
    photorealism: 4,
    supportsTransparentBg: false,
    supportsSvg: true,
  },
  'gpt-image': {
    endpoint: 'https://fal.run/fal-ai/gpt-image-1.5',
    providerName: 'fal-gpt-image',
    costUsd: 0.034,
    maxWidth: 1536,
    maxHeight: 1536,
    textQuality: 4,
    photorealism: 5,
    supportsTransparentBg: true,
    supportsSvg: false,
  },
}

export class FalProvider implements ImageProvider {
  readonly name: ProviderName
  readonly capabilities: ProviderCapabilities
  private apiKey: string | undefined
  private model: FalModel

  constructor(model: FalModel = 'schnell') {
    this.model = model
    this.apiKey = process.env.FAL_KEY
    const config = MODEL_CONFIG[model]
    this.name = config.providerName

    this.capabilities = {
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
      supportsTransparentBg: config.supportsTransparentBg,
      supportsSvg: config.supportsSvg,
      supportsImg2Img: model === 'dev',
      textQuality: config.textQuality,
      photorealism: config.photorealism,
      maxBatchSize: 4,
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  estimateCost(req: GenerationRequest): number {
    const numImages = req.numImages || 1
    return MODEL_CONFIG[this.model].costUsd * numImages
  }

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    const startMs = Date.now()
    const config = MODEL_CONFIG[this.model]

    if (!this.apiKey) {
      return {
        success: false,
        images: [],
        provider: this.name,
        costUsd: 0,
        latencyMs: 0,
        error: 'FAL_KEY not configured',
      }
    }

    try {
      const body = this.buildRequestBody(req, config)

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`fal.ai ${this.model} error:`, errText)

        // NSFW / safety check
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
          error: `${this.model} provider failed: ${response.status}`,
        }
      }

      const data = await response.json()
      return this.parseResponse(data, req, startMs)
    } catch (error) {
      console.error(`fal.ai ${this.model} error:`, error)
      return {
        success: false,
        images: [],
        provider: this.name,
        costUsd: 0,
        latencyMs: Date.now() - startMs,
        error: `${this.model} provider error`,
      }
    }
  }

  /**
   * Build model-specific request body.
   * Each fal.ai model has different API parameters.
   */
  private buildRequestBody(req: GenerationRequest, config: FalModelConfig): Record<string, unknown> {
    switch (this.model) {
      case 'ideogram-v3':
        return {
          prompt: req.prompt,
          rendering_speed: 'TURBO',
          magic_prompt: 'AUTO',
          aspect_ratio: resolveAspectRatio(req.width, req.height),
          num_images: req.numImages || 1,
          ...(req.negativePrompt && { negative_prompt: req.negativePrompt }),
          ...(req.style && { style_type: mapIdeogramStyle(req.style) }),
        }

      case 'recraft-v3':
        return {
          prompt: req.prompt,
          style: mapRecraftStyle(req.style, req.format),
          n: req.numImages || 1,
          size: `${req.width || 1024}x${req.height || 1024}`,
          ...(req.negativePrompt && { negative_prompt: req.negativePrompt }),
        }

      case 'gpt-image':
        return {
          prompt: req.prompt,
          n: req.numImages || 1,
          size: resolveOpenAISize(req.width, req.height),
          quality: 'medium',
          output_format: 'png',
          ...(req.transparentBg && { background: 'transparent' }),
        }

      default: // FLUX models (schnell, dev, flux-pro, flux-2-pro)
        return {
          prompt: req.prompt,
          image_size: resolveImageSize(req.width, req.height),
          ...(config.inferenceSteps && { num_inference_steps: config.inferenceSteps }),
          num_images: req.numImages || 1,
          enable_safety_checker: true,
          ...(req.negativePrompt && { negative_prompt: req.negativePrompt }),
          ...(req.seed !== undefined && { seed: req.seed }),
          ...(req.referenceImage && this.capabilities.supportsImg2Img && {
            image_url: req.referenceImage,
            strength: req.strength ?? 0.65,
          }),
        }
    }
  }

  /**
   * Parse model-specific response into unified GenerationResponse.
   */
  private async parseResponse(
    data: any,
    req: GenerationRequest,
    startMs: number
  ): Promise<GenerationResponse> {
    // NSFW check (FLUX models)
    if (data.has_nsfw_concepts?.some?.((v: boolean) => v)) {
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

    // Ideogram NSFW check
    const ideogramItems = data.data as Array<{ url: string; is_image_safe?: boolean }> | undefined
    if (ideogramItems?.some(item => item.is_image_safe === false)) {
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

    let images: Array<{ url: string; width: number; height: number; format: 'png' | 'svg'; hasTransparentBg: boolean }>

    switch (this.model) {
      case 'ideogram-v3': {
        const items: Array<{ url: string }> = data.data || []
        images = await Promise.all(items.map(async (item) => {
          let url: string
          try { url = await persistEphemeralUrl(item.url, { prefix: 'ideogram' }) }
          catch { url = item.url }
          return { url, width: req.width || 1024, height: req.height || 1024, format: 'png' as const, hasTransparentBg: false }
        }))
        break
      }

      case 'recraft-v3': {
        const items: Array<{ url: string }> = data.data || []
        const isSvg = mapRecraftStyle(req.style, req.format) === 'vector_illustration'
        const fmt = isSvg ? 'svg' : 'png'
        images = await Promise.all(items.map(async (item) => {
          let url: string
          try { url = await persistEphemeralUrl(item.url, { prefix: 'recraft', format: fmt }) }
          catch { url = item.url }
          return { url, width: req.width || 1024, height: req.height || 1024, format: fmt as 'png' | 'svg', hasTransparentBg: false }
        }))
        break
      }

      case 'gpt-image': {
        const items: Array<{ b64_json?: string; url?: string }> = data.data || []
        images = items.map(item => ({
          url: item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''),
          width: req.width || 1024,
          height: req.height || 1024,
          format: 'png' as const,
          hasTransparentBg: !!req.transparentBg,
        }))
        break
      }

      default: { // FLUX models — URLs are ephemeral, persist to Supabase Storage
        const fluxImages = data.images || []
        images = await Promise.all(fluxImages.map(async (img: { url: string; width?: number; height?: number }) => {
          let url: string
          try { url = await persistEphemeralUrl(img.url, { prefix: this.model }) }
          catch (persistErr) {
            console.error(`[fal-provider] Failed to persist image to storage:`, persistErr instanceof Error ? persistErr.message : persistErr)
            url = img.url // Fallback to ephemeral URL
          }
          return {
            url,
            width: img.width || req.width || 1024,
            height: img.height || req.height || 1024,
            format: 'png' as const,
            hasTransparentBg: false,
          }
        }))
      }
    }

    if (images.length === 0) {
      return {
        success: false,
        images: [],
        provider: this.name,
        costUsd: 0,
        latencyMs: Date.now() - startMs,
        error: `No images in ${this.model} response`,
      }
    }

    return {
      success: true,
      images,
      provider: this.name,
      seed: data.seed,
      costUsd: this.estimateCost(req),
      latencyMs: Date.now() - startMs,
    }
  }
}

// ─── Helper functions ────────────────────────────────────────────────────────

function resolveImageSize(width?: number, height?: number): string {
  if (!width && !height) return 'square_hd'
  if (width === height) return 'square_hd'
  if (width && height && width > height) return 'landscape_16_9'
  if (width && height && height > width) return 'portrait_16_9'
  return 'square_hd'
}

function resolveAspectRatio(width?: number, height?: number): string {
  if (!width || !height) return '1x1'
  if (width === height) return '1x1'
  if (width > height) return '16x9'
  return '9x16'
}

function resolveOpenAISize(width?: number, height?: number): string {
  if (!width && !height) return '1024x1024'
  if (width && height) {
    if (width > height) return '1536x1024'
    if (height > width) return '1024x1536'
  }
  return '1024x1024'
}

function mapIdeogramStyle(style: string): string {
  const lower = style.toLowerCase()
  if (lower.includes('realistic') || lower.includes('photo')) return 'REALISTIC'
  if (lower.includes('design') || lower.includes('graphic')) return 'DESIGN'
  if (lower.includes('fiction') || lower.includes('fantasy') || lower.includes('anime')) return 'FICTION'
  return 'AUTO'
}

function mapRecraftStyle(style?: string, format?: string): string {
  if (format === 'svg') return 'vector_illustration'
  if (!style) return 'digital_illustration'
  const lower = style.toLowerCase()
  if (lower.includes('vector') || lower.includes('svg') || lower.includes('icon') || lower.includes('flat')) return 'vector_illustration'
  if (lower.includes('realistic') || lower.includes('photo')) return 'realistic_image'
  if (lower.includes('logo')) return 'logo_raster'
  return 'digital_illustration'
}
