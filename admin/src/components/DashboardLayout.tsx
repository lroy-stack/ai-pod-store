'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { TopBar } from './TopBar';
import { Menu } from 'lucide-react';
import { Button } from './ui/button';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
import { cn } from '@/lib/utils';
import { STORE_NAME } from '@/lib/store-defaults';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { collapsed } = useSidebarCollapsed();

  return (
    <div className="flex min-h-screen">
      {/* Skip to main content link for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Sheet */}
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

      {/* Main Content */}
      <div className={cn('flex-1 transition-all duration-300', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        {/* TopBar - desktop only */}
        <div className="hidden lg:block sticky top-0 z-40">
          <TopBar />
        </div>

        {/* Mobile Header with Menu Button */}
        <div className="lg:hidden sticky top-0 z-40 bg-background border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(true)}
                className="p-3 min-h-[44px] min-w-[44px]"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
              <h1 className="text-lg font-bold">{STORE_NAME} Admin</h1>
            </div>
            {/* Mobile TopBar (notification bell only) */}
            <TopBar />
          </div>
        </div>

        {/* Page Content with Breadcrumbs */}
        <main id="main-content" className="p-4 md:p-6 lg:p-8">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
