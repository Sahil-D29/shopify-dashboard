'use client';

import { useUnreadCount } from '@/lib/hooks/useChat';

interface ChatNotificationBadgeProps {
  storeId: string | null;
}

export function ChatNotificationBadge({ storeId }: ChatNotificationBadgeProps) {
  const { data } = useUnreadCount(storeId);
  const count = data?.count ?? 0;

  if (count === 0) return null;

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}
