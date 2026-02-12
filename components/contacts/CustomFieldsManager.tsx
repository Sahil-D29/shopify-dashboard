'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';

interface CustomFieldDefinition {
  id: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN';
  options?: string[];
  isRequired: boolean;
}

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Select (Dropdown)' },
  { value: 'BOOLEAN', label: 'Yes / No' },
];

export default function CustomFieldsManager() {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New field form state
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<CustomFieldDefinition['fieldType']>('TEXT');
  const [newOptions, setNewOptions] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit field form state
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState<CustomFieldDefinition['fieldType']>('TEXT');
  const [editOptions, setEditOptions] = useState('');
  const [editRequired, setEditRequired] = useState(false);

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/contacts/custom-fields');
      if (res.ok) {
        const data = await res.json();
        setFields(data.fields || []);
      }
    } catch {
      console.error('Failed to fetch custom fields');
    } finally {
      setLoading(false);
    }
  };

  const generateFieldName = (label: string): string => {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      setFormError('Field label is required');
      return;
    }

    const fieldName = generateFieldName(newLabel);
    if (fields.some(f => f.fieldName === fieldName)) {
      setFormError('A field with this name already exists');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const res = await fetch('/api/contacts/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldLabel: newLabel.trim(),
          fieldName,
          fieldType: newType,
          options: newType === 'SELECT' ? newOptions.split(',').map(o => o.trim()).filter(Boolean) : undefined,
          isRequired: newRequired,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create field');
      }

      await fetchFields();
      resetAddForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create field');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (field: CustomFieldDefinition) => {
    setEditingId(field.id);
    setEditLabel(field.fieldLabel);
    setEditType(field.fieldType);
    setEditOptions(field.options?.join(', ') || '');
    setEditRequired(field.isRequired);
  };

  const handleUpdate = async (id: string) => {
    if (!editLabel.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/custom-fields/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldLabel: editLabel.trim(),
          fieldType: editType,
          options: editType === 'SELECT' ? editOptions.split(',').map(o => o.trim()).filter(Boolean) : undefined,
          isRequired: editRequired,
        }),
      });

      if (!res.ok) throw new Error('Failed to update field');
      await fetchFields();
      setEditingId(null);
    } catch {
      // Keep edit mode open on failure
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom field? This will remove values from all contacts.')) {
      return;
    }

    try {
      const res = await fetch(`/api/contacts/custom-fields/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchFields();
      }
    } catch {
      // silently fail
    }
  };

  const resetAddForm = () => {
    setShowAddForm(false);
    setNewLabel('');
    setNewType('TEXT');
    setNewOptions('');
    setNewRequired(false);
    setFormError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Custom Fields</h3>
          <p className="text-sm text-gray-500">Define additional fields for your contacts.</p>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-1" />
            Add Field
          </Button>
        )}
      </div>

      {/* Add Field Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700">New Custom Field</h4>

          {formError && (
            <p className="text-xs text-red-500">{formError}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="newLabel" className="text-xs">Field Label</Label>
              <Input
                id="newLabel"
                placeholder="e.g. Company Name"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="h-9 text-sm"
              />
              {newLabel && (
                <p className="text-xs text-gray-400">Field name: {generateFieldName(newLabel)}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="newType" className="text-xs">Field Type</Label>
              <select
                id="newType"
                value={newType}
                onChange={e => setNewType(e.target.value as CustomFieldDefinition['fieldType'])}
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {FIELD_TYPES.map(ft => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </select>
            </div>
          </div>

          {newType === 'SELECT' && (
            <div className="space-y-1">
              <Label htmlFor="newOptions" className="text-xs">Options (comma-separated)</Label>
              <Input
                id="newOptions"
                placeholder="Option 1, Option 2, Option 3"
                value={newOptions}
                onChange={e => setNewOptions(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              checked={newRequired}
              onCheckedChange={setNewRequired}
              id="newRequired"
            />
            <Label htmlFor="newRequired" className="text-xs cursor-pointer">Required field</Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetAddForm}>
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              Save Field
            </Button>
          </div>
        </div>
      )}

      {/* Fields List */}
      {fields.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No custom fields defined yet.</p>
          <p className="text-xs mt-1">Custom fields let you store extra data on each contact.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y">
          {fields.map(field => (
            <div key={field.id} className="px-4 py-3">
              {editingId === field.id ? (
                /* Inline Edit Form */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <select
                        value={editType}
                        onChange={e => setEditType(e.target.value as CustomFieldDefinition['fieldType'])}
                        className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        {FIELD_TYPES.map(ft => (
                          <option key={ft.value} value={ft.value}>{ft.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {editType === 'SELECT' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Options (comma-separated)</Label>
                      <Input
                        value={editOptions}
                        onChange={e => setEditOptions(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch checked={editRequired} onCheckedChange={setEditRequired} />
                    <Label className="text-xs cursor-pointer">Required</Label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => handleUpdate(field.id)} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                      {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                /* Display Mode */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{field.fieldLabel}</p>
                      <p className="text-xs text-gray-400">{field.fieldName}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {FIELD_TYPES.find(ft => ft.value === field.fieldType)?.label || field.fieldType}
                    </Badge>
                    {field.isRequired && (
                      <Badge variant="secondary" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                        Required
                      </Badge>
                    )}
                    {field.options && field.options.length > 0 && (
                      <span className="text-xs text-gray-400">
                        {field.options.length} options
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(field)} className="h-8 w-8 p-0">
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(field.id)} className="h-8 w-8 p-0 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
