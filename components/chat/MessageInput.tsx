'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Smile, Paperclip, FileText } from 'lucide-react';
import { useSendMessage } from '@/lib/hooks/useChat';
import { QuickReplyPicker } from './QuickReplyPicker';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const EmojiPicker = dynamic(() => import('emoji-picker-react').then(m => m.default), {
  ssr: false,
  loading: () => <div className="h-[350px] w-[350px] bg-white rounded-lg border animate-pulse" />,
});

interface MessageInputProps {
  conversationId: string | null;
  storeId: string | null;
  disabled?: boolean;
  onTemplatePick?: () => void;
}

export function MessageInput({ conversationId, storeId, disabled, onTemplatePick }: MessageInputProps) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyQuery, setQuickReplyQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMutation = useSendMessage(conversationId);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !conversationId || sendMutation.isPending) return;

    sendMutation.mutate({ content: trimmed, type: 'TEXT' }, {
      onSuccess: () => {
        setText('');
        setShowQuickReplies(false);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      },
    });
  }, [text, conversationId, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setShowEmoji(false);
      setShowQuickReplies(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';

    // Quick reply detection: "/" at start
    if (val.startsWith('/') && val.length > 0) {
      setShowQuickReplies(true);
      setQuickReplyQuery(val.substring(1));
    } else {
      setShowQuickReplies(false);
    }
  };

  const handleEmojiSelect = (emojiData: { emoji: string }) => {
    setText((prev) => prev + emojiData.emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.emoji-picker-container')) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  return (
    <div className="relative border-t bg-white px-4 py-3">
      {/* Quick Reply Picker */}
      {showQuickReplies && (
        <QuickReplyPicker
          storeId={storeId}
          query={quickReplyQuery}
          onSelect={(content) => {
            setText(content);
            setShowQuickReplies(false);
          }}
          onClose={() => setShowQuickReplies(false)}
        />
      )}

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="emoji-picker-container absolute bottom-full left-4 mb-2 z-50">
          <EmojiPicker onEmojiClick={handleEmojiSelect} width={350} height={350} />
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Action buttons */}
        <div className="flex items-center gap-1 pb-1">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
          <button
            onClick={onTemplatePick}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Send Template"
          >
            <FileText className="h-5 w-5" />
          </button>
        </div>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a conversation...' : 'Type a message or / for quick replies...'}
          disabled={disabled || !conversationId}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm',
            'placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300',
            'disabled:bg-gray-50 disabled:cursor-not-allowed'
          )}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || !conversationId || sendMutation.isPending}
          className={cn(
            'mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
            text.trim()
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-100 text-gray-400'
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Tip */}
      <p className="mt-1 text-[10px] text-gray-400">
        Press Enter to send, Shift+Enter for new line, type / for quick replies
      </p>
    </div>
  );
}
