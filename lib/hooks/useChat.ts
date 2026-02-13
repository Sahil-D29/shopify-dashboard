'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type {
  Conversation,
  Message,
  InternalNote,
  QuickReply,
  AutoReplyRule,
  ChatFilters,
  SendMessageRequest,
} from '@/lib/types/chat';

const CHAT_KEYS = {
  conversations: (storeId: string, filters?: ChatFilters) => ['conversations', storeId, filters] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  notes: (conversationId: string) => ['notes', conversationId] as const,
  quickReplies: (storeId: string) => ['quickReplies', storeId] as const,
  autoReplies: (storeId: string) => ['autoReplies', storeId] as const,
  unreadCount: (storeId: string) => ['unreadCount', storeId] as const,
};

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ─── Conversations ───────────────────────────────────────────────

export function useConversations(storeId: string | null, filters?: ChatFilters) {
  return useQuery({
    queryKey: CHAT_KEYS.conversations(storeId || '', filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters?.assignedTo && filters.assignedTo !== 'ALL') params.set('assignedTo', filters.assignedTo);
      if (filters?.search) params.set('search', filters.search);
      const qs = params.toString();
      return fetchJSON<{ conversations: Conversation[]; total: number }>(
        `/api/chat/conversations${qs ? `?${qs}` : ''}`
      );
    },
    enabled: !!storeId,
    refetchInterval: 5000, // Poll every 5s as fallback
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: CHAT_KEYS.conversation(id || ''),
    queryFn: () => fetchJSON<{ conversation: Conversation }>(`/api/chat/conversations/${id}`),
    enabled: !!id,
  });
}

// ─── Messages ────────────────────────────────────────────────────

export function useMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: CHAT_KEYS.messages(conversationId || ''),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('before', pageParam);
      params.set('limit', '50');
      const qs = params.toString();
      return fetchJSON<{ messages: Message[]; hasMore: boolean; nextCursor: string | null }>(
        `/api/chat/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: !!conversationId,
  });
}

export function useSendMessage(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SendMessageRequest) =>
      fetchJSON<{ success: boolean; message?: Message; error?: string }>(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(conversationId) });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    },
  });
}

// ─── Notes ───────────────────────────────────────────────────────

export function useNotes(conversationId: string | null) {
  return useQuery({
    queryKey: CHAT_KEYS.notes(conversationId || ''),
    queryFn: () =>
      fetchJSON<{ notes: InternalNote[] }>(`/api/chat/conversations/${conversationId}/notes`),
    enabled: !!conversationId,
  });
}

export function useCreateNote(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { content: string }) =>
      fetchJSON<{ note: InternalNote }>(`/api/chat/conversations/${conversationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: CHAT_KEYS.notes(conversationId) });
      }
    },
  });
}

// ─── Quick Replies ───────────────────────────────────────────────

export function useQuickReplies(storeId: string | null) {
  return useQuery({
    queryKey: CHAT_KEYS.quickReplies(storeId || ''),
    queryFn: () => fetchJSON<{ quickReplies: QuickReply[] }>('/api/chat/quick-replies'),
    enabled: !!storeId,
  });
}

export function useCreateQuickReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { shortcut: string; title: string; content: string; category?: string }) =>
      fetchJSON<{ quickReply: QuickReply }>('/api/chat/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickReplies'] });
    },
  });
}

export function useDeleteQuickReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`/api/chat/quick-replies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickReplies'] });
    },
  });
}

// ─── Auto Reply Rules ────────────────────────────────────────────

export function useAutoReplies(storeId: string | null) {
  return useQuery({
    queryKey: CHAT_KEYS.autoReplies(storeId || ''),
    queryFn: () => fetchJSON<{ rules: AutoReplyRule[] }>('/api/chat/auto-replies'),
    enabled: !!storeId,
  });
}

export function useCreateAutoReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Partial<AutoReplyRule>) =>
      fetchJSON<{ rule: AutoReplyRule }>('/api/chat/auto-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoReplies'] });
    },
  });
}

export function useUpdateAutoReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AutoReplyRule> & { id: string }) =>
      fetchJSON<{ rule: AutoReplyRule }>(`/api/chat/auto-replies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoReplies'] });
    },
  });
}

export function useDeleteAutoReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`/api/chat/auto-replies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoReplies'] });
    },
  });
}

// ─── Unread Count ────────────────────────────────────────────────

export function useUnreadCount(storeId: string | null) {
  return useQuery({
    queryKey: CHAT_KEYS.unreadCount(storeId || ''),
    queryFn: () => fetchJSON<{ count: number }>('/api/chat/unread-count'),
    enabled: !!storeId,
    refetchInterval: 30000, // Poll every 30s
  });
}

// ─── Assign / Resolve ────────────────────────────────────────────

export function useAssignConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string | null }) =>
      fetchJSON<{ conversation: Conversation }>(
        `/api/chat/conversations/${conversationId}/assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }
      ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.conversation(vars.conversationId) });
    },
  });
}

export function useResolveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, status }: { conversationId: string; status: 'RESOLVED' | 'CLOSED' }) =>
      fetchJSON<{ conversation: Conversation }>(
        `/api/chat/conversations/${conversationId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.conversation(vars.conversationId) });
    },
  });
}
