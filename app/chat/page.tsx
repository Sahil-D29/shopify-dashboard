'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatInbox } from '@/components/chat/ChatInbox';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatContactSidebar } from '@/components/chat/ChatContactSidebar';
import { MessageInput } from '@/components/chat/MessageInput';
import { EmptyState } from '@/components/chat/EmptyState';
import { AssignmentDropdown } from '@/components/chat/AssignmentDropdown';
import { TemplatePicker } from '@/components/chat/TemplatePicker';
import { useConversation } from '@/lib/hooks/useChat';
import { useSSE } from '@/lib/hooks/useSSE';
import type { SSEEvent } from '@/lib/types/chat';
import { useQueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

function ChatPageInner() {
  const { data: session } = useSession();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showAssignment, setShowAssignment] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const qc = useQueryClient();

  // Load storeId from cookie/header
  useEffect(() => {
    const fetchStoreId = async () => {
      try {
        const res = await fetch('/api/tenant/current');
        if (res.ok) {
          const data = await res.json();
          setStoreId(data.storeId || null);
        }
      } catch {
        // Fallback
      }
    };
    fetchStoreId();
  }, []);

  const { data: convData } = useConversation(activeConversationId);
  const conversation = convData?.conversation;

  // SSE for real-time updates
  useSSE({
    storeId,
    onMessage: useCallback((event: SSEEvent) => {
      // Invalidate relevant queries on new events
      if (event.type === 'new_message' || event.type === 'conversation_update') {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        if (event.data.conversationId) {
          qc.invalidateQueries({ queryKey: ['messages', event.data.conversationId] });
          qc.invalidateQueries({ queryKey: ['conversation', event.data.conversationId] });
        }
      }
      if (event.type === 'status_update' && event.data.conversationId) {
        qc.invalidateQueries({ queryKey: ['messages', event.data.conversationId] });
      }
    }, [qc]),
  });

  // Mark conversation as read when selected
  useEffect(() => {
    if (!activeConversationId) return;
    // Reset unread count via API
    fetch(`/api/chat/conversations/${activeConversationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unreadCount: 0 }),
    }).catch(() => {});
  }, [activeConversationId]);

  return (
    <div className="flex h-full">
      {/* Left: Inbox */}
      <ChatInbox
        storeId={storeId}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
      />

      {/* Center: Chat */}
      <div className="flex flex-1 flex-col min-w-0">
        {conversation ? (
          <>
            <ChatHeader
              conversation={conversation}
              onToggleSidebar={() => setShowSidebar(!showSidebar)}
              showSidebar={showSidebar}
              onAssign={() => setShowAssignment(true)}
            />
            <ChatWindow conversationId={activeConversationId} />
            <MessageInput
              conversationId={activeConversationId}
              storeId={storeId}
              onTemplatePick={() => setShowTemplatePicker(true)}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Right: Contact Sidebar */}
      {showSidebar && conversation && (
        <ChatContactSidebar conversation={conversation} />
      )}

      {/* Modals */}
      {showAssignment && conversation && (
        <AssignmentDropdown
          conversationId={conversation.id}
          currentAssignee={conversation.assignedTo}
          onClose={() => setShowAssignment(false)}
        />
      )}

      {showTemplatePicker && conversation && (
        <TemplatePicker
          conversationId={conversation.id}
          contactId={conversation.contactId}
          onClose={() => setShowTemplatePicker(false)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ['messages', conversation.id] });
          }}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <ChatPageInner />
    </QueryClientProvider>
  );
}
