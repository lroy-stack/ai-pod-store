/**
 * AI Design Orchestrator
 *
 * Classifies design intent from user prompts and produces engineered prompts
 * with negative prompts tailored to the detected intent and optional style presets.
 */

import { type DesignIntent } from './providers/router'
import { engineerPrompt, engineerNegativePrompt } from './providers/prompt-engineer'
import { DESIGN_PRESETS, type DesignPreset } from './design-presets'

export interface OrchestrationResult {
  engineeredPrompt: string
  negativePrompt: string
  intent: DesignIntent
  confidence: number
}

/**
 * Keyword-to-intent mapping table.
 * Each entry is [keywords[], intent, confidenceBoost].
 * Checked in order; first match wins with highest confidence.
 */
const INTENT_KEYWORDS: [string[], DesignIntent, number][] = [
  [['photo', 'realistic', 'photograph', 'realism'], 'photorealistic', 0.85],
  [['text', 'typography', 'letter', 'lettering', 'font', 'word'], 'text-heavy', 0.80],
  [['vector', 'flat', 'icon', 'logo', 'svg', 'minimal icon'], 'vector', 0.85],
  [['pattern', 'tile', 'repeat', 'seamless', 'tiling'], 'pattern', 0.80],
  [['sketch', 'quick', 'draft', 'rough', 'concept'], 'quick-draft', 0.70],
  [['art', 'paint', 'watercolor', 'abstract', 'artistic', 'oil painting', 'impressionist'], 'artistic', 0.75],
]

/**
 * Classify design intent from a user prompt using keyword heuristics.
 * Returns the detected intent and a confidence score (0-1).
 */
function classifyIntent(prompt: string): { intent: DesignIntent; confidence: number } {
  const normalized = prompt.toLowerCase()

  let bestIntent: DesignIntent = 'general'
  let bestConfidence = 0.5

  for (const [keywords, intent, baseConfidence] of INTENT_KEYWORDS) {
    let matchCount = 0
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        matchCount++
      }
    }

    if (matchCount > 0) {
      // Confidence increases with more keyword matches, capped at 0.95
      const confidence = Math.min(0.95, baseConfidence + (matchCount - 1) * 0.05)
      if (confidence > bestConfidence) {
        bestIntent = intent
        bestConfidence = confidence
      }
    }
  }

  return { intent: bestIntent, confidence: bestConfidence }
}

/**
 * Find a design preset by ID.
 */
function findPreset(presetId: string): DesignPreset | undefined {
  return DESIGN_PRESETS.find((p) => p.id === presetId)
}

/**
 * Orchestrate a design generation request.
 *
 * 1. Classifies the user's intent from the prompt
 * 2. Optionally applies a style preset's prompt suffix
 * 3. Engineers the prompt and negative prompt for the target provider
 *
 * Note: The engineered prompt returned here is a "pre-engineered" version.
 * The actual provider-specific adaptation happens in generateDesign() via
 * engineerPrompt(providerName, ...). This orchestrator adds the preset
 * suffix and intent context before that step.
 */
export function orchestrateDesign(
  userPrompt: string,
  productType: string,
  stylePreset?: string
): OrchestrationResult {
  const { intent, confidence } = classifyIntent(userPrompt)

  // Build the orchestrated prompt
  let orchestratedPrompt = userPrompt

  // If a style preset is provided, prepend the preset's prompt suffix
  if (stylePreset) {
    const preset = findPreset(stylePreset)
    if (preset) {
      orchestratedPrompt = `${preset.promptSuffix}, ${orchestratedPrompt}`
    }
  }

  // Add product-type context for POD relevance
  if (productType) {
    orchestratedPrompt = `${orchestratedPrompt}, suitable for ${productType} print`
  }

  // Build negative prompt: combine preset negative with default
  let negativePrompt = 'blurry, low quality, watermark, text, signature, distorted, ugly'
  if (stylePreset) {
    const preset = findPreset(stylePreset)
    if (preset && preset.negativePrompt) {
      negativePrompt = `${preset.negativePrompt}, ${negativePrompt}`
    }
  }

  return {
    engineeredPrompt: orchestratedPrompt,
    negativePrompt,
    intent,
    confidence,
  }
}
