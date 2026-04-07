import { NextRequest } from 'next/server';
import { sseEmitter } from '@/lib/sse-emitter';
import { withAuth } from '@/lib/auth-middleware';

// SSE endpoint for dashboard activity feed
// Streams real-time events: orders, agent runs, errors
export const GET = withAuth(async (req, session) => {
  // Set SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Create a readable stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      const initialEvent = `data: ${JSON.stringify({
        type: 'connected',
        message: 'Activity feed connected',
        timestamp: Date.now(),
      })}

`;
      controller.enqueue(encoder.encode(initialEvent));

      // Subscribe to SSE events
      const unsubscribe = sseEmitter.subscribe((event: string, data: any) => {
        // Only forward relevant events to activity feed
        const relevantEvents = [
          'order.created',
          'order.updated',
          'agent.run.started',
          'agent.run.completed',
          'agent.run.failed',
          'error.logged',
          'customer.registered',
        ];

        if (relevantEvents.includes(event)) {
          const sseData = `data: ${JSON.stringify({
            type: event,
            ...data,
            timestamp: data.timestamp || Date.now(),
          })}

`;

          try {
            controller.enqueue(encoder.encode(sseData));
          } catch (err) {
            console.error('[ActivityFeed SSE] Failed to enqueue:', err);
          }
        }
      });

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (err) {
          console.error('[ActivityFeed SSE] Ping failed:', err);
          clearInterval(pingInterval);
        }
      }, 30000);

      // Cleanup on connection close
      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        unsubscribe();
        try {
          controller.close();
        } catch (err) {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, { headers });
});
