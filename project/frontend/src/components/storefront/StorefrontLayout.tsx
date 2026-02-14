'use client'

/**
 * StorefrontLayout - Three-panel conversational storefront layout
 *
 * Inspired by claude.ai, this layout consists of:
 * - Left sidebar (240px): Store navigation + AI recommendations
 * - Center chat area (flex-1): Message history + input
 * - Right detail panel (340px): Expanded product/design details
 *
 * Mobile: Sidebar collapses to Sheet drawer, detail panel stacks below
 */

import { useState } from 'react'
import { StorefrontSidebar } from './StorefrontSidebar'
import { ChatArea } from './ChatArea'
import { DetailPanel } from './DetailPanel'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

export function StorefrontLayout() {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r border-border">
        <StorefrontSidebar onSelectProduct={setSelectedProduct} />
      </aside>

      {/* Left Sidebar - Mobile (Sheet drawer) */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetTrigger asChild className="lg:hidden absolute top-4 left-4 z-50">
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <StorefrontSidebar onSelectProduct={(id) => {
            setSelectedProduct(id)
            setIsSidebarOpen(false)
          }} />
        </SheetContent>
      </Sheet>

      {/* Center Chat Area */}
      <main className="flex flex-1 flex-col min-w-0">
        <ChatArea onSelectProduct={setSelectedProduct} />
      </main>

      {/* Right Detail Panel - Desktop */}
      {selectedProduct && (
        <aside className="hidden lg:flex lg:w-[340px] border-l border-border">
          <DetailPanel
            productId={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        </aside>
      )}

      {/* Right Detail Panel - Mobile (full screen overlay) */}
      {selectedProduct && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background">
          <DetailPanel
            productId={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        </div>
      )}
    </div>
  )
}
