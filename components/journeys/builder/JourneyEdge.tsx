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
          stroke: '#9CA3AF',
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: '6 6',
          animation: 'journey-flow 1.5s linear infinite',
          filter: selected ? 'drop-shadow(0 0 6px rgba(59,130,246,0.45))' : undefined,
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
              'group/pills flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-white shadow-lg transition-opacity duration-200',
              selected ? 'ring-2 ring-blue-400/60' : 'opacity-90'
            )}
          >
            <button
              type="button"
              onClick={handleInsert}
              className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow transition hover:bg-blue-400"
              title="Insert node"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow transition hover:bg-red-400"
              title="Delete connection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}


