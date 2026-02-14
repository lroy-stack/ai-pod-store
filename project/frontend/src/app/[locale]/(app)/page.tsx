import { ChatArea } from '@/components/storefront/ChatArea'

/**
 * Homepage - Conversational Storefront (Primary Interface)
 *
 * The chat IS the homepage. The AppShell layout (sidebar + header + detail panel)
 * wraps this page automatically via the (app) route group layout.
 */
export default function HomePage() {
  return <ChatArea />
}
