import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Chunk text into smaller pieces for better RAG retrieval
 * Strategy: Recursive splitting with overlap, respecting boundaries
 * - Target: 400-512 tokens (≈ 1600-2048 chars, using 1 token ≈ 4 chars)
 * - Overlap: 15% (center of 10-20% range)
 * - Boundary priority: code blocks > paragraphs > newlines > sentences > words
 */
function chunkText(text: string, targetChunkSize = 1800, maxChunkSize = 2048): string[] {
  const overlapPercent = 0.15 // 15% overlap
  const overlapSize = Math.round(targetChunkSize * overlapPercent)

  // If text is short enough, return as single chunk
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []

  // Helper: Extract code blocks with their positions
  function extractCodeBlocks(content: string): Array<{ start: number; end: number; text: string }> {
    const blocks: Array<{ start: number; end: number; text: string }> = []
    const regex = /```[\s\S]*?```/g
    let match
    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      })
    }
    return blocks
  }

  // Helper: Check if position is inside a code block
  function isInCodeBlock(pos: number, blocks: Array<{ start: number; end: number }>): boolean {
    return blocks.some((block) => pos > block.start && pos < block.end)
  }

  // Helper: Find best split position with boundary respect
  function findSplitPosition(content: string, idealPos: number): number {
    const codeBlocks = extractCodeBlocks(content)

    // Don't split inside code blocks
    if (isInCodeBlock(idealPos, codeBlocks)) {
      // Find nearest code block boundary before idealPos
      const blockBefore = codeBlocks.find((b) => b.end <= idealPos)
      if (blockBefore) return blockBefore.end
      // Otherwise, find block start
      const blockContaining = codeBlocks.find((b) => idealPos >= b.start && idealPos <= b.end)
      if (blockContaining) return blockContaining.start
    }

    // Search window: ±200 chars from ideal position
    const searchStart = Math.max(0, idealPos - 200)
    const searchEnd = Math.min(content.length, idealPos + 200)
    const searchWindow = content.substring(searchStart, searchEnd)

    // Priority 1: Paragraph boundary (\n\n)
    const paragraphMatch = searchWindow.lastIndexOf('\n\n')
    if (paragraphMatch !== -1) {
      return searchStart + paragraphMatch + 2 // After the \n\n
    }

    // Priority 2: Single newline
    const newlineMatch = searchWindow.lastIndexOf('\n')
    if (newlineMatch !== -1) {
      return searchStart + newlineMatch + 1 // After the \n
    }

    // Priority 3: Sentence boundary (. ! ? followed by space)
    const sentenceRegex = /[.!?]\s+/g
    let lastSentencePos = -1
    let match
    while ((match = sentenceRegex.exec(searchWindow)) !== null) {
      lastSentencePos = match.index + match[0].length
    }
    if (lastSentencePos !== -1) {
      return searchStart + lastSentencePos
    }

    // Priority 4: Word boundary (space)
    const spaceMatch = searchWindow.lastIndexOf(' ')
    if (spaceMatch !== -1) {
      return searchStart + spaceMatch + 1 // After the space
    }

    // Fallback: split at ideal position (hard break)
    return idealPos
  }

  // Recursive splitting with overlap
  let remaining = text
  let startOffset = 0

  while (remaining.length > 0) {
    // If remaining text fits in one chunk, add it and finish
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining.trim())
      break
    }

    // Find split position
    const splitPos = findSplitPosition(remaining, targetChunkSize)
    const chunk = remaining.substring(0, splitPos).trim()

    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    // Calculate next start with overlap
    const nextStart = Math.max(0, splitPos - overlapSize)
    remaining = remaining.substring(nextStart)
    startOffset += nextStart

    // Safety: prevent infinite loop if split position doesn't advance
    if (splitPos === 0) {
      // Force a split at targetChunkSize
      const forceChunk = remaining.substring(0, targetChunkSize).trim()
      if (forceChunk.length > 0) {
        chunks.push(forceChunk)
      }
      remaining = remaining.substring(targetChunkSize)
    }
  }

  return chunks.filter((c) => c.length > 0)
}

