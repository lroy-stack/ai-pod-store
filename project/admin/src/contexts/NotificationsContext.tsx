'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'order' | 'agent' | 'alert' | 'info';
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
      await fetch('/api/admin/notifications/mark-all-read', {
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
        const res = await fetch('/api/admin/notifications');
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
    const eventSource = new EventSource('/api/events/stream');

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
