'use client';

import { useState } from 'react';
import { CheckCircle, UserPlus, X, ChevronRight, Phone } from 'lucide-react';
import { useResolveConversation } from '@/lib/hooks/useChat';
import { formatPhoneDisplay } from '@/lib/whatsapp/normalize-phone';
import type { Conversation } from '@/lib/types/chat';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  conversation: Conversation;
  onToggleSidebar: () => void;
  showSidebar: boolean;
  onAssign: () => void;
}

export function ChatHeader({ conversation, onToggleSidebar, showSidebar, onAssign }: ChatHeaderProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.firstName || contact?.phone || 'Unknown';
  const resolveMutation = useResolveConversation();

  const handleResolve = () => {
    resolveMutation.mutate({
      conversationId: conversation.id,
      status: conversation.status === 'RESOLVED' ? 'CLOSED' : 'RESOLVED',
    });
  };

  return (
    <div className="flex h-16 items-center justify-between border-b bg-white px-4">
      {/* Contact info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
          <span className="text-xs font-semibold text-white">
            {displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-gray-900">{displayName}</h3>
          <p className="truncate text-xs text-gray-500">
            {contact?.phone ? formatPhoneDisplay(contact.phone) : ''}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Assign button */}
        <button
          onClick={onAssign}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {conversation.assignedUser?.name || 'Assign'}
        </button>

        {/* Resolve button */}
        <button
          onClick={handleResolve}
          disabled={resolveMutation.isPending}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            conversation.status === 'RESOLVED'
              ? 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              : 'bg-green-600 text-white hover:bg-green-700'
          )}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {conversation.status === 'RESOLVED' ? 'Close' : 'Resolve'}
        </button>

        {/* Toggle sidebar */}
        <button
          onClick={onToggleSidebar}
          className="rounded-lg border p-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', showSidebar && 'rotate-180')} />
        </button>
      </div>
    </div>
  );
}
