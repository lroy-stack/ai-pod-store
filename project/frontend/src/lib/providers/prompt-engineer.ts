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
    case 'fal-flux-pro': {
      const styleSegment = style ? `, ${style} style` : ''
      return `${prompt}${styleSegment}, detailed, professional quality, sharp details${POD_SUFFIX}`
    }

    case 'openai':
      // GPT Image uses natural language. Style is embedded in text (no style param).
      // Avoid "8k" or "professional" — GPT Image ignores those.
      if (style) {
        return `${prompt} in ${style} style${POD_SUFFIX}`
      }
      return `${prompt}${POD_SUFFIX}`

    case 'ideogram':
      // Ideogram has magic_prompt: AUTO — keep prompt clean.
      // Style goes in the API's style_type param, not the prompt.
      return prompt

    case 'recraft':
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
  // OpenAI doesn't support negative_prompt
  if (providerName === 'openai') return undefined

  return negativePrompt || DEFAULT_NEGATIVE
}
