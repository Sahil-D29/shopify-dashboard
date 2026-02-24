"use client";

import type { MouseEvent } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { Plus, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface JourneyEdgeData {
  onInsertBetween?: (edgeId: string) => void;
  onDelete?: (edgeId: string) => void;
}

export function JourneyEdge(props: EdgeProps<any>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
    selected,
    data,
  } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleInsert = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    data?.onInsertBetween?.(id);
  };

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    data?.onDelete?.(id);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#6366F1' : '#CBD5E1',
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: '8 4',
          animation: 'journey-flow 2s linear infinite',
          filter: selected ? 'drop-shadow(0 0 4px rgba(99,102,241,0.35))' : undefined,
          transition: 'stroke 0.2s, stroke-width 0.2s',
          ...style,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            zIndex: 10,
          }}
        >
          <div
            className={cn(
              'group/pills pointer-events-auto flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm transition-all duration-200',
              selected ? 'ring-2 ring-indigo-300/60 shadow-md' : 'opacity-80 hover:opacity-100 hover:shadow-md'
            )}
          >
            <button
              type="button"
              onClick={handleInsert}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm transition hover:bg-indigo-400 hover:scale-110"
              title="Insert node"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition hover:bg-rose-400 hover:scale-110"
              title="Delete connection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}


