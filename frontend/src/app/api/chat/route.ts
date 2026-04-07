import { streamText, stepCountIs, convertToModelMessages } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createClient } from '@supabase/supabase-js'
import { chatLimiter, noFpChatLimiter, acquireSlot, releaseSlot } from '@/lib/rate-limit'
import { checkAndIncrementUsage, usageHeaders, UserTier, USAGE_TIERS, checkTokenBudget } from '@/lib/usage-limiter'
import { checkAnomaly, trackRateLimitHit, isBlocked, checkVelocity } from '@/lib/anomaly-monitor'
import { checkPromptSafety } from '@/lib/content-safety'
import { getChatTools } from '@/lib/chat/tools'
import { searchProductContext } from '@/lib/chat/rag'
import { loadFAQContext, buildSystemPrompt } from '@/lib/chat/context'
import { TOKEN_BUDGET, createOnFinishCallback } from '@/lib/chat/stream'

export const maxDuration = 60

/** Maximum characters per user message */
const MAX_MESSAGE_CHARS = 4000
/** Maximum context messages in sliding window */
const MAX_CONTEXT_MESSAGES = 40

// Initialize Google AI with API key
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
})

// Initialize Supabase service-role client for admin reads (products, profiles, etc.)
// Use SUPABASE_URL (not NEXT_PUBLIC_*) — NEXT_PUBLIC vars are inlined at build time
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * Create a user-scoped Supabase client authenticated with the user's JWT.
 * Used for conversation/message writes so RLS enforces user isolation.
 * Falls back to service key for anonymous sessions (no JWT).
 */
function createUserScopedClient(accessToken: string) {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

/**
 * Extract text content from a chat message (handles both string content and parts array).
 */
function extractTextContent(message: any): string {
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.parts)) {
    return message.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ')
  }
  return JSON.stringify(message.content)
}

