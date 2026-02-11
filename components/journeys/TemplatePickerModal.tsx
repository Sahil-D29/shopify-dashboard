"use client";

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';
import { Filter, Search, SortAsc } from 'lucide-react';

import { MobilePreview } from './MobilePreview';

type SortOption = 'recent' | 'name' | 'category';

interface TemplatePickerModalProps {
  isOpen: boolean;
  templates: WhatsAppTemplate[];
  onClose: () => void;
  onSelect: (template: WhatsAppTemplate, variables: Record<string, string>) => void;
  initialTemplateId?: string;
  initialVariables?: Record<string, string>;
  loading?: boolean;
}

const statusColors: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-gray-100 text-gray-700',
};

export function TemplatePickerModal({
  isOpen,
  templates,
  onClose,
  onSelect,
  initialTemplateId,
  initialVariables = {},
  loading = false,
}: TemplatePickerModalProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('APPROVED');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(initialTemplateId);
  const [variableValues, setVariableValues] = useState<Record<string, string>>(initialVariables);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      setSelectedTemplateId(initialTemplateId);
      setVariableValues(initialVariables);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialTemplateId, initialVariables, isOpen]);

  const uniqueCategories = useMemo(() => Array.from(new Set(templates.map(t => t.category))), [templates]);
  const uniqueLanguages = useMemo(() => Array.from(new Set(templates.map(t => t.language))), [templates]);
  const uniqueStatuses = useMemo(() => Array.from(new Set(templates.map(t => t.status))), [templates]);

  const filteredTemplates = useMemo(() => {
    return templates
      .filter(template => {
        if (categoryFilter !== 'all' && template.category !== categoryFilter) return false;
        if (languageFilter !== 'all' && template.language !== languageFilter) return false;
        if (statusFilter !== 'all' && template.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return template.name.toLowerCase().includes(q) || template.category.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'category':
            return a.category.localeCompare(b.category);
          case 'recent':
          default:
            const bTime = typeof b.updatedAt === 'string' || b.updatedAt instanceof Date ? new Date(b.updatedAt).getTime() : typeof b.updatedAt === 'number' ? b.updatedAt : 0;
            const aTime = typeof a.updatedAt === 'string' || a.updatedAt instanceof Date ? new Date(a.updatedAt).getTime() : typeof a.updatedAt === 'number' ? a.updatedAt : 0;
            return bTime - aTime;
        }
      });
  }, [templates, categoryFilter, languageFilter, statusFilter, search, sortBy]);

  const selectedTemplate = filteredTemplates.find(template => template.id === selectedTemplateId)
    || templates.find(template => template.id === selectedTemplateId)
    || filteredTemplates[0];

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const nextVariables: Record<string, string> = {};
      template.variables.forEach(variable => {
        nextVariables[variable] = variableValues[variable] ?? `{{${variable}}}`;
      });
      setVariableValues(nextVariables);
    }
  };

  const handleUseTemplate = () => {
    if (!selectedTemplate) return;
    const mapped = selectedTemplate.variables.reduce<Record<string, string>>((acc, variable) => {
      acc[variable] = variableValues[variable] ?? '';
      return acc;
    }, {});
    onSelect(selectedTemplate, mapped);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select WhatsApp Template"
      subtitle="Browse approved templates and preview the WhatsApp experience before selecting."
      size="xl"
      gradient
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {filteredTemplates.length} templates available
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="border-gray-200">
              Cancel
            </Button>
            <Button
              onClick={handleUseTemplate}
              disabled={!selectedTemplate || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Use Template
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="h-9 flex-1 bg-transparent text-sm outline-none"
              placeholder="Search templates"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <label className="space-y-1">
              <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                <Filter className="h-3.5 w-3.5" /> Category
              </span>
              <select
                value={categoryFilter}
                onChange={event => setCategoryFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                🌐 Language
              </span>
              <select
                value={languageFilter}
                onChange={event => setLanguageFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                {uniqueLanguages.map(language => (
                  <option key={language} value={language}>{language.toUpperCase()}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                ✅ Status
              </span>
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                <SortAsc className="h-3.5 w-3.5" /> Sort By
              </span>
              <select
                value={sortBy}
                onChange={event => setSortBy(event.target.value as SortOption)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="recent">Recent</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
              </select>
            </label>
          </div>

          <div className="space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 custom-scrollbar max-h-[420px]">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-sm text-gray-500">
                Loading templates…
              </div>
            ) : (
              <>
                {filteredTemplates.map(template => {
                  const isActive = template.id === selectedTemplate?.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                      className={`flex w-full flex-col gap-2.5 rounded-lg border px-4 py-3.5 text-left transition-all duration-200 ${
                        isActive
                          ? 'border-blue-500 bg-blue-50/80 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/50'
                      }`}
                    >
                      {/* Header: Name and Status Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 truncate block leading-tight">
                            {template.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-xs text-gray-600 font-medium">
                              {template.category}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-gray-400" />
                            <span className="text-xs text-gray-600 font-medium">
                              {template.language.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${
                          template.status === 'APPROVED'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : template.status === 'PENDING'
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              : template.status === 'REJECTED'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {template.status}
                        </span>
                      </div>
                      
                      {/* Body: Template content preview - 3 lines max */}
                      <div className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                        {template.body || template.content}
                      </div>
                    </button>
                  );
                })}

                {filteredTemplates.length === 0 ? (
                  <div className="flex items-center justify-center rounded-lg bg-gray-50 px-4 py-8 text-sm text-gray-500">
                    No templates match your filters.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl bg-gray-50 p-4">
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedTemplate?.name || 'Select a template'}</h3>
                <p className="text-sm text-gray-500">Preview how your message appears on WhatsApp.</p>
              </div>
              {selectedTemplate ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700">{selectedTemplate.category}</Badge>
                  <Badge variant="outline" className="border-blue-200 text-blue-600">
                    {selectedTemplate.language.toUpperCase()}
                  </Badge>
                </div>
              ) : null}
            </div>
            <MobilePreview template={selectedTemplate ?? null} variableValues={variableValues} />
          </div>

          {selectedTemplate ? (
            <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900">Template Details</h4>
              <dl className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div>
                  <dt className="uppercase tracking-wide">Category</dt>
                  <dd className="text-sm text-gray-800">{selectedTemplate.category}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Language</dt>
                  <dd className="text-sm text-gray-800">{selectedTemplate.language.toUpperCase()}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Status</dt>
                  <dd className="text-sm text-gray-800">{selectedTemplate.status}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Last Updated</dt>
                  <dd className="text-sm text-gray-800">
                    {selectedTemplate.updatedAt ? new Date(selectedTemplate.updatedAt).toLocaleString() : '—'}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-gray-500">Variable Mapping</Label>
                <div className="grid gap-2">
                  {selectedTemplate.variables.length === 0 ? (
                    <p className="text-xs text-gray-500">No variables required for this template.</p>
                  ) : (
                    selectedTemplate.variables.map(variable => (
                      <div key={variable} className="flex items-center gap-2">
                        <span className="w-16 text-xs font-semibold text-gray-500">{`{{${variable}}}`}</span>
                        <Input
                          value={variableValues[variable] ?? ''}
                          onChange={event =>
                            setVariableValues(prev => ({
                              ...prev,
                              [variable]: event.target.value,
                            }))
                          }
                          placeholder="Map to customer field"
                          className="flex-1"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
              Select a template to see details.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

