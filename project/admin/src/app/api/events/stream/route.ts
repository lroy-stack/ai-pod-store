import { NextRequest } from 'next/server';
import { sseEmitter } from '@/lib/sse-emitter';

// Simple SSE stream for admin notifications
// This endpoint provides real-time updates for:
// - New orders
// - Agent cycle completions
// - Critical alerts
// - Other admin events

function checkAdminAuth(req: NextRequest): boolean {
  const sessionCookie = req.cookies.get('admin-session');
  if (!sessionCookie) return false;

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    return sessionData.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Check authentication
  if (!checkAdminAuth(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `event: connected\ndata: ${JSON.stringify({ timestamp: Date.now(), message: 'SSE stream connected' })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Send heartbeat every 30 seconds to keep connection alive
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

      // In production, this would also subscribe to:
      // - Supabase Realtime for database changes
      // - Redis pub/sub for cross-instance notifications
      // - PodClaw bridge for agent events

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
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
