/**
 * fal.ai image generation provider.
 * Supports FLUX.1 schnell, dev, and pro models.
 */

import type { ImageProvider, GenerationRequest, GenerationResponse, ProviderCapabilities, ProviderName } from './types'

type FalModel = 'schnell' | 'dev' | 'flux-pro'

const MODEL_CONFIG: Record<FalModel, {
  endpoint: string
  providerName: ProviderName
  inferenceSteps: number
  costUsd: number
  maxWidth: number
  maxHeight: number
}> = {
  schnell: {
    endpoint: 'https://fal.run/fal-ai/flux/schnell',
    providerName: 'fal-schnell',
    inferenceSteps: 4,
    costUsd: 0.003,
    maxWidth: 1024,
    maxHeight: 1024,
  },
  dev: {
    endpoint: 'https://fal.run/fal-ai/flux/dev',
    providerName: 'fal-dev',
    inferenceSteps: 28,
    costUsd: 0.025,
    maxWidth: 2048,
    maxHeight: 2048,
  },
  'flux-pro': {
    endpoint: 'https://fal.run/fal-ai/flux-pro/v1.1',
    providerName: 'fal-flux-pro',
    inferenceSteps: 28,
    costUsd: 0.05,
    maxWidth: 2048,
    maxHeight: 2048,
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
      supportsTransparentBg: false,
      supportsSvg: false,
      supportsImg2Img: model === 'dev',
      textQuality: model === 'flux-pro' ? 4 : model === 'dev' ? 3 : 2,
      photorealism: model === 'flux-pro' ? 4 : model === 'dev' ? 4 : 3,
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
      const imageSize = resolveImageSize(req.width, req.height)
      const body: Record<string, unknown> = {
        prompt: req.prompt,
        image_size: imageSize,
        num_inference_steps: config.inferenceSteps,
        num_images: req.numImages || 1,
        enable_safety_checker: true,
      }

      if (req.negativePrompt) {
        body.negative_prompt = req.negativePrompt
      }
      if (req.seed !== undefined) {
        body.seed = req.seed
      }
      if (req.referenceImage && this.capabilities.supportsImg2Img) {
        body.image_url = req.referenceImage
        body.strength = req.strength ?? 0.65
      }

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`fal.ai ${this.model} error:`, errText)
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

      const images = (data.images || []).map((img: { url: string; width?: number; height?: number }) => ({
        url: img.url,
        width: img.width || req.width || 1024,
        height: img.height || req.height || 1024,
        format: 'png' as const,
        hasTransparentBg: false,
      }))

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
}

function resolveImageSize(width?: number, height?: number): string {
  if (!width && !height) return 'square_hd'
  if (width === height) return 'square_hd'
  if (width && height && width > height) return 'landscape_16_9'
  if (width && height && height > width) return 'portrait_16_9'
  return 'square_hd'
}
