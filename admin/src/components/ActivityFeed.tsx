'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiUrl } from '@/lib/admin-api';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShoppingCart,
  AlertCircle,
  UserPlus,
  Bot,
  CheckCircle,
  XCircle,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityEvent {
  type: string;
  timestamp: number;
  actor?: string;
  action?: string;
  orderId?: string;
  agentName?: string;
  error?: string;
  customerEmail?: string;
  message?: string;
  [key: string]: any;
}

// Get icon component for event type
function getEventIcon(eventType: string) {
  if (eventType.startsWith('order.')) {
    return <ShoppingCart className="h-4 w-4" />;
  }
  if (eventType.startsWith('agent.')) {
    return <Bot className="h-4 w-4" />;
  }
  if (eventType.startsWith('error.')) {
    return <AlertCircle className="h-4 w-4" />;
  }
  if (eventType.startsWith('customer.')) {
    return <UserPlus className="h-4 w-4" />;
  }
  return <Activity className="h-4 w-4" />;
}

// Get icon color for event type
function getEventColor(eventType: string) {
  if (eventType.includes('created') || eventType.includes('completed') || eventType.includes('registered')) {
    return 'text-success';
  }
  if (eventType.includes('failed') || eventType.includes('error')) {
    return 'text-destructive';
  }
  if (eventType.includes('started') || eventType.includes('updated')) {
    return 'text-primary';
  }
  return 'text-muted-foreground';
}

// Format event message
function formatEventMessage(event: ActivityEvent): { actor: string; action: string } {
  switch (event.type) {
    case 'order.created':
      return {
        actor: event.customerEmail || 'Customer',
        action: `placed order ${event.orderId?.slice(0, 8) || ''}`,
      };
    case 'order.updated':
      return {
        actor: 'System',
        action: `updated order ${event.orderId?.slice(0, 8) || ''} to ${event.status || 'new status'}`,
      };
    case 'agent.run.started':
      return {
        actor: event.agentName || 'Agent',
        action: 'started processing',
      };
    case 'agent.run.completed':
      return {
        actor: event.agentName || 'Agent',
        action: 'completed successfully',
      };
    case 'agent.run.failed':
      return {
        actor: event.agentName || 'Agent',
        action: `failed: ${event.error || 'unknown error'}`,
      };
    case 'error.logged':
      return {
        actor: 'System',
        action: `error: ${event.message || event.error || 'unknown'}`,
      };
    case 'customer.registered':
      return {
        actor: event.customerEmail || 'New customer',
        action: 'registered',
      };
    case 'connected':
      return {
        actor: 'System',
        action: 'connected to activity feed',
      };
    default:
      return {
        actor: event.actor || 'System',
        action: event.action || event.type,
      };
  }
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      // Connect to SSE endpoint
      eventSource = new EventSource(apiUrl('/api/dashboard/activity-feed'));

      eventSource.onopen = () => {
        console.log('[ActivityFeed] SSE connection opened');
        setIsConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as ActivityEvent;
          console.log('[ActivityFeed] Received event:', event);

          // Add new event to the top of the list
          setEvents((prev) => [event, ...prev].slice(0, 50)); // Keep last 50 events
        } catch (err) {
          console.error('[ActivityFeed] Failed to parse event:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('[ActivityFeed] SSE error:', err);
        setIsConnected(false);

        // EventSource automatically reconnects, but we can track the state
        if (eventSource?.readyState === EventSource.CLOSED) {
          console.log('[ActivityFeed] Connection closed');
        }
      };
    } catch (err) {
      console.error('[ActivityFeed] Failed to create EventSource:', err);
    }

    // Cleanup
    return () => {
      if (eventSource) {
        console.log('[ActivityFeed] Closing SSE connection');
        eventSource.close();
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
            {isConnected ? (
              <>
                <Activity className="h-3 w-3 mr-1 animate-pulse" />
                Live
              </>
            ) : (
              'Connecting...'
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {isConnected ? 'Waiting for activity...' : 'Connecting to activity feed...'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event, index) => {
                const { actor, action } = formatEventMessage(event);
                const Icon = getEventIcon(event.type);
                const iconColor = getEventColor(event.type);

                return (
                  <div
                    key={`${event.timestamp}-${index}`}
                    className="flex gap-3 items-start border-b pb-3 last:border-0"
                  >
                    <div className={`mt-0.5 ${iconColor}`}>{Icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{actor}</span>{' '}
                        <span className="text-muted-foreground">{action}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
