'use client';

import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, AlertCircle, FileText, Image as ImageIcon, Film, Volume2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Message } from '@/lib/types/chat';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'OUTBOUND';
  const time = format(new Date(message.createdAt), 'HH:mm');

  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm',
          isOutbound
            ? 'bg-green-100 text-gray-900'
            : 'bg-white text-gray-900 border border-gray-200'
        )}
      >
        {/* Media preview */}
        {message.mediaUrl && (
          <div className="mb-2">
            {message.type === 'IMAGE' ? (
              <img
                src={message.mediaUrl}
                alt="Image"
                className="max-h-60 rounded-md object-cover"
              />
            ) : message.type === 'VIDEO' ? (
              <div className="flex items-center gap-2 rounded-md bg-gray-50 p-3">
                <Film className="h-5 w-5 text-gray-500" />
                <span className="text-xs text-gray-600">Video</span>
              </div>
            ) : message.type === 'AUDIO' ? (
              <div className="flex items-center gap-2 rounded-md bg-gray-50 p-3">
                <Volume2 className="h-5 w-5 text-gray-500" />
                <span className="text-xs text-gray-600">Audio</span>
              </div>
            ) : message.type === 'DOCUMENT' ? (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md bg-gray-50 p-3 hover:bg-gray-100"
              >
                <FileText className="h-5 w-5 text-blue-500" />
                <span className="text-xs text-blue-600 underline">Open document</span>
              </a>
            ) : null}
          </div>
        )}

        {/* Template indicator */}
        {message.templateName && (
          <div className="mb-1 text-[10px] font-medium text-gray-400 uppercase">
            Template: {message.templateName}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}

        {/* Time & status */}
        <div className={cn('mt-1 flex items-center gap-1', isOutbound ? 'justify-end' : 'justify-start')}>
          <span className="text-[10px] text-gray-400">{time}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'PENDING':
      return <Clock className="h-3 w-3 text-gray-400" />;
    case 'SENT':
      return <Check className="h-3 w-3 text-gray-400" />;
    case 'DELIVERED':
      return <CheckCheck className="h-3 w-3 text-gray-400" />;
    case 'READ':
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case 'FAILED':
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    default:
      return null;
  }
}
