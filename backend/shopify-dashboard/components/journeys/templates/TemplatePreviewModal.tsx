"use client";

import { Fragment, useMemo } from 'react';
import { BarChart3, Clock3, Sparkles, Target } from 'lucide-react';

import Modal from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { JourneyTemplate, JourneyTemplateNode } from '@/lib/types/journey-template';

import { JourneyTemplatePreview } from './JourneyTemplatePreview';

interface TemplatePreviewModalProps {
  template: JourneyTemplate | null;
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onUse: (templateId: string) => void;
}

export function TemplatePreviewModal({ template, open, loading, onClose, onUse }: TemplatePreviewModalProps) {
  const metrics = useMemo(() => template?.journey.metrics || {}, [template?.journey.metrics]);

  if (!template) {
    return null;
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={template.name}
      subtitle={template.description}
      size="xl"
      gradient
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#8B7F76]">
            <Sparkles className="h-4 w-4" />
            Curated by lifecycle experts
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              type="button"
              className="gap-2 bg-[#B8875C] text-white hover:bg-[#A6764A]"
              onClick={() => onUse(template.id)}
              disabled={loading}
            >
              {loading ? 'Creating…' : 'Use Template'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <JourneyTemplatePreview trigger={template.journey.trigger} nodes={template.journey.nodes} className="h-48" />

          <section className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B8977F]">Journey Steps</h3>
            <div className="divide-y divide-[#E8E4DE]/60">
              {([template.journey.trigger, ...(template.journey.nodes || [])]
                .filter(Boolean) as JourneyTemplateNode[]).map((node, index) => (
                <Fragment key={`${node.id || node.subtype || node.type}-${index}`}>
                  <div className="flex flex-col gap-1 py-3 text-sm text-[#4A4139]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{node.name || node.subtype || node.type}</span>
                      <Badge variant="secondary" className="bg-[#F5F3EE] text-[#8B7F76]">
                        {node.subtype?.replace(/_/g, ' ') || node.type}
                      </Badge>
                    </div>
                    {node.description ? (
                      <p className="text-xs text-[#8B7F76]">{node.description}</p>
                    ) : null}
                  </div>
                </Fragment>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B8977F]">Template Details</h3>
            <div className="mt-3 space-y-3 text-sm text-[#4A4139]">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#B8875C]" />
                Estimated impact:{' '}
                <strong>{template.estimatedImpact || 'Medium'}</strong>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#B8875C]" />
                Ideal segment:{' '}
                <span className="text-[#8B7F76]">{template.tags?.join(', ') || 'All customers'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#B8875C]" />
                Setup time: <span>{template.difficulty || 'Intermediate'}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B8977F]">Benchmarks</h3>
            <ul className="mt-3 space-y-3 text-sm text-[#4A4139]">
              <li>
                Conversion rate
                <strong className="ml-2">{metrics.avgConversionRate != null ? `${metrics.avgConversionRate}%` : '17%'}</strong>
              </li>
              <li>
                Avg time to goal
                <strong className="ml-2">{metrics.avgTimeToComplete != null ? `${metrics.avgTimeToComplete} hrs` : '48 hrs'}</strong>
              </li>
              {metrics.sampleSize ? (
                <li>
                  Sample size <strong className="ml-2">{metrics.sampleSize.toLocaleString()}</strong>
                </li>
              ) : null}
            </ul>
          </section>
        </aside>
      </div>
    </Modal>
  );
}

