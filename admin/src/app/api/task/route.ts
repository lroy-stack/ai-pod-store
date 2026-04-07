import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

/**
 * POST /api/task
 *
 * Classifies a user message to determine which PodClaw agents should handle the task.
 *
 * Returns an array of agent names that are relevant to the user's message.
 */

interface TaskClassificationRequest {
  message: string
}

interface TaskClassificationResponse {
  agents: string[]
  reasoning?: string
}

// Agent definitions with their responsibilities
const AGENT_CAPABILITIES = {
  researcher: {
    keywords: ['research', 'trends', 'market', 'analysis', 'competitor', 'opportunities', 'insights', 'data'],
    description: 'Market research, trend analysis, and opportunity identification',
  },
  marketing: {
    keywords: ['marketing', 'campaign', 'promotion', 'social', 'content', 'email', 'seo', 'advertising'],
    description: 'Marketing campaigns, social media, and promotional content',
  },
  designer: {
    keywords: ['design', 'image', 'graphic', 'mockup', 'visual', 'create', 'art', 'logo', 'template'],
    description: 'Product design, image generation, and visual creation',
  },
  newsletter: {
    keywords: ['newsletter', 'email', 'subscribers', 'announcement', 'broadcast'],
    description: 'Newsletter creation and email marketing',
  },
  cataloger: {
    keywords: ['product', 'catalog', 'create product', 'upload', 'publish', 'inventory', 'add product', 'new product'],
    description: 'Product creation, catalog management, and inventory',
  },
  customer_manager: {
    keywords: ['customer', 'support', 'refund', 'complaint', 'service', 'help', 'issue', 'problem'],
    description: 'Customer support, refunds, and issue resolution',
  },
  seo_manager: {
    keywords: ['seo', 'search', 'ranking', 'keywords', 'optimization', 'google', 'visibility'],
    description: 'SEO optimization and search engine ranking',
  },
  finance: {
    keywords: ['revenue', 'sales', 'profit', 'finance', 'pricing', 'cost', 'earnings', 'money'],
    description: 'Financial analysis, revenue tracking, and pricing',
  },
  qa_inspector: {
    keywords: ['quality', 'test', 'check', 'verify', 'inspect', 'review', 'audit'],
    description: 'Quality assurance and product verification',
  },
  brand_manager: {
    keywords: ['brand', 'identity', 'consistency', 'guidelines', 'style', 'voice', 'tone'],
    description: 'Brand management and consistency',
  },
} as const

export const POST = withAuth(async (request: NextRequest, session: unknown) => {
  try {
    const body: TaskClassificationRequest = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Classify the message
    const selectedAgents = classifyMessage(message.toLowerCase())

    // If no specific agents matched, default to researcher as a general-purpose agent
    if (selectedAgents.length === 0) {
      selectedAgents.push('researcher')
    }

    const response: TaskClassificationResponse = {
      agents: selectedAgents,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Task classification error:', error)
    return NextResponse.json(
      { error: 'Failed to classify task' },
      { status: 500 }
    )
  }
})

function classifyMessage(message: string): string[] {
  const agents = new Set<string>()

  // Check each agent's keywords
  for (const [agent, config] of Object.entries(AGENT_CAPABILITIES)) {
    for (const keyword of config.keywords) {
      if (message.includes(keyword)) {
        agents.add(agent)
        break // Once matched, no need to check other keywords for this agent
      }
    }
  }

  return Array.from(agents)
}
