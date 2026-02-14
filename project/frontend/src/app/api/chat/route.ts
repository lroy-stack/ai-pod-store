import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const runtime = 'edge'
export const maxDuration = 60

// Initialize Google AI with API key
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
})

/**
 * POST /api/chat
 *
 * AI SDK 6 chat endpoint with streaming SSE
 *
 * Uses:
 * - Google Gemini 2.0 Flash model (free tier, fast)
 * - streamText() from AI SDK 6
 * - toUIMessageStreamResponse() for SSE streaming
 *
 * Future enhancements:
 * - ToolLoopAgent with 22 chat tools
 * - needsApproval for checkout/returns
 * - DataPart streaming for sidebar updates
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: 'Invalid request: messages array required' },
        { status: 400 }
      )
    }

    // System prompt for PodClaw conversational assistant
    const systemPrompt = `You are PodClaw, an AI assistant for a print-on-demand store. You help customers:
- Find and recommend products (t-shirts, hoodies, mugs, posters, phone cases)
- Answer questions about products, shipping, and returns
- Guide them through the shopping experience
- Provide design suggestions and customization options

Be friendly, helpful, and concise. Always respond in the user's language.
If you don't know something, be honest and offer to help in other ways.`

    // Convert UI messages (with parts array) to model messages
    // UI messages have { role, parts: [{ type: 'text', text: '...' }], id }
    // Model messages need { role, content: '...' }
    const modelMessages = messages.map((msg: any) => {
      // Extract text from parts array
      const textParts = msg.parts.filter((p: any) => p.type === 'text')
      const content = textParts.map((p: any) => p.text).join('\n')

      return {
        role: msg.role,
        content,
      }
    })

    // Stream response using Google Gemini
    const result = await streamText({
      model: google('gemini-2.0-flash'),
      system: systemPrompt,
      messages: modelMessages,
      maxSteps: 1, // Single-turn response (no tools yet)
    })

    // Return streaming SSE response
    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return Response.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
