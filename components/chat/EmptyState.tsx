'use client';

import { MessageCircle } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-gray-500">
      <div className="rounded-full bg-gray-100 p-6">
        <MessageCircle className="h-12 w-12 text-gray-400" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900">No conversation selected</h3>
        <p className="mt-1 text-sm">Choose a conversation from the inbox to start chatting.</p>
      </div>
    </div>
  );
}
