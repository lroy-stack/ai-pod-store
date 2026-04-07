'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import { Bell, Search, LogOut, Settings, ChevronDown } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ThemeToggle } from './ThemeToggle';
import { KeyboardShortcutsButton } from './KeyboardShortcutsHelp';
import { useNotifications } from '@/contexts/NotificationsContext';

export function TopBar() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = useCallback(async () => {
    await adminFetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }, [router]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    if (dropdownOpen || userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen, userMenuOpen]);

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  const handleSearchClick = () => {
    // Trigger the command palette
    const trigger = document.getElementById('command-palette-trigger');
    if (trigger) {
      trigger.click();
    }
  };

  return (
    <nav className="border-b bg-card">
      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        <div className="flex-1" />

        <div className="flex items-center gap-4">
          {/* Search Button (Mobile) */}
          <Button
            variant="ghost"
            size="sm"
            className="p-3 md:hidden min-h-[44px] min-w-[44px]"
            onClick={handleSearchClick}
            aria-label="Open search"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Keyboard Shortcuts Help */}
          <KeyboardShortcutsButton />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notification Bell */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              size="sm"
              className="relative p-3 min-h-[44px] min-w-[44px]"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
              <span className="sr-only">Notifications</span>
            </Button>

            {/* Dropdown */}
            {dropdownOpen && (
              <Card className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] shadow-lg z-50">
                <div className="flex items-center justify-between p-3 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllRead}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No notifications
                    </div>
                  ) : (
                    <>
                      {/* Group notifications by type */}
                      {(['order', 'agent', 'alert', 'info'] as const).map((type) => {
                        const typeNotifications = notifications.filter((n) => n.type === type);
                        if (typeNotifications.length === 0) return null;

                        const typeLabels = {
                          order: 'Orders',
                          agent: 'Agent Updates',
                          alert: 'Alerts',
                          info: 'Info',
                        };

                        return (
                          <div key={type}>
                            <div className="px-3 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {typeLabels[type]} ({typeNotifications.length})
                            </div>
                            {typeNotifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`flex flex-col items-start p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 ${
                                  !notification.read ? 'bg-muted/30' : ''
                                }`}
                              >
                                <div className="font-medium text-sm">
                                  {notification.title}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {notification.message}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {new Date(notification.timestamp).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Admin User Menu */}
          <div className="relative" ref={userMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 px-3 min-h-[44px]"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <span className="hidden md:inline text-sm font-medium">Admin</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {userMenuOpen && (
              <Card className="absolute right-0 top-full mt-2 w-48 max-w-[calc(100vw-2rem)] shadow-lg z-50 py-1">
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                  onClick={() => { setUserMenuOpen(false); router.push('/settings'); }}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <div className="border-t my-1" />
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
