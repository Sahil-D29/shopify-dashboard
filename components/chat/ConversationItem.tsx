'use client';

import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { Conversation } from '@/lib/types/chat';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.firstName || contact?.phone || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const timeAgo = conversation.lastMessageAt
    ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })
    : '';

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
        isActive && 'bg-blue-50 hover:bg-blue-50',
        conversation.unreadCount > 0 && !isActive && 'bg-white'
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
        {contact?.avatarUrl ? (
          <img src={contact.avatarUrl} alt={displayName} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-white">{initials}</span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={cn('truncate text-sm', conversation.unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
            {displayName}
          </span>
          <span className="ml-2 shrink-0 text-[11px] text-gray-400">{timeAgo}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className={cn('truncate text-xs', conversation.unreadCount > 0 ? 'text-gray-700' : 'text-gray-500')}>
            {conversation.lastMessagePreview || 'No messages yet'}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        {/* Status & Assignment */}
        <div className="flex items-center gap-2 mt-1">
          {conversation.status !== 'OPEN' && (
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              conversation.status === 'RESOLVED' && 'bg-green-100 text-green-700',
              conversation.status === 'PENDING' && 'bg-yellow-100 text-yellow-700',
              conversation.status === 'CLOSED' && 'bg-gray-100 text-gray-500'
            )}>
              {conversation.status}
            </span>
          )}
          {conversation.assignedUser && (
            <span className="truncate text-[10px] text-gray-400">
              {conversation.assignedUser.name}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
