'use client';

import { useState, useMemo } from 'react';
import { useQuickReplies } from '@/lib/hooks/useChat';
import { cn } from '@/lib/utils';

interface QuickReplyPickerProps {
  storeId: string | null;
  query: string;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export function QuickReplyPicker({ storeId, query, onSelect, onClose }: QuickReplyPickerProps) {
  const { data } = useQuickReplies(storeId);
  const replies = data?.quickReplies || [];

  const filtered = useMemo(() => {
    if (!query) return replies;
    const q = query.toLowerCase();
    return replies.filter(
      (r) =>
        r.shortcut.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q)
    );
  }, [replies, query]);

  if (filtered.length === 0) {
    return (
      <div className="absolute bottom-full left-0 mb-1 w-72 rounded-lg border bg-white p-3 shadow-lg">
        <p className="text-xs text-gray-500">No quick replies found</p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-1 max-h-48 w-72 overflow-y-auto rounded-lg border bg-white shadow-lg">
      {filtered.map((reply) => (
        <button
          key={reply.id}
          onClick={() => {
            onSelect(reply.content);
            onClose();
          }}
          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-blue-600">{reply.shortcut}</span>
            <span className="text-xs font-medium text-gray-700">{reply.title}</span>
          </div>
          <p className="truncate text-xs text-gray-500">{reply.content}</p>
        </button>
      ))}
    </div>
  );
}
