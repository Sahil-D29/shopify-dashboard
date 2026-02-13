'use client';

import { useState, useEffect } from 'react';
import { X, Search, Send, Loader2 } from 'lucide-react';

interface Template {
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: unknown[];
}

interface TemplatePickerProps {
  conversationId: string;
  contactId: string;
  onClose: () => void;
  onSent: () => void;
}

export function TemplatePicker({ conversationId, contactId, onClose, onSent }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/whatsapp/templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || []);
        }
      } catch {
        // Fallback: empty list
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const filtered = templates.filter(
    (t) =>
      t.status === 'APPROVED' &&
      (t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.category?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSend = async (template: Template) => {
    setSending(template.name);
    try {
      const res = await fetch('/api/chat/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          templateName: template.name,
          templateLanguage: template.language,
          templateComponents: template.components || [],
        }),
      });
      if (res.ok) {
        onSent();
        onClose();
      }
    } catch {
      // Error handling
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-96 max-h-[500px] flex flex-col rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Send Template</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full rounded-md border pl-8 pr-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No approved templates found</p>
          ) : (
            filtered.map((template) => (
              <div
                key={template.name}
                className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 truncate">{template.name}</p>
                  <p className="text-xs text-gray-500">{template.language} · {template.category}</p>
                </div>
                <button
                  onClick={() => handleSend(template)}
                  disabled={sending === template.name}
                  className="ml-2 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {sending === template.name ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
