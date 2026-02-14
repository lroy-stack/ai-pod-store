import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Test Google Gemini embedding API
 * POST /api/rag/test-gemini
 */
export async function POST(request: Request) {
  try {
    const { text } = await request.json()
    const testText = text || 'Test document for embedding generation'

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Call Gemini embedding API
    // https://ai.google.dev/gemini-api/docs/embeddings
    // Using gemini-embedding-001 which produces 768-dimensional vectors
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: {
          parts: [{ text: testText }],
        },
        outputDimensionality: 768,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Gemini API error:', errorData)
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini API request failed',
          status: response.status,
          details: errorData,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Extract embedding
    const embedding = data.embedding?.values || []
    const dimension = embedding.length

    return NextResponse.json({
      success: true,
      message: 'Gemini embedding API is reachable',
      testText,
      embedding: {
        dimension,
        is768: dimension === 768,
        firstFiveValues: embedding.slice(0, 5),
        lastFiveValues: embedding.slice(-5),
      },
      verification: {
        apiReachable: true,
        returnsEmbedding: embedding.length > 0,
        correctDimension: dimension === 768,
        allChecksPassed: dimension === 768,
      },
      rawResponse: {
        modelUsed: data.model || 'unknown',
        taskType: data.taskType || 'unknown',
      },
    })
  } catch (error: any) {
    console.error('Gemini test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * Get Gemini API configuration info
 * GET /api/rag/test-gemini
 */
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  const hasApiKey = !!apiKey
  const apiKeyLength = apiKey?.length || 0
  const apiKeyPreview = apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : 'not set'

  return NextResponse.json({
    configured: hasApiKey,
    apiKeyPreview,
    apiKeyLength,
    model: 'gemini-embedding-001',
    expectedDimension: 768,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
  })
}
