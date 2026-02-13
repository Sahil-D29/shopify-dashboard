'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useMessages } from '@/lib/hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import type { Message } from '@/lib/types/chat';

interface ChatWindowProps {
  conversationId: string | null;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessages(conversationId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Flatten all pages of messages, reverse so oldest first
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    const all: Message[] = [];
    for (const page of data.pages) {
      all.push(...page.messages);
    }
    // API returns newest first, we display oldest first
    return all.reverse();
  }, [data]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on conversation change
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [conversationId]);

  // Load more on scroll to top
  const handleScroll = () => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;
    if (scrollRef.current.scrollTop < 100) {
      fetchNextPage();
    }
  };

  if (!conversationId) return null;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { date: Date; messages: Message[] }[] = [];
  for (const msg of messages) {
    const msgDate = new Date(msg.createdAt);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && isSameDay(lastGroup.date, msgDate)) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date: msgDate, messages: [msg] });
    }
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4"
      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e5e7eb\' fill-opacity=\'0.3\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
    >
      {/* Load more indicator */}
      {isFetchingNextPage && (
        <div className="flex justify-center pb-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-sm text-gray-500">No messages yet. Send a message to start the conversation.</p>
        </div>
      )}

      {/* Messages grouped by date */}
      <div className="space-y-4">
        {groupedMessages.map((group, gi) => (
          <div key={gi}>
            {/* Date separator */}
            <div className="flex items-center justify-center py-2">
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-gray-500 shadow-sm border">
                {formatDateLabel(group.date)}
              </span>
            </div>
            {/* Messages for this date */}
            <div className="space-y-1.5">
              {group.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}

function formatDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}
