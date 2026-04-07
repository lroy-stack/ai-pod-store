/**
 * RAG (Retrieval-Augmented Generation) pipeline for chat context enrichment.
 * Performs semantic search against the knowledge base to inject relevant
 * product/policy context into the system prompt.
 */

/**
 * Keyword normalization map for multilingual RAG queries.
 * Common Spanish and German product terms translated to English
 * so they match product titles stored in the database.
 */
const TERM_NORMALIZATION: Record<string, string> = {
  // Spanish → English
  camiseta: 't-shirt',
  camisetas: 't-shirts',
  sudadera: 'hoodie',
  sudaderas: 'hoodies',
  sudadera_con_cremallera: 'zip hoodie',
  cremallera: 'zip hoodie',
  gorra: 'cap',
  gorras: 'caps',
  capucha: 'hoodie',
  chaqueta: 'jacket',
  taza: 'mug',
  bolsa: 'tote bag',
  mochila: 'backpack',
  calcetines: 'socks',
  manga_larga: 'longsleeve',
  manga_corta: 't-shirt',
  zapatillas: 'sneakers',
  bufanda: 'scarf',
  diseño: 'design',
  logo: 'logo',
  estampado: 'print',
  bordado: 'embroidery',
  negro: 'black',
  blanco: 'white',
  azul: 'blue',
  rojo: 'red',
  verde: 'green',
  gris: 'grey',
  // German → English
  kapuzenpullover: 'hoodie',
  kapuzenpulli: 'hoodie',
  pulli: 'hoodie',
  sweatshirt: 'sweatshirt',
  tshirt: 't-shirt',
  shirt: 't-shirt',
  mütze: 'beanie',
  kappe: 'cap',
  rucksack: 'backpack',
  tasche: 'bag',
  tasse: 'mug',
  schwarz: 'black',
  weiß: 'white',
  blau: 'blue',
  rot: 'red',
  grün: 'green',
  grau: 'grey',
}

/**
 * Normalize a multilingual query by replacing known non-English product terms
 * with their English equivalents. This improves RAG recall for es/de queries.
 */
function normalizeQuery(query: string): string {
  const lower = query.toLowerCase()
  let normalized = lower
  for (const [term, replacement] of Object.entries(TERM_NORMALIZATION)) {
    // Replace whole-word matches only to avoid partial word substitution
    const pattern = new RegExp(`\\b${term.replace('_', '\\s+')}\\b`, 'gi')
    normalized = normalized.replace(pattern, replacement)
  }
  return normalized !== lower ? normalized : query
}

/** Patterns that indicate simple conversational messages where RAG is unnecessary */
const SKIP_RAG_PATTERNS = [
  /^(hola|hi|hey|hello|buenos?\s*d[ií]as|buenas)/i,
  /^(gracias|thanks|thank you|ok|vale|entendido)/i,
  /^(a[ñn]ad|add|remove|quitar|eliminar).*(cart|carrito|cesta)/i,
  /^(s[ií]|no|claro|seguro|por supuesto)$/i,
]

interface RagSearchParams {
  messages: any[]
  lastUserText: string
  chatLocale: string
  cookieHeader: string
}

/**
 * Search the RAG knowledge base for relevant context.
 * Returns a formatted context string to append to the system prompt,
 * or an empty string if RAG is skipped or yields no results.
 */
export async function searchProductContext(params: RagSearchParams): Promise<string> {
  const { messages, lastUserText, chatLocale, cookieHeader } = params

  // Skip RAG for simple conversational messages
  const skipRag = SKIP_RAG_PATTERNS.some(p => p.test(lastUserText.trim()))
  if (skipRag) return ''

  try {
    // Get the last user message
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()

    if (!lastUserMessage) return ''

    // Extract text from the message parts
    let userQuery = ''
    if (Array.isArray(lastUserMessage.parts)) {
      const textParts = lastUserMessage.parts.filter((p: any) => p.type === 'text')
      userQuery = textParts.map((p: any) => p.text).join(' ')
    } else if (lastUserMessage.content) {
      userQuery = lastUserMessage.content
    }

    if (!userQuery || userQuery.trim().length === 0) return ''

    // Normalize multilingual terms before RAG search (es/de → en equivalents)
    const normalizedQuery = normalizeQuery(userQuery)

    // Call RAG search to get relevant documents (forward auth cookies)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const ragResponse = await fetch(
      `${baseUrl}/api/rag/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieHeader,
        },
        body: JSON.stringify({
          query: normalizedQuery,
          locale: chatLocale,
          limit: 3,
        }),
      }
    )

    if (!ragResponse.ok) return ''

    const ragData = await ragResponse.json()

    if (!ragData.results || ragData.results.length === 0) return ''

    // Build context string from top results
    let ragContext = '\n\nRELEVANT CONTEXT FROM KNOWLEDGE BASE:\n'
    ragData.results.forEach((doc: any, idx: number) => {
      ragContext += `\n[${idx + 1}] ${doc.content}`
      if (doc.metadata?.source_type === 'product') {
        ragContext += ` (Product: ${doc.metadata.title || 'Unknown'})`
      }
    })
    ragContext += '\n\nUse the above context to provide accurate, specific answers about our products and policies.\n'

    return ragContext
  } catch (ragError) {
    console.error('RAG retrieval error (non-critical):', ragError)
    // Continue without RAG context if it fails
    return ''
  }
}
