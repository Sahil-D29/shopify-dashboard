"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { differenceInDays, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ChevronDown, MessageCircle, RefreshCcw, Search } from "lucide-react";

import type { WhatsAppTemplate, WhatsAppTemplateStatus } from "@/lib/types/whatsapp-config";
import { countTemplateCharacters, normalizeVariableToken } from "@/lib/whatsapp/template-utils";
import { MobilePreview } from "@/components/journeys/MobilePreview";

const STATUS_TABS: Array<{ id: TemplateGalleryStatus; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "APPROVED", label: "Approved" },
  { id: "PENDING", label: "Pending" },
  { id: "REJECTED", label: "Rejected" },
];

const DEFAULT_PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { id: "recent", label: "Recent" },
  { id: "alphabetical", label: "Alphabetical" },
  { id: "category", label: "Category" },
];

type TemplateGalleryStatus = WhatsAppTemplateStatus | "ALL";

export interface TemplateGalleryProps {
  templates: WhatsAppTemplate[];
  loading?: boolean;
  error?: string | null;
  selectedTemplateId?: string | null;
  statusFilter?: TemplateGalleryStatus;
  onStatusFilterChange?: (status: TemplateGalleryStatus) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  totalTemplates?: number;
  pageSize?: number;
  onSelectTemplate: (template: WhatsAppTemplate) => void;
  onRetry?: () => void;
}

function formatLastUsed(input?: string | Date): string {
  if (!input) return "—";
  try {
    const date = typeof input === "string" ? parseISO(input) : input;
    if (Number.isNaN(date.getTime())) return "—";
    const days = differenceInDays(new Date(), date);
    if (days <= 1) {
      return formatDistanceToNowStrict(date, { addSuffix: true });
    }
    return `${days} day${days === 1 ? "" : "s"} ago`;
  } catch {
    return "—";
  }
}

