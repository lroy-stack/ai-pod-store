/**
 * Profanity Filter for Personalization Text
 *
 * Blocks inappropriate words in user-generated content
 */

// Multilingual profanity list (en/es/de)
const PROFANITY_LIST = [
  // English
  'fuck',
  'shit',
  'ass',
  'bitch',
  'damn',
  'crap',
  'piss',
  'dick',
  'cock',
  'pussy',
  'asshole',
  'bastard',
  'slut',
  'whore',
  'fag',
  'nigger',
  'nigga',
  'retard',
  'cunt',
  'twat',

  // Spanish (español)
  'mierda',
  'joder',
  'puta',
  'puto',
  'coño',
  'cabrón',
  'pendejo',
  'verga',
  'chingar',
  'maricón',
  'culero',
  'pinche',
  'huevón',
  'carajo',
  'mamón',

  // German (Deutsch)
  'scheiße',
  'scheisse',
  'arsch',
  'fotze',
  'hure',
  'schwuchtel',
  'wichser',
  'arschloch',
  'mistkerl',
  'hurensohn',
  'drecksau',
  'schlampe',
  'fick',
  'ficken',
];

/**
 * Check if text contains profanity
 * @param text The text to check
 * @returns true if profanity is detected, false otherwise
 */
export function containsProfanity(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const lowerText = text.toLowerCase();

  // Check for exact word matches (with word boundaries)
  for (const word of PROFANITY_LIST) {
    // Create regex pattern with word boundaries
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(lowerText)) {
      return true;
    }
  }

  // Check for common character substitutions (l33t speak)
  const normalizedText = lowerText
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's');

  for (const word of PROFANITY_LIST) {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(normalizedText)) {
      return true;
    }
  }

  return false;
}

/**
 * Get a user-friendly error message for profanity detection
 */
export function getProfanityErrorMessage(): string {
  return 'Inappropriate language detected. Please use family-friendly text.';
}
