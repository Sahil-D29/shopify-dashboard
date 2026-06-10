'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TemplatePreview from './TemplatePreview';
import {
  META_TEMPLATE_LIBRARY,
  LIBRARY_CATEGORIES,
  type LibraryCategory,
  type LibraryTemplate,
} from '@/lib/whatsapp/meta-template-library';

interface Props {
  onUse: (template: LibraryTemplate) => void;
}

const CATEGORY_LABEL: Record<LibraryCategory, string> = {
  ALL: 'All',
  UTILITY: 'Utility',
  AUTHENTICATION: 'Authentication',
  MARKETING: 'Marketing',
};

export default function MetaTemplateLibrary({ onUse }: Props) {
  const [category, setCategory] = useState<LibraryCategory>('ALL');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: META_TEMPLATE_LIBRARY.length };
    for (const t of META_TEMPLATE_LIBRARY) c[t.category] = (c[t.category] || 0) + 1;
    return c;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return META_TEMPLATE_LIBRARY.filter(t => {
      const matchesCat = category === 'ALL' || t.category === category;
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.useCase.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [category, search]);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Ready-made templates modelled on Meta&apos;s Template Library. Pick one and click{' '}
        <span className="font-medium">Use this template</span> to customise &amp; submit it as your own.
      </p>

      {/* Search */}
      <div className="relative mb-4 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search the library…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {LIBRARY_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              category === cat
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {CATEGORY_LABEL[cat]}
            <span className={`ml-1.5 text-xs ${category === cat ? 'text-green-100' : 'text-gray-400'}`}>
              {counts[cat] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-10">No templates match your search.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(t => (
            <div key={t.id} className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 pt-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{t.title}</h3>
                  <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {CATEGORY_LABEL[t.category as LibraryCategory] ?? t.category}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mb-3">{t.useCase}</div>
              </div>

              {/* WhatsApp-style preview */}
              <div className="px-3">
                <TemplatePreview
                  header={t.header}
                  body={t.body}
                  footer={t.footer}
                  buttons={t.buttons}
                  sampleValues={t.sampleValues ?? {}}
                />
              </div>

              <div className="px-4 py-3 mt-auto flex items-center justify-between">
                <code className="text-[11px] text-gray-400 truncate">{t.name}</code>
                <Button
                  size="sm"
                  onClick={() => onUse(t)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Use this template
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
