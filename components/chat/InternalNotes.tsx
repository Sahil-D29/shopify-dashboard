'use client';

import { useState } from 'react';
import { StickyNote, Send, Loader2 } from 'lucide-react';
import { useNotes, useCreateNote } from '@/lib/hooks/useChat';
import { format } from 'date-fns';

interface InternalNotesProps {
  conversationId: string;
}

export function InternalNotes({ conversationId }: InternalNotesProps) {
  const [text, setText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading } = useNotes(conversationId);
  const createNote = useCreateNote(conversationId);

  const notes = data?.notes || [];

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    createNote.mutate({ content: trimmed }, {
      onSuccess: () => setText(''),
    });
  };

  return (
    <div className="border-t">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <StickyNote className="h-4 w-4 text-yellow-500" />
        Internal Notes ({notes.length})
      </button>

      {isOpen && (
        <div className="px-4 pb-3 space-y-3">
          {/* Add note */}
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="flex-1 resize-none rounded-md border px-2.5 py-1.5 text-xs focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || createNote.isPending}
              className="self-end rounded-md bg-yellow-500 p-1.5 text-white hover:bg-yellow-600 disabled:opacity-50"
            >
              {createNote.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Notes list */}
          {isLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="rounded-md bg-yellow-50 border border-yellow-200 p-2.5">
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                    <span>{note.creator?.name || 'Unknown'}</span>
                    <span>·</span>
                    <span>{format(new Date(note.createdAt), 'MMM d, HH:mm')}</span>
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No notes yet</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