export function TemplateGallery({
  templates,
  loading = false,
  error,
  selectedTemplateId,
  statusFilter = "APPROVED",
  onStatusFilterChange,
  searchQuery = "",
  onSearchQueryChange,
  page = 1,
  onPageChange,
  totalTemplates,
  pageSize = DEFAULT_PAGE_SIZE,
  onSelectTemplate,
  onRetry,
}: TemplateGalleryProps) {
  const [internalSearch, setInternalSearch] = useState(searchQuery);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<typeof SORT_OPTIONS[number]["id"]>("recent");

  useEffect(() => {
    setInternalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      if (onSearchQueryChange) {
        onSearchQueryChange(internalSearch.trim());
      }
    }, 300);
    return () => window.clearTimeout(handler);
  }, [internalSearch, onSearchQueryChange]);

  const total = totalTemplates ?? templates.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const categories = useMemo(() => {
    const list = new Set<string>();
    templates.forEach(template => {
      if (template.category) list.add(template.category);
    });
    return Array.from(list).sort();
  }, [templates]);

  const languages = useMemo(() => {
    const list = new Set<string>();
    templates.forEach(template => {
      if (template.language) list.add(template.language.toUpperCase());
    });
    return Array.from(list).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const base = templates.filter(template => {
      const matchesCategory = categoryFilter === "all" ? true : template.category === categoryFilter;
      const matchesLanguage = languageFilter === "all" ? true : template.language.toUpperCase() === languageFilter.toUpperCase();
      const matchesStatus = statusFilter === "ALL" ? true : template.status === statusFilter;
      const query = internalSearch.trim().toLowerCase();
      const matchesSearch = query.length
        ? template.name.toLowerCase().includes(query) ||
          (template.description?.toLowerCase().includes(query) ?? false) ||
          (template.body?.toLowerCase().includes(query) ?? false)
        : true;
      return matchesCategory && matchesLanguage && matchesStatus && matchesSearch;
    });

    return base.sort((a, b) => {
      switch (sortBy) {
        case "alphabetical":
          return a.name.localeCompare(b.name);
        case "category":
          return a.category.localeCompare(b.category);
        case "recent":
        default: {
          const aTime = typeof a.updatedAt === "number" ? a.updatedAt : new Date(a.updatedAt ?? a.lastUsed ?? 0).getTime();
          const bTime = typeof b.updatedAt === "number" ? b.updatedAt : new Date(b.updatedAt ?? b.lastUsed ?? 0).getTime();
          return (bTime || 0) - (aTime || 0);
        }
      }
    });
  }, [templates, internalSearch, categoryFilter, languageFilter, sortBy, statusFilter]);

  const paginatedTemplates = useMemo(() => {
    if (totalTemplates != null) {
      return filteredTemplates;
    }
    const start = (page - 1) * pageSize;
    return filteredTemplates.slice(start, start + pageSize);
  }, [filteredTemplates, page, pageSize, totalTemplates]);

  const resolvedSelectedTemplate =
    paginatedTemplates.find(template => template.id === selectedTemplateId) ??
    templates.find(template => template.id === selectedTemplateId) ??
    paginatedTemplates[0] ??
    null;

  const { previewTokenValues, previewPlainValues } = useMemo(() => {
    if (!resolvedSelectedTemplate) return { previewTokenValues: {}, previewPlainValues: {} };
    const tokens: Record<string, string> = {};
    const plain: Record<string, string> = {};
    resolvedSelectedTemplate.variables.forEach(variable => {
      const token = normalizeVariableToken(variable);
      const stripped = token.replace(/^\{\{|\}\}$/g, "");
      const sample =
        (
          resolvedSelectedTemplate.sampleValues?.[token] ??
          resolvedSelectedTemplate.sampleValues?.[stripped] ??
          resolvedSelectedTemplate.sampleValues?.[variable]
        ) ??
        stripped ??
        token;
      tokens[token] = sample;
      if (stripped) plain[stripped] = sample;
    });
    return { previewTokenValues: tokens, previewPlainValues: plain };
  }, [resolvedSelectedTemplate]);

  const previewCharacters = useMemo(
    () => countTemplateCharacters(resolvedSelectedTemplate, previewTokenValues),
    [previewTokenValues, resolvedSelectedTemplate],
  );

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
          <MessageCircle className="h-4 w-4 text-[#B8977F]" />
          WhatsApp Templates
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8B7F76]">
          <span>
            Showing {paginatedTemplates.length} of {total} templates
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[#8B7F76]"
            onClick={() => onRetry?.()}
            disabled={loading}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => (
          <Button
            key={tab.id}
            type="button"
            variant={statusFilter === tab.id ? "default" : "outline"}
            className={cn(
              "rounded-full border px-4 py-1 text-xs font-semibold tracking-wide",
              statusFilter === tab.id
                ? "border-[#D4A574] bg-[#D4A574] text-white"
                : "border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]",
            )}
            onClick={() => onStatusFilterChange?.(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-center gap-2 rounded-lg border border-[#E8E4DE] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-[#C0B4A8]" />
          <input
            className="h-8 flex-1 bg-transparent text-sm outline-none"
            placeholder="Search by name, content, or category"
            value={internalSearch}
            onChange={event => setInternalSearch(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={categories} />
          <FilterSelect label="Language" value={languageFilter} onChange={setLanguageFilter} options={languages} />
          <FilterSelect
            label="Sort"
            value={sortBy}
            onChange={value => setSortBy(value as typeof SORT_OPTIONS[number]["id"])}
            options={SORT_OPTIONS.map(option => option.id)}
            labels={Object.fromEntries(SORT_OPTIONS.map(option => [option.id, option.label]))}
            showAll={false}
          />
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E8E4DE] bg-[#FEF3EF] px-6 py-8 text-center text-sm text-[#9C5E43]">
          <p>{error}</p>
          {onRetry ? (
            <Button
              variant="outline"
              className="mt-3 border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
              onClick={onRetry}
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-2xl border border-[#E8E4DE] bg-white">
          {loading ? (
            <div className="flex h-[460px] items-center justify-center text-sm text-[#8B7F76]">
              Loading templates…
            </div>
          ) : paginatedTemplates.length === 0 ? (
            <div className="flex h-[460px] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[#8B7F76]">
              No templates match these filters.
            </div>
          ) : (
            <ScrollArea className="h-[460px]">
              <div className="divide-y divide-[#F0ECE6]">
                {paginatedTemplates.map(template => {
                  const isSelected = resolvedSelectedTemplate?.id === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={cn(
                        "w-full bg-white px-4 py-3.5 text-left transition-all duration-200 rounded-lg border",
                        isSelected 
                          ? "bg-[#FFF9F2] border-[#D4A574] shadow-sm" 
                          : "border-transparent hover:border-[#E8E4DE] hover:bg-[#FDF8F3]",
                      )}
                      onClick={() => onSelectTemplate(template)}
                    >
                      {/* Header: Name and Status Badge */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#3A3028] truncate leading-tight">
                            {template.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-xs text-[#8B7F76] font-medium">
                              {template.category}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-[#D6CCC2]" />
                            <span className="text-xs text-[#8B7F76] font-medium">
                              {template.language.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium border flex-shrink-0",
                            template.status === "APPROVED"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : template.status === "PENDING"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-red-50 text-red-700 border-red-200",
                          )}
                        >
                          {template.status}
                        </Badge>
                      </div>
                      
                      {/* Body: Template content preview - 3 lines max */}
                      <p className="mt-2 line-clamp-3 text-xs text-[#6B5D54] leading-relaxed">
                        {template.body || template.content || "No preview available."}
                      </p>
                      
                      {/* Footer: Metadata */}
                      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-[#8B7F76] pt-2 border-t border-[#F0ECE6]">
                        <span className="font-medium">{template.variables.length} var</span>
                        <span className="h-1 w-1 rounded-full bg-[#D6CCC2]" />
                        <span>Last used {formatLastUsed(template.lastUsed)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
          {resolvedSelectedTemplate ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Preview</p>
                  <h3 className="text-lg font-semibold text-[#3A3028]">{resolvedSelectedTemplate.name}</h3>
                  <p className="text-sm text-[#8B7F76]">
                    {resolvedSelectedTemplate.description || "Rendered using sample data from your catalog."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className="bg-[#F5F3EE] text-[#8B7F76]">{resolvedSelectedTemplate.category}</Badge>
                  <Badge variant="outline" className="border-[#E8E4DE] text-[#4A4139]">
                    {resolvedSelectedTemplate.language.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div className="rounded-3xl border border-[#E8E4DE] bg-[#F8F7F5] p-4">
                <MobilePreview template={resolvedSelectedTemplate} variableValues={previewPlainValues} />
              </div>

              <dl className="grid gap-3 text-sm text-[#4A4139] md:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.3em] text-[#B9AA9F]">Placeholders</dt>
                  <dd>{resolvedSelectedTemplate.variables.length}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.3em] text-[#B9AA9F]">Characters</dt>
                  <dd>{previewCharacters}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.3em] text-[#B9AA9F]">Buttons</dt>
                  <dd>{resolvedSelectedTemplate.buttons?.length ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.3em] text-[#B9AA9F]">Last updated</dt>
                  <dd>
                    {resolvedSelectedTemplate.updatedAt
                      ? new Date(resolvedSelectedTemplate.updatedAt).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </dl>

              <div className="rounded-2xl border border-dashed border-[#E8E4DE] bg-[#FFFBF7] p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#B9AA9F]">Variables</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {resolvedSelectedTemplate.variables.length ? (
                    resolvedSelectedTemplate.variables.map(variable => (
                      <span
                        key={variable}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#8B7F76]"
                      >
                        {normalizeVariableToken(variable)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#8B7F76]">No variables required.</span>
                  )}
                </div>
              </div>

              <Button
                type="button"
                className={cn(
                  "w-full",
                  resolvedSelectedTemplate?.status === "APPROVED"
                    ? "bg-[#D4A574] text-white hover:bg-[#B8835D]"
                    : "bg-[#F5F3EE] text-[#8B7F76] border border-[#E8E4DE] cursor-not-allowed"
                )}
                onClick={() => resolvedSelectedTemplate && onSelectTemplate(resolvedSelectedTemplate)}
                disabled={!resolvedSelectedTemplate || resolvedSelectedTemplate?.status !== "APPROVED"}
              >
                {resolvedSelectedTemplate?.status === "APPROVED"
                  ? `Use "${resolvedSelectedTemplate?.name}"`
                  : resolvedSelectedTemplate?.status === "PENDING"
                    ? "Template Pending Approval"
                    : "Template Not Approved"}
              </Button>
              {resolvedSelectedTemplate?.status !== "APPROVED" && (
                <p className="mt-2 text-xs text-center text-[#8B7F76]">
                  Only APPROVED templates can be used in production. Use sandbox mode for testing.
                </p>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-[#8B7F76]">
              Select a template to see the WhatsApp preview and details.
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-[#4A4139]">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
              disabled={page <= 1}
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export type { TemplateGalleryStatus };

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
  showAll?: boolean;
}

function FilterSelect({ label, value, onChange, options, labels, showAll = true }: FilterSelectProps) {
  const normalizedLabel = label.toLowerCase();
  const display =
    value === "all" && showAll
      ? `All ${normalizedLabel}${normalizedLabel.endsWith("s") ? "" : "s"}`
      : labels?.[value] ?? value;

  return (
    <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#B9AA9F]">
      {label}
      <div className="relative flex items-center gap-2 rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139]">
        <span className="flex-1 truncate">{display}</span>
        <ChevronDown className="h-4 w-4 text-[#C0B4A8]" />
        <select
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={value}
          onChange={event => onChange(event.target.value)}
        >
          {showAll ? <option value="all">All</option> : null}
          {options.map(option => (
            <option key={option} value={option}>
              {labels?.[option] ?? option}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}



