"use client";

import { useMemo, useState } from "react";
import { Search, Check, MessageSquare, ExternalLink, RefreshCw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobilePreview } from "@/components/journeys/MobilePreview";
import type { WhatsAppTemplate, WhatsAppTemplateStatus } from "@/lib/types/whatsapp-config";
import { cn } from "@/lib/utils";

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
  templates: WhatsAppTemplate[];
  templatesLoading?: boolean;
  selectedTemplateId?: string | null;
  onSelect: (template: WhatsAppTemplate) => void;
}

type StatusFilter = WhatsAppTemplateStatus | "ALL";
type CategoryFilter = string | "ALL";

const statusBadgeClass = (status: WhatsAppTemplate["status"]): string =>
  cn(
    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
    status === "APPROVED" && "bg-green-50 text-green-700",
    status === "PENDING" && "bg-yellow-50 text-yellow-700",
    status === "REJECTED" && "bg-red-50 text-red-700",
    status === "DRAFT" && "bg-gray-100 text-gray-600",
  );

const categoryBadgeClass = (category: string): string => {
  switch (category.toUpperCase()) {
    case "MARKETING":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "UTILITY":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "AUTHENTICATION":
      return "bg-orange-100 text-orange-700 border-orange-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
};

export default function TemplatePickerModal({
  open,
  onClose,
  templates,
  templatesLoading = false,
  selectedTemplateId,
  onSelect,
}: TemplatePickerModalProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [languageFilter, setLanguageFilter] = useState<string>("ALL");
  // Initialised from the current selection on mount. Parents pass a changing
  // `key` (e.g. the variant id / open flag) so the modal remounts and re-syncs
  // its highlighted template each time it opens — no effect-driven cascade.
  const [activeId, setActiveId] = useState<string | null>(selectedTemplateId ?? null);

  const languages = useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => t.language && set.add(t.language));
    return Array.from(set).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates.filter(t => {
      const matchesSearch =
        !query ||
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        (t.body ?? t.content ?? "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      const matchesCategory =
        categoryFilter === "ALL" || t.category.toUpperCase() === categoryFilter;
      const matchesLanguage = languageFilter === "ALL" || t.language === languageFilter;
      return matchesSearch && matchesStatus && matchesCategory && matchesLanguage;
    });
  }, [templates, search, statusFilter, categoryFilter, languageFilter]);

  const activeTemplate =
    filtered.find(t => t.id === activeId) ??
    templates.find(t => t.id === activeId) ??
    null;

  const handleConfirm = () => {
    if (activeTemplate) {
      onSelect(activeTemplate);
      onClose();
    }
  };

  const selectClass =
    "h-9 rounded-lg border border-[#E8E4DE] bg-white px-3 text-sm text-[#4A4139] focus:outline-none focus:ring-2 focus:ring-[#D4A574]";

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <DialogContent className="flex h-[88vh] max-h-[860px] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[#E8E4DE] px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg text-[#4A4139]">
            <MessageSquare className="h-5 w-5 text-[#D4A574]" />
            Choose a WhatsApp Template
          </DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_320px]">
          {/* ── Left: filters + grid ── */}
          <div className="flex min-h-0 flex-col border-r border-[#E8E4DE]">
            {/* Filter bar */}
            <div className="space-y-3 border-b border-[#F0EBE3] bg-[#FAF9F6] px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B9AA9F]" />
                <Input
                  placeholder="Search by name, category or message…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-9 border-[#E8E4DE] pl-9 text-sm focus-visible:ring-[#D4A574]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="ALL">All Categories</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                  className={selectClass}
                >
                  <option value="ALL">All Status</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="DRAFT">Draft</option>
                </select>
                {languages.length > 1 && (
                  <select
                    value={languageFilter}
                    onChange={e => setLanguageFilter(e.target.value)}
                    className={selectClass}
                  >
                    <option value="ALL">All Languages</option>
                    {languages.map(lang => (
                      <option key={lang} value={lang}>
                        {lang.toUpperCase()}
                      </option>
                    ))}
                  </select>
                )}
                <span className="ml-auto flex items-center text-xs text-[#8B7F76]">
                  {filtered.length} template{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {/* Grid */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {templatesLoading ? (
                <div className="flex h-full items-center justify-center gap-3 text-[#8B7F76]">
                  <RefreshCw className="h-5 w-5 animate-spin text-[#D4A574]" />
                  Loading templates…
                </div>
              ) : templates.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3EDE6]">
                    <MessageSquare className="h-5 w-5 text-[#8B7F76]" />
                  </div>
                  <p className="text-sm font-medium text-[#4A4139]">No templates available</p>
                  <p className="max-w-xs text-xs text-[#8B7F76]">
                    Create and approve templates in WhatsApp Manager, then sync them on the
                    Templates page to use them here.
                  </p>
                  <a
                    href="https://business.facebook.com/wa/manage/message-templates/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#D4A574] hover:underline"
                  >
                    Open WhatsApp Manager <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-[#8B7F76]">
                  No templates match your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filtered.map(template => {
                    const isActive = template.id === activeId;
                    const preview = template.body || template.content || "No preview available";
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setActiveId(template.id)}
                        onDoubleClick={() => { onSelect(template); onClose(); }}
                        className={cn(
                          "flex flex-col rounded-xl border-2 bg-white p-4 text-left transition-all hover:shadow-md",
                          isActive
                            ? "border-[#D4A574] shadow-sm ring-1 ring-[#D4A574]"
                            : "border-[#E8E4DE] hover:border-[#D4A574]/60",
                        )}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-[#4A4139]">
                            {template.name}
                          </h4>
                          {isActive ? (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4A574] text-white">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span className={statusBadgeClass(template.status)}>
                              {template.status}
                            </span>
                          )}
                        </div>
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              categoryBadgeClass(template.category),
                            )}
                          >
                            {template.category}
                          </span>
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            {template.language.toUpperCase()}
                          </span>
                        </div>
                        <p className="line-clamp-3 text-xs leading-relaxed text-[#8B7F76]">
                          {preview}
                        </p>
                        {template.buttons && template.buttons.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {template.buttons.map((b, idx) => (
                              <span
                                key={b.id ?? idx}
                                className="rounded-md bg-[#FAF9F6] px-1.5 py-0.5 text-[10px] text-[#7D6248]"
                              >
                                {b.text || b.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: live preview ── */}
          <div className="hidden min-h-0 flex-col bg-[#FAF9F6] md:flex">
            <div className="flex items-center justify-between border-b border-[#E8E4DE] px-4 py-3">
              <span className="text-xs font-semibold text-[#8B7F76]">Preview</span>
              {activeTemplate ? (
                <span className="text-[11px] text-[#B9AA9F]">
                  {activeTemplate.language?.toUpperCase()}
                </span>
              ) : null}
            </div>
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-4">
              <div className="origin-top scale-90">
                <MobilePreview template={activeTemplate} variableValues={activeTemplate?.sampleValues} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E8E4DE] bg-white px-6 py-3">
          <span className="truncate text-sm text-[#8B7F76]">
            {activeTemplate ? (
              <>
                Selected: <strong className="text-[#4A4139]">{activeTemplate.name}</strong>
              </>
            ) : (
              "Select a template to continue"
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={!activeTemplate}
              className="bg-[#D4A574] text-white hover:bg-[#B8835D]"
            >
              Use this template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
