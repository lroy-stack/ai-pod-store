/**
 * Tier-aware design intent router.
 *
 * Routes each design request to the best available provider based on:
 * 1. Design intent (artistic, text-heavy, vector, etc.)
 * 2. User tier (free → cost-efficient models, premium → highest quality)
 *
 * Free tier: FLUX Dev + Ideogram V3 + Recraft V3 (all via fal.ai)
 * Premium tier: FLUX.2 Pro + OpenAI gpt-image-1 + Ideogram + Recraft
 */

import type { ImageProvider } from './types'
import type { UserTier } from '@/lib/usage-limiter'
import { FalProvider } from './fal-provider'
import { OpenAIProvider } from './openai-provider'

export type DesignIntent =
  | 'artistic'
  | 'text-heavy'
  | 'photorealistic'
  | 'vector'
  | 'pattern'
  | 'quick-draft'
  | 'general'

type ProviderFactory = () => ImageProvider

interface RouteEntry {
  factories: ProviderFactory[]
}

/**
 * Free tier routing: FLUX Dev as workhorse, specialized models for specific intents.
 * All via fal.ai (single FAL_KEY). Cost target: ~$0.025/design avg.
 */
const FREE_ROUTING: Record<DesignIntent, RouteEntry> = {
  'general': {
    factories: [
      () => new FalProvider('dev'),
      () => new FalProvider('schnell'),
    ],
  },
  'artistic': {
    factories: [
      () => new FalProvider('dev'),
      () => new FalProvider('schnell'),
    ],
  },
  'text-heavy': {
    factories: [
      () => new FalProvider('ideogram-v3'),
      () => new FalProvider('dev'),
    ],
  },
  'photorealistic': {
    factories: [
      () => new FalProvider('dev'),
      () => new FalProvider('schnell'),
    ],
  },
  'vector': {
    factories: [
      () => new FalProvider('recraft-v3'),
      () => new FalProvider('dev'),
    ],
  },
  'pattern': {
    factories: [
      () => new FalProvider('dev'),
      () => new FalProvider('schnell'),
    ],
  },
  'quick-draft': {
    factories: [
      () => new FalProvider('schnell'),
    ],
  },
}

/**
 * Premium tier routing: highest quality models per intent.
 * FLUX.2 Pro (zero-config), OpenAI (photorealism + transparency), Ideogram (text), Recraft (vector).
 * Cost target: ~$0.04/design avg.
 */
const PREMIUM_ROUTING: Record<DesignIntent, RouteEntry> = {
  'general': {
    factories: [
      () => new FalProvider('flux-2-pro'),
      () => new FalProvider('dev'),
    ],
  },
  'artistic': {
    factories: [
      () => new FalProvider('flux-2-pro'),
      () => new FalProvider('dev'),
    ],
  },
  'text-heavy': {
    factories: [
      () => new FalProvider('ideogram-v3'),
      () => new FalProvider('flux-2-pro'),
    ],
  },
  'photorealistic': {
    factories: [
      () => new OpenAIProvider(),
      () => new FalProvider('gpt-image'),
      () => new FalProvider('flux-2-pro'),
    ],
  },
  'vector': {
    factories: [
      () => new FalProvider('recraft-v3'),
      () => new FalProvider('ideogram-v3'),
    ],
  },
  'pattern': {
    factories: [
      () => new FalProvider('flux-2-pro'),
      () => new FalProvider('dev'),
    ],
  },
  'quick-draft': {
    factories: [
      () => new FalProvider('schnell'),
    ],
  },
}

/** Last-resort fallback: cheapest + most reliable */
const FALLBACK_FACTORIES: ProviderFactory[] = [
  () => new FalProvider('schnell'),
  () => new FalProvider('dev'),
]

export interface RouteResult {
  primary: ImageProvider
  fallbacks: ImageProvider[]
  intent: DesignIntent
}

/**
 * Route a design request to the best available providers.
 * Returns primary + fallbacks, filtering out unavailable providers.
 */
export function routeDesign(intent: DesignIntent = 'general', tier: UserTier = 'free'): RouteResult {
  const table = tier === 'premium' ? PREMIUM_ROUTING : FREE_ROUTING
  const entry = table[intent]
  const available = entry.factories
    .map((f) => f())
    .filter((p) => p.isAvailable())

  if (available.length > 0) {
    return {
      primary: available[0],
      fallbacks: available.slice(1),
      intent,
    }
  }

  // No providers for this intent — try fallbacks
  const lastResort = FALLBACK_FACTORIES
    .map((f) => f())
    .filter((p) => p.isAvailable())

  if (lastResort.length === 0) {
    throw new Error(
      'No image generation providers available. Configure at least FAL_KEY in environment variables.'
    )
  }

  return {
    primary: lastResort[0],
    fallbacks: lastResort.slice(1),
    intent,
  }
}
