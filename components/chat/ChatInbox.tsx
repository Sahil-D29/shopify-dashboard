'use client';

import { useState, useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useConversations } from '@/lib/hooks/useChat';
import { ConversationItem } from './ConversationItem';
import type { ChatFilters, ConversationStatus } from '@/lib/types/chat';
import { cn } from '@/lib/utils';

const STATUS_TABS: { label: string; value: ChatFilters['status'] }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Resolved', value: 'RESOLVED' },
];

interface ChatInboxProps {
  storeId: string | null;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

export function ChatInbox({ storeId, activeConversationId, onSelectConversation }: ChatInboxProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChatFilters['status']>('ALL');

  const filters: ChatFilters = {
    status: statusFilter,
    search: search || undefined,
  };

  const { data, isLoading } = useConversations(storeId, filters);
  const conversations = data?.conversations || [];

  return (
    <div className="flex h-full w-80 flex-col border-r bg-white">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">Inbox</h2>
        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-md border bg-gray-50 pl-8 pr-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex border-b px-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'flex-1 py-2 text-xs font-medium transition-colors border-b-2',
              statusFilter === tab.value
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No conversations found</p>
          </div>
        ) : (
          <div className="divide-y">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onClick={() => onSelectConversation(conv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
