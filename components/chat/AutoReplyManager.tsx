'use client';

import { useState } from 'react';
import { Plus, Trash2, Edit2, Power, Loader2 } from 'lucide-react';
import {
  useAutoReplies,
  useCreateAutoReply,
  useUpdateAutoReply,
  useDeleteAutoReply,
} from '@/lib/hooks/useChat';
import { cn } from '@/lib/utils';

interface AutoReplyManagerProps {
  storeId: string | null;
}

interface RuleForm {
  name: string;
  keywords: string;
  matchType: string;
  replyType: string;
  replyContent: string;
  templateName: string;
  priority: number;
}

const defaultForm: RuleForm = {
  name: '',
  keywords: '',
  matchType: 'contains',
  replyType: 'text',
  replyContent: '',
  templateName: '',
  priority: 0,
};

export function AutoReplyManager({ storeId }: AutoReplyManagerProps) {
  const { data, isLoading } = useAutoReplies(storeId);
  const createMutation = useCreateAutoReply();
  const updateMutation = useUpdateAutoReply();
  const deleteMutation = useDeleteAutoReply();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(defaultForm);

  const rules = data?.rules || [];

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      matchType: form.matchType,
      replyType: form.replyType,
      replyContent: form.replyType === 'text' ? form.replyContent : undefined,
      templateName: form.replyType === 'template' ? form.templateName : undefined,
      priority: form.priority,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, ...payload } as any, {
        onSuccess: () => resetForm(),
      });
    } else {
      createMutation.mutate(payload as any, {
        onSuccess: () => resetForm(),
      });
    }
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (rule: any) => {
    setForm({
      name: rule.name,
      keywords: (rule.keywords || []).join(', '),
      matchType: rule.matchType,
      replyType: rule.replyType,
      replyContent: rule.replyContent || '',
      templateName: rule.templateName || '',
      priority: rule.priority,
    });
    setEditId(rule.id);
    setShowForm(true);
  };

  const handleToggle = (rule: any) => {
    updateMutation.mutate({ id: rule.id, isActive: !rule.isActive } as any);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Auto-Reply Rules</h3>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Rule
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Rule Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="e.g. Greeting Reply"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Priority</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Keywords (comma-separated)</label>
            <input
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="hello, hi, hey"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Match Type</label>
              <select
                value={form.matchType}
                onChange={(e) => setForm({ ...form, matchType: e.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="contains">Contains</option>
                <option value="exact">Exact Match</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Reply Type</label>
              <select
                value={form.replyType}
                onChange={(e) => setForm({ ...form, replyType: e.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="text">Text</option>
                <option value="template">Template</option>
              </select>
            </div>
          </div>

          {form.replyType === 'text' ? (
            <div>
              <label className="text-xs font-medium text-gray-600">Reply Message</label>
              <textarea
                value={form.replyContent}
                onChange={(e) => setForm({ ...form, replyContent: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="Thank you for reaching out! We'll get back to you shortly."
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-gray-600">Template Name</label>
              <input
                value={form.templateName}
                onChange={(e) => setForm({ ...form, templateName: e.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="hello_world"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : rules.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No auto-reply rules configured</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule: any) => (
            <div key={rule.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-medium', rule.isActive ? 'text-gray-900' : 'text-gray-400')}>
                    {rule.name}
                  </span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    {rule.matchType}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  Keywords: {(rule.keywords || []).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => handleToggle(rule)}
                  className={cn('rounded-md p-1.5', rule.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50')}
                  title={rule.isActive ? 'Disable' : 'Enable'}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button onClick={() => handleEdit(rule)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50" title="Edit">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(rule.id)}
                  className="rounded-md p-1.5 text-red-400 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
