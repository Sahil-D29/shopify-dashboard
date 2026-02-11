"use client";

import { memo, useMemo } from 'react';
import { CheckCircle2, Info, Loader2, TrendingUp, Clock, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { JourneyTemplate } from '@/lib/types/journey-template';

import { JourneyTemplatePreview } from './JourneyTemplatePreview';

interface TemplateCardProps {
  template: JourneyTemplate;
  loading?: boolean;
  onUse: () => void;
  onPreview: () => void;
}

export const TemplateCard = memo(function TemplateCard({ template, loading = false, onUse, onPreview }: TemplateCardProps) {
  const totalNodes = useMemo(
    () => (template.journey.nodes?.length || 0) + (template.journey.trigger ? 1 : 0),
    [template]
  );

  return (
    <article className="flex h-full flex-col gap-4 rounded-3xl border border-[#E8E4DE] bg-white/90 p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[#3A3028]">{template.name}</h2>
            <p className="text-sm text-[#8B7F76]">{template.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className="border-[#D4A574]/40 bg-[#F5F3EE] text-[#B8875C]">{template.category}</Badge>
            {template.difficulty ? (
              <Badge variant="secondary" className="border-transparent bg-[#EFEAF9] text-[#6A5C8F]">
                {template.difficulty}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#8B7F76]">
          {template.estimatedImpact ? (
            <span className="rounded-full bg-[#FAF9F6] px-3 py-1 font-medium text-[#B8875C]">
              Impact: {template.estimatedImpact}
            </span>
          ) : null}
          {template.tags?.map(tag => (
            <span key={tag} className="rounded-full bg-[#FAF9F6] px-3 py-1 font-medium">
              {tag}
            </span>
          ))}
        </div>
      </header>

      <JourneyTemplatePreview trigger={template.journey.trigger} nodes={template.journey.nodes} />

      <footer className="mt-auto flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs text-[#8B7F76]">
          <Info className="h-3.5 w-3.5" />
          <span>{totalNodes} nodes • {template.journey.edges?.length || 0} connections</span>
        </div>

        <div className="grid gap-2 text-xs text-[#8B7F76] xl:grid-cols-3">
          {template.journey?.metrics?.avgConversionRate != null ? (
            <div className="flex items-center gap-2 rounded-lg bg-[#F6F1EB] px-3 py-2 font-medium text-[#B8875C]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{template.journey.metrics.avgConversionRate}% avg conversion</span>
            </div>
          ) : null}
          {template.journey?.metrics?.avgTimeToComplete ? (
            <div className="flex items-center gap-2 rounded-lg bg-[#FAF9F6] px-3 py-2">
              <Clock className="h-3.5 w-3.5" />
              <span>{template.journey.metrics.avgTimeToComplete}</span>
            </div>
          ) : null}
          {template.journey?.metrics?.sampleSize != null ? (
            <div className="flex items-center gap-2 rounded-lg bg-[#FAF9F6] px-3 py-2">
              <Users className="h-3.5 w-3.5" />
              <span>{template.journey.metrics.sampleSize.toLocaleString()} stores</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]"
            onClick={onPreview}
          >
            Preview
          </Button>
          <Button
            type="button"
            className={cn('gap-2 bg-[#B8875C] text-white hover:bg-[#A6764A]', loading && 'opacity-70')}
            onClick={onUse}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Use Template
          </Button>
        </div>
      </footer>
    </article>
  );
});

TemplateCard.displayName = 'TemplateCard';

