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
import { StorefrontProvider, useStorefront } from './StorefrontContext'
import { StorefrontSidebar } from './StorefrontSidebar'
import { StorefrontHeader } from './StorefrontHeader'
import { DetailPanel } from './DetailPanel'
import { Sheet, SheetContent } from '@/components/ui/sheet'

function StorefrontShell({ children }: { children: React.ReactNode }) {
  const { selectedProduct, setSelectedProduct, setPendingChatMessage } = useStorefront()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleAskAbout = (question: string) => {
    setPendingChatMessage(question)
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {/* Left Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r border-border">
        <StorefrontSidebar />
      </aside>

      {/* Left Sidebar - Mobile (Sheet drawer) */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <StorefrontSidebar onNavigate={() => setIsSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Center: Header + Content */}
      <main className="flex flex-1 flex-col min-w-0">
        <StorefrontHeader onToggleSidebar={() => setIsSidebarOpen(true)} />
        {children}
      </main>

      {/* Right Detail Panel - Desktop */}
      {selectedProduct && (
        <aside className="hidden lg:flex lg:w-[340px] border-l border-border">
          <DetailPanel
            productId={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAskAbout={handleAskAbout}
          />
        </aside>
      )}

      {/* Right Detail Panel - Mobile (full screen overlay) */}
      {selectedProduct && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background">
          <DetailPanel
            productId={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAskAbout={handleAskAbout}
          />
        </div>
      )}
    </div>
  )
}

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorefrontProvider>
      <StorefrontShell>{children}</StorefrontShell>
    </StorefrontProvider>
  )
}
