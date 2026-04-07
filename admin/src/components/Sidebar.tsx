'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NAV_SECTIONS, type NavSection, type NavItem } from '@/lib/nav-items';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
import { useNotifications } from '@/contexts/NotificationsContext';
import { STORE_NAME } from '@/lib/store-defaults';

const navigationSections = NAV_SECTIONS;

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const { unreadByType } = useNotifications();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen border-r bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && <h1 className="text-xl font-bold">{STORE_NAME}</h1>}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn('h-8 w-8', collapsed && 'mx-auto')}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <nav className={cn('flex flex-col gap-4', collapsed ? 'p-2' : 'p-4')}>
            {navigationSections.map((section, sectionIndex) => (
              <div key={section.label}>
                {sectionIndex > 0 && <Separator className="mb-4" />}
                <div className="mb-2">
                  {!collapsed && (
                    <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.label}
                    </h2>
                  )}
                  <div className="flex flex-col gap-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href;
                      const Icon = item.icon;

                      // Show badge for Orders if there are unread order notifications
                      const showBadge = item.name === 'Orders' && unreadByType.order > 0;
                      const badgeCount = unreadByType.order || 0;

                      const linkContent = (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors relative min-h-[44px]',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            collapsed && 'justify-center'
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="flex-1">{item.name}</span>
                              {showBadge && (
                                <Badge
                                  variant="destructive"
                                  className="h-5 min-w-[20px] flex items-center justify-center px-1 text-xs"
                                >
                                  {badgeCount > 9 ? '9+' : badgeCount}
                                </Badge>
                              )}
                            </>
                          )}
                          {collapsed && showBadge && (
                            <Badge
                              variant="destructive"
                              className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                            >
                              {badgeCount > 9 ? '9' : badgeCount}
                            </Badge>
                          )}
                        </Link>
                      );

                      if (collapsed) {
                        return (
                          <Tooltip key={item.name}>
                            <TooltipTrigger asChild>
                              {linkContent}
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p>{item.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      return linkContent;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}
