'use client'

/**
 * StorefrontLayout - AppShell for the conversational storefront
 *
 * Inspired by claude.ai — sidebar + contextual header + content area.
 * Used as the layout wrapper for all (app) route group pages.
 *
 * - Left sidebar (240px): Store navigation + AI recommendations
 * - Header: Search + notifications + cart + user avatar
 * - Center content (flex-1): Receives children (ChatArea, ShopPage, etc.)
 * - Right detail panel (340px): Expanded product details (conditional)
 *
 * Mobile: Sidebar collapses to Sheet drawer, detail panel stacks as overlay
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { StorefrontProvider, useStorefront } from './StorefrontContext'
import { ChatMessageProvider, useChatMessage } from './ChatMessageContext'
import { StorefrontSidebar } from './StorefrontSidebar'
import { StorefrontHeader } from './StorefrontHeader'
import { DetailPanel } from './DetailPanel'
import { Footer } from '@/components/Footer'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { cn } from '@/lib/utils'
import { OfflineBanner } from '@/components/OfflineBanner'
import { SubscriptionStatusBanner } from '@/components/SubscriptionStatusBanner'
import { InstallPrompt } from '@/components/engagement/InstallPrompt'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const WelcomePopup = dynamic(
  () => import('@/components/engagement/WelcomePopup').then((mod) => ({ default: mod.WelcomePopup })),
  { ssr: false }
)

const ChatArea = dynamic(
  () => import('@/components/storefront/ChatArea').then((mod) => ({ default: mod.ChatArea })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading chat...</div>
      </div>
    ),
  }
)

function StorefrontShell({ children }: { children: React.ReactNode }) {
  const { selectedProduct, setSelectedProduct, artifacts, clearArtifacts } =
    useStorefront()
  const { setPendingChatMessage } = useChatMessage()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggle: toggleDesktopSidebar } = useSidebarCollapsed()
  const pathname = usePathname()
  const params = useParams()
  const locale = params.locale as string
  const isChatPage = pathname === `/${locale}/chat` || pathname === `/${locale}/chat/`
  const t = useTranslations('common')

  const router = useRouter()

  const handleAskAbout = (question: string) => {
    setPendingChatMessage(question)
    if (!isChatPage) {
      router.push(`/${locale}/chat`)
    }
  }

  const handleClosePanel = () => {
    setSelectedProduct(null)
    clearArtifacts()
  }

  // Show detail panel if we have artifacts OR selectedProduct (backward compatibility)
  const showDetailPanel = artifacts.length > 0 || selectedProduct

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {/* Skip Navigation Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
      >
        {t('skipToContent')}
      </a>

      {/* Left Sidebar - Desktop */}
      <aside className={cn(
        "hidden lg:flex lg:flex-col border-r border-border transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:w-0 lg:overflow-hidden lg:border-r-0" : "lg:w-60"
      )}>
        <StorefrontSidebar onCollapse={toggleDesktopSidebar} />
      </aside>

      {/* Left Sidebar - Mobile (Sheet drawer) */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">{t('navigation')}</SheetTitle>
          <StorefrontSidebar onNavigate={() => setIsSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Center: Header + Content */}
      <main id="main-content" className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <StorefrontHeader
          onToggleSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleDesktopSidebar={toggleDesktopSidebar}
        />
        <OfflineBanner />
        <SubscriptionStatusBanner />
        {/* ChatArea always mounted — collapse to h-0 when hidden to preserve SSE/state */}
        <div className={cn(
          "flex flex-col min-h-0",
          isChatPage ? "flex-1" : "h-0 overflow-hidden pointer-events-none"
        )}>
          <ErrorBoundary>
            <ChatArea />
          </ErrorBoundary>
        </div>
        {!isChatPage && (
          <div className="flex flex-1 flex-col min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
            {children}
            <Footer />
          </div>
        )}
      </main>

      {/* Right Detail Panel - Desktop */}
      {showDetailPanel && (
        <aside className="hidden lg:flex lg:w-[340px] border-l border-border animate-in slide-in-from-right duration-300">
          <DetailPanel productId={selectedProduct || undefined} onClose={handleClosePanel} onAskAbout={handleAskAbout} />
        </aside>
      )}

      {/* Right Detail Panel - Mobile (full screen overlay) */}
      {showDetailPanel && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background animate-in slide-in-from-bottom duration-300">
          <DetailPanel productId={selectedProduct || undefined} onClose={handleClosePanel} onAskAbout={handleAskAbout} />
        </div>
      )}


      {/* PWA Install Prompt - appears after 3+ visits */}
      <InstallPrompt />

      {/* Welcome Popup - first visit to /chat without login */}
      {isChatPage && <WelcomePopup />}
    </div>
  )
}

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorefrontProvider>
      <ChatMessageProvider>
        <StorefrontShell>{children}</StorefrontShell>
      </ChatMessageProvider>
    </StorefrontProvider>
  )
}
