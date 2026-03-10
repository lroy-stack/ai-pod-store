import { customAlphabet } from 'nanoid'

// Alphabet without ambiguous characters: O/0, I/1, L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // 31 chars
const generate = customAlphabet(ALPHABET, 10) // ~49 bits entropy per code

export function generateSecureCode(prefix?: string): string {
  const random = generate()
  return prefix ? `${prefix.toUpperCase()}-${random}` : random
}

export function generateBulkCodes(count: number, prefix?: string): string[] {
  const codes = new Set<string>()
  // Safety limit to avoid infinite loop on collision
  let attempts = 0
  const maxAttempts = count * 3
  while (codes.size < count && attempts < maxAttempts) {
    codes.add(generateSecureCode(prefix))
    attempts++
  }
  return Array.from(codes)
}
