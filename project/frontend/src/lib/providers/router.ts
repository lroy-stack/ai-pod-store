/**
 * Smart design intent router.
 * Routes each design request to the best available provider with fallbacks.
 */

import type { ImageProvider } from './types'
import { FalProvider } from './fal-provider'
import { OpenAIProvider } from './openai-provider'
import { IdeogramProvider } from './ideogram-provider'
import { RecraftProvider } from './recraft-provider'

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
 * Routing table: intent → ordered provider factories.
 * Factory functions for lazy instantiation (avoids premature env var reads).
 */
const ROUTING_TABLE: Record<DesignIntent, RouteEntry> = {
  'artistic': {
    factories: [
      () => new FalProvider('flux-pro'),
      () => new FalProvider('dev'),
      () => new OpenAIProvider(),
    ],
  },
  'text-heavy': {
    factories: [
      () => new IdeogramProvider(),
      () => new OpenAIProvider(),
      () => new FalProvider('flux-pro'),
    ],
  },
  'photorealistic': {
    factories: [
      () => new OpenAIProvider(),
      () => new FalProvider('flux-pro'),
      () => new FalProvider('dev'),
    ],
  },
  'vector': {
    factories: [
      () => new RecraftProvider(),
      () => new IdeogramProvider(),
      () => new FalProvider('dev'),
    ],
  },
  'pattern': {
    factories: [
      () => new FalProvider('flux-pro'),
      () => new FalProvider('dev'),
      () => new IdeogramProvider(),
    ],
  },
  'quick-draft': {
    factories: [
      () => new FalProvider('schnell'),
      () => new FalProvider('dev'),
    ],
  },
  'general': {
    factories: [
      () => new FalProvider('dev'),
      () => new OpenAIProvider(),
      () => new IdeogramProvider(),
    ],
  },
}

/** All provider factories for last-resort fallback */
const ALL_FACTORIES: ProviderFactory[] = [
  () => new FalProvider('schnell'),
  () => new FalProvider('dev'),
  () => new FalProvider('flux-pro'),
  () => new OpenAIProvider(),
  () => new IdeogramProvider(),
  () => new RecraftProvider(),
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
export function routeDesign(intent: DesignIntent = 'general'): RouteResult {
  const entry = ROUTING_TABLE[intent]
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

  // No providers for this intent — try all providers as last resort
  const lastResort = ALL_FACTORIES
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
