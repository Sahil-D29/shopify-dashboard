export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get('storeId');

  if (!storeId) {
    return new Response(JSON.stringify({ error: 'Store ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let lastCheck = new Date();
  const startTime = Date.now();
  const MAX_DURATION = 55_000; // 55 seconds (Render 60s timeout)
  const POLL_INTERVAL = 3_000; // 3 seconds
  const HEARTBEAT_INTERVAL = 15_000; // 15 seconds
  let lastHeartbeat = Date.now();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Send initial connected event
      sendEvent('connected', { storeId, timestamp: new Date().toISOString() });

      const poll = async () => {
        if (closed) return;

        // Check if max duration exceeded
        if (Date.now() - startTime >= MAX_DURATION) {
          sendEvent('timeout', { message: 'Connection closing, please reconnect' });
          try {
            controller.close();
          } catch {
            // Already closed
          }
          closed = true;
          return;
        }

        try {
          // Query for new messages since last check
          const newMessages = await prisma.message.findMany({
            where: {
              conversation: { storeId },
              createdAt: { gt: lastCheck },
            },
            include: {
              conversation: {
                select: { id: true, contactId: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          });

          // Query for conversation updates since last check
          const updatedConversations = await prisma.conversation.findMany({
            where: {
              storeId,
              updatedAt: { gt: lastCheck },
            },
            select: {
              id: true,
              contactId: true,
              status: true,
              unreadCount: true,
              lastMessageAt: true,
              updatedAt: true,
            },
          });

          const now = new Date();

          if (newMessages.length > 0) {
            sendEvent('new_messages', newMessages);
          }

          if (updatedConversations.length > 0) {
            sendEvent('conversation_updates', updatedConversations);
          }

          lastCheck = now;

          // Send heartbeat if needed
          if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
            sendEvent('heartbeat', { timestamp: now.toISOString() });
            lastHeartbeat = Date.now();
          }
        } catch (error) {
          console.error('[SSE] Poll error:', error);
        }

        // Schedule next poll
        if (!closed) {
          setTimeout(poll, POLL_INTERVAL);
        }
      };

      // Start polling
      setTimeout(poll, POLL_INTERVAL);
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
