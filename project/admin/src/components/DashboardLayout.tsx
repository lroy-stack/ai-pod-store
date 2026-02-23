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

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { collapsed } = useSidebarCollapsed();

  return (
    <div className="flex min-h-screen">
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
              <h1 className="text-lg font-bold">POD AI Admin</h1>
            </div>
            {/* Mobile TopBar (notification bell only) */}
            <TopBar />
          </div>
        </div>

        {/* Page Content with Breadcrumbs */}
        <div className="p-4 md:p-6 lg:p-8">
          <Breadcrumbs />
          {children}
        </div>
      </div>
    </div>
  );
}