/**
 * POST /api/chat
 *
 * AI SDK 6 chat endpoint with ToolLoopAgent pattern.
 * Orchestrates: auth, rate limiting, RAG, context building, tool-augmented streaming.
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') || 'unknown'

    // Burst rate limit — stricter for requests without fingerprint
    const fpId = req.headers.get('x-fp-id')
    const limiter = fpId ? chatLimiter : noFpChatLimiter
    const { success } = limiter.check(ip)
    if (!success) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

    // Parse cookies from request headers
    const cookieHeader = req.headers.get('cookie') || ''
    const cookieMap = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [key, ...val] = c.trim().split('=')
        return [key, val.join('=')]
      })
    )
    const cartSessionId = cookieMap['cart-session-id'] || null
    const sbAccessToken = cookieMap['sb-access-token'] || null

    // Extract locale from request
    const acceptLang = req.headers.get('accept-language') || ''
    const localeCookie = cookieMap['NEXT_LOCALE'] || ''
    const chatLocale = localeCookie || (acceptLang.startsWith('de') ? 'de' : acceptLang.startsWith('es') ? 'es' : 'en')

    // Resolve user ID and tier from Supabase auth token (if logged in)
    let chatUserId: string | null = null
    let chatUserTier: UserTier = 'anonymous'
    let userContextData: string | null = null
    // User-scoped client for conversation/message writes (uses JWT → enforces RLS)
    // Anonymous sessions fall back to service key (service_role policy allows writes)
    let writeClient = supabase
    if (sbAccessToken) {
      const { data: { user } } = await supabase.auth.getUser(sbAccessToken)
      chatUserId = user?.id || null
      if (chatUserId) {
        // Create user-scoped client for authenticated writes (#42)
        writeClient = createUserScopedClient(sbAccessToken)
        const { data: profile } = await supabase
          .from('users')
          .select('tier, subscription_period_end, subscription_status, name')
          .eq('id', chatUserId)
          .single()
        chatUserTier = (profile?.tier as UserTier) || 'free'
        // Treat expired premium subscriptions as free tier (#50)
        if (
          chatUserTier === 'premium' &&
          (profile?.subscription_status !== 'active' ||
            (profile?.subscription_period_end && new Date(profile.subscription_period_end) < new Date()))
        ) {
          chatUserTier = 'free'
        }

        // Build user context for system prompt — parallel queries, non-blocking
        const [cartResult, wishlistResult] = await Promise.allSettled([
          supabase
            .from('cart_items')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', chatUserId),
          supabase
            .from('wishlists')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', chatUserId),
        ])

        const cartCount = cartResult.status === 'fulfilled' ? (cartResult.value.count ?? 0) : 0
        const wishlistCount = wishlistResult.status === 'fulfilled' ? (wishlistResult.value.count ?? 0) : 0

        if (profile?.name) {
          userContextData = `\nUSER: ${profile.name} | Tier: ${chatUserTier} | Cart: ${cartCount} item(s) | Wishlists: ${wishlistCount}`
        } else {
          userContextData = `\nUSER: Logged in | Tier: ${chatUserTier} | Cart: ${cartCount} item(s) | Wishlists: ${wishlistCount}`
        }
      }
    }

    // Build identifier: prefer fingerprint for anonymous users, then IP
    const chatIdentifier = chatUserId || (fpId ? `fp:${fpId}` : `ip:${ip}`)

    // Active block check (auto-blocked by anomaly monitor)
    if (isBlocked(chatIdentifier)) {
      return Response.json(
        { error: 'Temporarily blocked due to suspicious activity. Try again later.', code: 'BLOCKED' },
        { status: 429 }
      )
    }

    // Velocity check (anti-bot: 5+ msgs in <3s)
    if (!checkVelocity(chatIdentifier)) {
      return Response.json(
        { error: 'Too many requests too quickly. Try again later.', code: 'VELOCITY_BLOCK' },
        { status: 429 }
      )
    }

    // Concurrent request limit (max 2 streaming requests per identifier)
    if (!acquireSlot(chatIdentifier, 2)) {
      return Response.json(
        { error: 'Too many concurrent requests. Please wait for the current response to finish.', code: 'CONCURRENT_LIMIT' },
        { status: 429 }
      )
    }

    try {
    // Per-tier daily usage check (conversations)
    const usageResult = await checkAndIncrementUsage(chatIdentifier, 'chat', chatUserTier, chatUserId || undefined)
    if (!usageResult.allowed) {
      return Response.json(
        {
          error: chatUserId
            ? 'Daily chat limit reached. Upgrade for more.'
            : 'Daily chat limit reached. Sign up for more.',
          usage: usageResult,
          code: 'LIMIT_REACHED',
        },
        { status: 429, headers: usageHeaders(usageResult) }
      )
    }

    // Per-tier daily message limit (total messages across all conversations)
    const msgUsage = await checkAndIncrementUsage(chatIdentifier, 'chat:messages', chatUserTier, chatUserId || undefined)
    if (!msgUsage.allowed) {
      trackRateLimitHit(chatIdentifier)
      return Response.json(
        {
          error: chatUserId
            ? 'Daily message limit reached. Upgrade for more.'
            : 'Daily message limit reached. Sign up for more.',
          usage: msgUsage,
          code: 'LIMIT_REACHED',
        },
        { status: 429, headers: usageHeaders(msgUsage) }
      )
    }

    // Anomaly detection: check if user is consuming too fast
    const chatLimitConfig = USAGE_TIERS[chatUserTier]?.['chat:messages']
    const chatMsgLimit = chatLimitConfig ? chatLimitConfig.limit : 0
    if (chatMsgLimit > 0) {
      checkAnomaly(chatIdentifier, 'chat:messages', msgUsage.current, chatMsgLimit).catch(() => {})
    }

    // Daily token budget pre-check
    const tokenBudget = await checkTokenBudget(chatIdentifier, chatUserTier)
    if (!tokenBudget.allowed) {
      trackRateLimitHit(chatIdentifier)
      return Response.json(
        {
          error: 'Daily token budget exhausted. Try again tomorrow.',
          code: 'TOKEN_LIMIT',
        },
        { status: 429 }
      )
    }

    const body = await req.json()
    let { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: 'Invalid request: messages array required' },
        { status: 400 }
      )
    }

    // Input validation: max message length
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'user') {
      const textContent = typeof lastMsg.content === 'string'
        ? lastMsg.content
        : Array.isArray(lastMsg.parts)
          ? lastMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ')
          : ''
      if (textContent.length > MAX_MESSAGE_CHARS) {
        return Response.json(
          { error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)` },
          { status: 400 }
        )
      }
    }

    // Sliding window: cap context to prevent input token inflation
    if (messages.length > MAX_CONTEXT_MESSAGES) {
      messages = [messages[0], ...messages.slice(-MAX_CONTEXT_MESSAGES + 1)]
    }

    // --- Conversation Persistence ---
    const conversationId = req.headers.get('x-conversation-id') || crypto.randomUUID()
    const sessionId = req.headers.get('x-session-id') || cartSessionId || crypto.randomUUID()

    // Upsert conversation record (fire-and-forget, non-blocking)
    // Uses writeClient: user-scoped JWT for authenticated users, service key for anonymous
    ;(async () => {
      try {
        await writeClient.from('conversations').upsert({
          id: conversationId,
          user_id: chatUserId || null,
          session_id: sessionId,
          model: 'gemini-2.5-flash',
          locale: chatLocale,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
      } catch (err) {
        console.error('Conversation upsert error (non-critical):', err)
      }
    })()

    // Save the latest user message (fire-and-forget)
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage?.role === 'user') {
      const userContent = extractTextContent(lastUserMessage)

      ;(async () => {
        try {
          // Use writeClient (user JWT for authenticated, service key for anonymous)
          await writeClient.from('messages').insert({
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            role: 'user',
            content: userContent,
            created_at: new Date().toISOString(),
          })
        } catch (err) {
          console.error('User message save error (non-critical):', err)
        }
      })()
    }

    // Prompt safety check on user message
    const lastUserText = lastUserMessage?.role === 'user'
      ? extractTextContent(lastUserMessage)
      : ''
    if (lastUserText) {
      const safetyCheck = checkPromptSafety(lastUserText)
      if (!safetyCheck.safe) {
        return new Response(JSON.stringify({
          error: 'Message flagged by content filter',
          reason: safetyCheck.reason
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Load FAQ context for CAG (Context-Augmented Generation) if available
    const faqContext = await loadFAQContext(chatLocale)

    // RAG Pipeline Integration
    const ragContext = await searchProductContext({
      messages,
      lastUserText,
      chatLocale,
      cookieHeader,
    })

    // Build the full system prompt
    const enhancedSystemPrompt = buildSystemPrompt(chatLocale, faqContext, ragContext, null, userContextData)

    // Build tools
    const tools = getChatTools({
      supabase,
      chatUserId,
      chatUserTier,
      chatLocale,
      cartSessionId,
      fpId,
      ip,
    })

    // Convert UIMessage format (with parts array) to CoreMessage format (with content string)
    // This is needed because useChat sends UIMessage but streamText expects CoreMessage
    const convertedMessages = await convertToModelMessages(messages, { tools })

    // Stream response with tools
    // Using gemini-2.5-flash (latest stable as of June 2025)
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: enhancedSystemPrompt,
      messages: convertedMessages,
      tools,
      maxOutputTokens: TOKEN_BUDGET[chatUserTier],
      stopWhen: stepCountIs(chatUserTier === 'premium' ? 5 : 3),
      onFinish: createOnFinishCallback({
        writeClient,
        conversationId,
        chatIdentifier,
        chatUserTier,
        messages,
      }),
    })

    // Return streaming SSE response with conversation ID header
    return result.toUIMessageStreamResponse({
      headers: {
        'x-conversation-id': conversationId,
      },
    })
    } finally {
      // Always release the concurrent slot
      releaseSlot(chatIdentifier)
    }
  } catch (error) {
    console.error('Chat API error:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return Response.json(
      {
        error: 'Internal server error',
        details: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
