import dynamic from 'next/dynamic'

const ChatArea = dynamic(() => import('@/components/storefront/ChatArea').then(mod => ({ default: mod.ChatArea })), {
  ssr: true,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse text-muted-foreground">Loading chat...</div>
    </div>
  ),
})

/**
 * Homepage - Conversational Storefront (Primary Interface)
 *
 * The chat IS the homepage. The AppShell layout (sidebar + header + detail panel)
 * wraps this page automatically via the (app) route group layout.
 *
 * Uses dynamic import for ChatArea to reduce main bundle size.
 */
export default function HomePage() {
  return <ChatArea />
}
