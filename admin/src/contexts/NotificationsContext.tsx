'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { adminFetch } from '@/lib/admin-api';

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'order' | 'agent' | 'alert' | 'info' | 'sync_error' | 'webhook_failed' | 'margin_alert' | 'integrity_issue';
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadByType: Record<string, number>;
  addNotification: (notification: Notification) => void;
  markAllRead: () => void;
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Calculate unread counts by type
  const unreadByType = notifications.reduce((acc, n) => {
    if (!n.read) {
      acc[n.type] = (acc[n.type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const addNotification = (notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);
    if (!notification.read) {
      setUnreadCount((prev) => prev + 1);
    }
  };

  const markAllRead = async () => {
    try {
      await adminFetch('/api/admin/notifications/mark-all-read', {
        method: 'POST',
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Fetch initial notifications
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await adminFetch('/api/admin/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unread_count || 0);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    }

    fetchNotifications();

    // Listen to SSE events dispatched by SSEProvider (avoids duplicate EventSource)
    const EVENT_TYPE_MAP: Record<string, { title: string; type: Notification['type'] }> = {
      new_order: { title: 'New Order', type: 'order' },
      notification: { title: 'Notification', type: 'info' },
      agent_cycle: { title: 'Agent Update', type: 'agent' },
      error_alert: { title: 'Error', type: 'alert' },
      alert: { title: 'Alert', type: 'alert' },
      sync_error: { title: 'Sync Error', type: 'sync_error' },
      webhook_failed: { title: 'Webhook Failed', type: 'webhook_failed' },
      margin_alert: { title: 'Margin Alert', type: 'margin_alert' },
      integrity_issue: { title: 'Integrity Issue', type: 'integrity_issue' },
    };

    const handleSSEEvent = (e: Event) => {
      const { type, data } = (e as CustomEvent).detail;
      const mapping = EVENT_TYPE_MAP[type];
      if (!mapping) return;

      // If it's a pre-formed notification, use it directly
      if (type === 'notification' && data.id && data.title) {
        addNotification(data as Notification);
        return;
      }

      const notification: Notification = {
        id: `${mapping.type}-${data.id || Date.now()}`,
        title: mapping.title,
        message: data.message || data.order_number
          ? `Order #${data.order_number || data.id} received`
          : `${mapping.title} event`,
        timestamp: data.timestamp || new Date().toISOString(),
        read: false,
        type: mapping.type,
      };
      addNotification(notification);
    };

    window.addEventListener('sse-event', handleSSEEvent);

    return () => {
      window.removeEventListener('sse-event', handleSSEEvent);
    };
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadByType,
        addNotification,
        markAllRead,
        setNotifications,
        setUnreadCount,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
