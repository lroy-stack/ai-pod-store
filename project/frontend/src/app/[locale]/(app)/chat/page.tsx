import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Chat — POD AI',
  description: 'Chat with our AI assistant to design custom print-on-demand products.',
}

/**
 * /chat — AI Chat Interface
 *
 * ChatArea lives in StorefrontLayout (always mounted, CSS visibility toggle).
 * This page renders null — the layout handles showing ChatArea when pathname is /chat.
 */
export default function ChatPage() {
  return null
}
