"use client";

import { memo } from 'react';

import { cn } from '@/lib/utils';

import type { JourneyTemplateNode } from '@/lib/types/journey-template';

const palette: Record<string, string> = {
  trigger: 'bg-[#CBBDE5]',
  action: 'bg-[#B3D4F6]',
  condition: 'bg-[#F5D88A]',
  decision: 'bg-[#F5D88A]',
  wait: 'bg-[#D4C7BE]',
  delay: 'bg-[#D4C7BE]',
  goal: 'bg-[#BFD7B5]',
  exit: 'bg-[#BFD7B5]',
};

interface JourneyTemplatePreviewProps {
  trigger?: JourneyTemplateNode;
  nodes?: JourneyTemplateNode[];
  className?: string;
}

function labelForNode(node: JourneyTemplateNode): string {
  if (node.name) return node.name;
  if (node.subtype) return node.subtype.replace(/_/g, ' ');
  return node.type;
}

export const JourneyTemplatePreview = memo(function JourneyTemplatePreview({
  trigger,
  nodes,
  className,
}: JourneyTemplatePreviewProps) {
  const sequence = ([] as JourneyTemplateNode[])
    .concat(trigger ? [trigger] : [])
    .concat(nodes || [])
    .slice(0, 6);

  if (!sequence.length) {
    return (
      <div
        className={cn(
          'flex h-36 items-center justify-center rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] text-xs text-[#8B7F76]',
          className
        )}
      >
        No preview available
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative h-40 rounded-2xl border border-[#E8E4DE] bg-white/80 p-5 shadow-inner',
        className
      )}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white via-white/60 to-transparent" />
      <div className="relative flex h-full flex-col justify-between gap-3">
        {sequence.map((node, index) => (
          <div key={`${node.subtype ?? node.type}-${index}`} className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold text-[#4A4139]',
                palette[node.type] || 'bg-[#E8E4DE]'
              )}
            >
              {node.type === 'trigger'
                ? 'T'
                : node.type === 'action'
                  ? 'A'
                  : node.type === 'delay'
                    ? 'D'
                    : node.type === 'condition'
                      ? 'C'
                      : node.type === 'goal'
                        ? 'G'
                        : 'N'}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-[#6F6256]">
                <span className="truncate font-medium">{labelForNode(node)}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#B8977F]">
                  {node.subtype?.replace(/_/g, ' ') || node.type}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-[#EFECE8]">
                <div
                  className="h-full rounded-full bg-[#D4A574]/60"
                  style={{ width: `${Math.max(20, 80 - index * 10)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        {nodes && nodes.length + (trigger ? 1 : 0) > sequence.length ? (
          <div className="text-[11px] text-[#8B7F76]">
            +{nodes.length + (trigger ? 1 : 0) - sequence.length} more steps
          </div>
        ) : null}
      </div>
    </div>
  );
});

JourneyTemplatePreview.displayName = 'JourneyTemplatePreview';

