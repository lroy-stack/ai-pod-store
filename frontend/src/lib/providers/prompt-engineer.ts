/**
 * Per-provider prompt adaptation.
 * Each provider has different strengths — prompts are tailored accordingly.
 */

import type { ProviderName } from './types'

const POD_SUFFIX = ', isolated on solid background, clean edges, print-ready, high resolution'

const DEFAULT_NEGATIVE = 'blurry, low quality, watermark, text, signature, distorted, ugly'

/**
 * Adapt prompt for the target provider's strengths.
 */
export function engineerPrompt(
  providerName: ProviderName,
  prompt: string,
  style?: string
): string {
  switch (providerName) {
    case 'fal-schnell':
    case 'fal-dev':
    case 'fal-flux-pro':
    case 'fal-flux-2-pro': {
      const styleSegment = style ? `, ${style} style` : ''
      return `${prompt}${styleSegment}, detailed, professional quality, sharp details${POD_SUFFIX}`
    }

    case 'openai':
    case 'fal-gpt-image':
      // GPT Image uses natural language. Style is embedded in text (no style param).
      if (style) {
        return `${prompt} in ${style} style${POD_SUFFIX}`
      }
      return `${prompt}${POD_SUFFIX}`

    case 'ideogram':
    case 'fal-ideogram':
      // Ideogram has magic_prompt: AUTO — keep prompt clean.
      // Style goes in the API's style_type param, not the prompt.
      return prompt

    case 'recraft':
    case 'fal-recraft':
      // Recraft uses API style param — keep prompt clean.
      return prompt

    default:
      return `${prompt}${POD_SUFFIX}`
  }
}

/**
 * Adapt negative prompt for the target provider.
 * Returns undefined for providers that don't support it.
 */
export function engineerNegativePrompt(
  providerName: ProviderName,
  negativePrompt?: string
): string | undefined {
  // OpenAI/GPT Image doesn't support negative_prompt
  if (providerName === 'openai' || providerName === 'fal-gpt-image') return undefined
  // Ideogram handles negatives internally with magic_prompt
  if (providerName === 'fal-ideogram' || providerName === 'ideogram') return negativePrompt || undefined

  return negativePrompt || DEFAULT_NEGATIVE
}
