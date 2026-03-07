'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { adminFetch, apiUrl } from '@/lib/admin-api';

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

    // Connect to SSE stream for real-time updates
    const eventSource = new EventSource(apiUrl('/api/events/stream'));

    eventSource.addEventListener('connected', () => {
      console.log('[SSE] Connected to notification stream');
    });

    eventSource.addEventListener('notification', (event) => {
      try {
        const notification = JSON.parse(event.data);
        addNotification(notification);
      } catch (error) {
        console.error('[SSE] Failed to parse notification:', error);
      }
    });

    eventSource.addEventListener('order', (event) => {
      try {
        const data = JSON.parse(event.data);
        const notification: Notification = {
          id: `order-${data.id || Date.now()}`,
          title: 'New Order',
          message: data.message || `Order #${data.order_number || data.id} received`,
          timestamp: data.timestamp || new Date().toISOString(),
          read: false,
          type: 'order',
        };
        addNotification(notification);
      } catch (error) {
        console.error('[SSE] Failed to parse order event:', error);
      }
    });

    eventSource.addEventListener('agent', (event) => {
      try {
        const data = JSON.parse(event.data);
        const notification: Notification = {
          id: `agent-${data.id || Date.now()}`,
          title: 'Agent Update',
          message: data.message || 'Agent cycle completed',
          timestamp: data.timestamp || new Date().toISOString(),
          read: false,
          type: 'agent',
        };
        addNotification(notification);
      } catch (error) {
        console.error('[SSE] Failed to parse agent event:', error);
      }
    });

    // Handle sync error events
    eventSource.addEventListener('sync_error', (event) => {
      try {
        const data = JSON.parse(event.data);
        const notification: Notification = {
          id: `sync_error-${Date.now()}`,
          title: 'Sync Error',
          message: data.message || 'Sync operation failed',
          timestamp: data.timestamp || new Date().toISOString(),
          read: false,
          type: 'sync_error',
        };
        addNotification(notification);
      } catch (error) {
        console.error('[SSE] Failed to parse sync_error event:', error);
      }
    });

    // Handle webhook failure events
    eventSource.addEventListener('webhook_failed', (event) => {
      try {
        const data = JSON.parse(event.data);
        const notification: Notification = {
          id: `webhook_failed-${Date.now()}`,
          title: 'Webhook Failed',
          message: data.message || `Webhook delivery failed${data.event_type ? `: ${data.event_type}` : ''}`,
          timestamp: data.timestamp || new Date().toISOString(),
          read: false,
          type: 'webhook_failed',
        };
        addNotification(notification);
      } catch (error) {
        console.error('[SSE] Failed to parse webhook_failed event:', error);
      }
    });

    // Handle margin alert events
    eventSource.addEventListener('margin_alert', (event) => {
      try {
        const data = JSON.parse(event.data);
        const notification: Notification = {
          id: `margin_alert-${Date.now()}`,
          title: 'Margin Alert',
          message: data.message || `Product margin below threshold${data.product_name ? `: ${data.product_name}` : ''}`,
          timestamp: data.timestamp || new Date().toISOString(),
          read: false,
          type: 'margin_alert',
        };
        addNotification(notification);
      } catch (error) {
        console.error('[SSE] Failed to parse margin_alert event:', error);
      }
    });

    // Handle integrity issue events
    eventSource.addEventListener('integrity_issue', (event) => {
      try {
        const data = JSON.parse(event.data);
        const notification: Notification = {
          id: `integrity_issue-${Date.now()}`,
          title: 'Integrity Issue',
          message: data.message || 'Data integrity issue detected',
          timestamp: data.timestamp || new Date().toISOString(),
          read: false,
          type: 'integrity_issue',
        };
        addNotification(notification);
      } catch (error) {
        console.error('[SSE] Failed to parse integrity_issue event:', error);
      }
    });

    eventSource.addEventListener('error', () => {
      console.error('[SSE] Connection error, will retry automatically');
    });

    return () => {
      eventSource.close();
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
