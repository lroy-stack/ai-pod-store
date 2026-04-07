/**
 * Content Safety — Prompt Filter
 *
 * Checks design prompts against blocked terms (trademarks, NSFW, hate speech).
 * Runs before any design generation call.
 */

const BLOCKED_TERMS: { term: string; category: string }[] = [
  // Trademarks
  { term: 'nike', category: 'Trademark violation' },
  { term: 'adidas', category: 'Trademark violation' },
  { term: 'disney', category: 'Trademark violation' },
  { term: 'marvel', category: 'Trademark violation' },
  { term: 'supreme', category: 'Trademark violation' },
  { term: 'gucci', category: 'Trademark violation' },
  { term: 'louis vuitton', category: 'Trademark violation' },
  { term: 'coca-cola', category: 'Trademark violation' },
  { term: 'coca cola', category: 'Trademark violation' },
  { term: 'pepsi', category: 'Trademark violation' },
  { term: 'starbucks', category: 'Trademark violation' },
  { term: 'apple logo', category: 'Trademark violation' },
  { term: 'google logo', category: 'Trademark violation' },
  { term: 'pokemon', category: 'Trademark violation' },
  { term: 'hello kitty', category: 'Trademark violation' },
  { term: 'mickey mouse', category: 'Trademark violation' },
  // NSFW
  { term: 'nude', category: 'NSFW content' },
  { term: 'naked', category: 'NSFW content' },
  { term: 'porn', category: 'NSFW content' },
  { term: 'explicit', category: 'NSFW content' },
  { term: 'sexual', category: 'NSFW content' },
  { term: 'hentai', category: 'NSFW content' },
  // Hate / violence
  { term: 'swastika', category: 'Hate symbol' },
  { term: 'nazi', category: 'Hate symbol' },
  { term: 'kill', category: 'Violent content' },
  { term: 'murder', category: 'Violent content' },
  { term: 'terrorist', category: 'Violent content' },
  { term: 'white power', category: 'Hate speech' },
  { term: 'white supremac', category: 'Hate speech' },
  // Illegal
  { term: 'counterfeit', category: 'Illegal content' },
  { term: 'fake id', category: 'Illegal content' },
  { term: 'drug', category: 'Illegal content' },
]

/**
 * Normalize a prompt string for matching.
 * Lowercases, removes special characters, collapses whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface SafetyResult {
  safe: boolean
  reason?: string
  category?: string
}

/**
 * Check if a design prompt is safe to process.
 * Returns { safe: true } if OK, or { safe: false, reason, category } if blocked.
 */
export function checkPromptSafety(prompt: string): SafetyResult {
  const normalized = normalize(prompt)

  for (const { term, category } of BLOCKED_TERMS) {
    // Word-boundary matching: check if term appears as a standalone word/phrase
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (regex.test(normalized)) {
      return {
        safe: false,
        reason: `${category}: "${term}"`,
        category,
      }
    }
  }

  return { safe: true }
}
