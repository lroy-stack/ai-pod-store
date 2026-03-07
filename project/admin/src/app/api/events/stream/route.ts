import { NextRequest } from 'next/server';
import { sseEmitter } from '@/lib/sse-emitter';
import { withAuth } from '@/lib/auth-middleware';
import type { SessionData } from '@/lib/session';

// SSE stream for admin notifications.
// Supported event types:
//   new_order       — new order received
//   agent_cycle     — PodClaw agent cycle completed
//   error_alert     — generic system error
//   alert           — generic warning
//   sync_error      — Printful/provider sync failure
//   webhook_failed  — webhook delivery failure
//   margin_alert    — product margin below threshold
//   integrity_issue — data integrity problem detected
//   notification    — generic notification object

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(async (req: NextRequest, _session: SessionData): Promise<any> => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `event: connected\ndata: ${JSON.stringify({ timestamp: Date.now(), message: 'SSE stream connected' })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Heartbeat every 30s to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Subscribe to in-memory event emitter
      const unsubscribe = sseEmitter.subscribe((event, data) => {
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          console.error('[SSE] Failed to send event:', err);
        }
      });

      // Cleanup on connection close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
