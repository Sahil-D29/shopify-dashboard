'use client';

import { useState, useRef } from 'react';
import { Paperclip, X, Loader2, Image as ImageIcon, Film, FileText, Volume2 } from 'lucide-react';

interface MediaUploaderProps {
  conversationId: string;
  onSent: () => void;
}

export function MediaUploader({ conversationId, onSent }: MediaUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; file: File } | null>(null);
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreview({ url, type: file.type, file });
    setIsOpen(true);
  };

  const getMediaType = (mimeType: string): 'image' | 'video' | 'document' | 'audio' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleSend = async () => {
    if (!preview) return;
    setUploading(true);

    try {
      // For now, use the local object URL. In production, upload to a media server first.
      const res = await fetch('/api/chat/send-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          mediaUrl: preview.url,
          mediaType: preview.type,
          caption,
          type: getMediaType(preview.type),
        }),
      });

      if (res.ok) {
        onSent();
        handleClose();
      }
    } catch {
      // Error handling
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setCaption('');
    setIsOpen(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <button
        onClick={() => fileRef.current?.click()}
        className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title="Attach media"
      >
        <Paperclip className="h-5 w-5" />
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Preview modal */}
      {isOpen && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
          <div className="w-96 rounded-lg bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Send Media</h3>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-gray-50 p-4 mb-3 flex items-center justify-center">
              {preview.type.startsWith('image/') ? (
                <img src={preview.url} alt="Preview" className="max-h-48 rounded-md object-contain" />
              ) : (
                <div className="text-center">
                  {preview.type.startsWith('video/') && <Film className="mx-auto h-12 w-12 text-gray-400" />}
                  {preview.type.startsWith('audio/') && <Volume2 className="mx-auto h-12 w-12 text-gray-400" />}
                  {!preview.type.startsWith('video/') && !preview.type.startsWith('audio/') && (
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  )}
                  <p className="mt-2 text-xs text-gray-500 truncate max-w-[200px]">{preview.file.name}</p>
                </div>
              )}
            </div>

            {/* Caption */}
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              className="w-full rounded-md border px-3 py-1.5 text-sm mb-3 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={uploading}
              className="w-full rounded-md bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                'Send'
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