/**
 * Index a new document into the RAG knowledge base
 * POST /api/rag/index
 * Body: {
 *   content: string,
 *   metadata?: object,
 *   source_type: 'product' | 'design' | 'faq' | 'policy',
 *   source_id?: string,
 *   locale?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    try { await requireAdmin(request) } catch (e) { return authErrorResponse(e) }

    const body = await request.json()
    const {
      content,
      metadata = {},
      source_type,
      source_id = null,
      locale = 'en',
    } = body

    // Validate required fields
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      )
    }

    if (!source_type || !['product', 'design', 'faq', 'policy'].includes(source_type)) {
      return NextResponse.json(
        {
          error: 'source_type is required and must be one of: product, design, faq, policy',
        },
        { status: 400 }
      )
    }

    if (content.length < 10) {
      return NextResponse.json(
        { error: 'Content must be at least 10 characters' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // 1. Chunk the content if it's long (target 400-512 tokens with 15% overlap)
    const chunks = chunkText(content) // ~1800 chars ≈ 450 tokens with recursive boundary-aware splitting

    const indexedChunks = []
    const embeddingUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent'

    // 2. Process each chunk: generate embedding + insert into DB
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      // Generate embedding for this chunk
      const embeddingResponse = await fetch(embeddingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [{ text: chunk }],
          },
          outputDimensionality: 768,
        }),
      })

      if (!embeddingResponse.ok) {
        const errorData = await embeddingResponse.text()
        console.error(`Gemini embedding error for chunk ${i}:`, errorData)
        continue // Skip this chunk but continue with others
      }

      const embeddingData = await embeddingResponse.json()
      const embedding = embeddingData.embedding?.values || []

      if (embedding.length !== 768) {
        console.error(`Invalid embedding dimension for chunk ${i}: ${embedding.length}`)
        continue
      }

      // Insert chunk with embedding into the database
      const chunkMetadata = {
        ...metadata,
        chunk_index: i,
        total_chunks: chunks.length,
        chunk_size: chunk.length,
      }

      const { data: document, error: insertError } = await supabaseAdmin
        .from('documents')
        .insert({
          content: chunk,
          metadata: chunkMetadata,
          embedding: JSON.stringify(embedding),
          source_type,
          source_id,
          locale,
        })
        .select()
        .single()

      if (insertError) {
        console.error(`Document insert error for chunk ${i}:`, insertError)
        continue
      }

      indexedChunks.push({
        id: document.id,
        chunk_index: i,
        content_length: chunk.length,
        has_embedding: true,
      })
    }

    if (indexedChunks.length === 0) {
      return NextResponse.json(
        {
          error: 'Failed to index any chunks',
          details: 'All chunks failed embedding or insertion',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Document indexed successfully',
        chunks: indexedChunks,
        summary: {
          total_chunks: chunks.length,
          indexed_chunks: indexedChunks.length,
          original_length: content.length,
          max_chunk_size: Math.max(...chunks.map((c) => c.length)),
          avg_chunk_size: Math.round(
            chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length
          ),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('RAG index error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get indexing configuration
 * GET /api/rag/index
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/rag/index',
    method: 'POST',
    description: 'Index a new document into the RAG knowledge base',
    parameters: {
      content: 'Document content (required, min 10 chars)',
      metadata: 'Additional metadata (optional, JSON object)',
      source_type: 'Document type: product, design, faq, or policy (required)',
      source_id: 'Reference ID to source entity (optional)',
      locale: 'Document locale (default: "en")',
    },
    example: {
      content: 'Our premium cotton t-shirts are made from 100% organic cotton.',
      metadata: {
        product_id: '123',
        category: 'apparel',
      },
      source_type: 'product',
      source_id: '123',
      locale: 'en',
    },
  })
}
