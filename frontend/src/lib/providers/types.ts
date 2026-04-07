/**
 * Multi-provider image generation abstraction layer.
 * Shared types for all image generation providers.
 */

export type ProviderName =
  | 'fal-schnell'
  | 'fal-dev'
  | 'fal-flux-pro'
  | 'fal-flux-2-pro'
  | 'fal-ideogram'
  | 'fal-recraft'
  | 'fal-gpt-image'
  | 'openai'
  | 'ideogram'
  | 'recraft'
  | 'gemini'
  | 'imagen'
  | 'replicate'

export interface GenerationRequest {
  prompt: string
  negativePrompt?: string
  style?: string
  width?: number
  height?: number
  numImages?: number
  seed?: number
  transparentBg?: boolean
  format?: 'png' | 'svg'
  referenceImage?: string
  strength?: number
}

export interface GeneratedImage {
  url: string
  width: number
  height: number
  format: 'png' | 'jpg' | 'webp' | 'svg'
  hasTransparentBg: boolean
}

export interface GenerationResponse {
  success: boolean
  images: GeneratedImage[]
  provider: ProviderName
  seed?: number
  costUsd: number
  latencyMs: number
  error?: string
  nsfw?: boolean
}

export interface ProviderCapabilities {
  maxWidth: number
  maxHeight: number
  supportsTransparentBg: boolean
  supportsSvg: boolean
  supportsImg2Img: boolean
  textQuality: 1 | 2 | 3 | 4 | 5
  photorealism: 1 | 2 | 3 | 4 | 5
  maxBatchSize: number
}

export interface ImageProvider {
  name: ProviderName
  generate(req: GenerationRequest): Promise<GenerationResponse>
  isAvailable(): boolean
  estimateCost(req: GenerationRequest): number
  capabilities: ProviderCapabilities
}
