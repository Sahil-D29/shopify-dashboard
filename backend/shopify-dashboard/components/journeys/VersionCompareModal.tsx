"use client";

import Modal from '@/components/ui/modal';

import type { JourneyVersion } from '@/lib/types/journey-version';

interface VersionCompareModalProps {
  open: boolean;
  onClose: () => void;
  baseVersion: JourneyVersion | null;
  compareVersion: JourneyVersion | null;
}

function DetailList({
  heading,
  items,
}: {
  heading: string;
  items: Array<{ label: string; value: string | number | undefined | null }>;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white/85 p-4 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#B8977F]">{heading}</h3>
      <dl className="mt-3 space-y-2 text-sm text-[#4A4139]">
        {items.map(item => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <dt className="text-[#8B7F76]">{item.label}</dt>
            <dd className="text-right font-medium">{item.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function VersionCompareModal({ open, onClose, baseVersion, compareVersion }: VersionCompareModalProps) {
  if (!baseVersion || !compareVersion) {
    return null;
  }

  const baseSnapshot = baseVersion.snapshot;
  const compareSnapshot = compareVersion.snapshot;

  const nodeDelta = compareSnapshot.nodes.length - baseSnapshot.nodes.length;
  const edgeDelta = compareSnapshot.edges.length - baseSnapshot.edges.length;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Compare Versions"
      subtitle="Review structural differences between the selected snapshots."
      size="xl"
      gradient
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <DetailList
          heading={baseVersion.label}
          items={[
            { label: 'Captured', value: new Date(baseVersion.createdAt).toLocaleString() },
            { label: 'Summary', value: baseVersion.summary },
            { label: 'Nodes', value: baseSnapshot.nodes.length },
            { label: 'Edges', value: baseSnapshot.edges.length },
            { label: 'Status', value: baseSnapshot.status },
          ]}
        />
        <DetailList
          heading={compareVersion.label}
          items={[
            { label: 'Captured', value: new Date(compareVersion.createdAt).toLocaleString() },
            { label: 'Summary', value: compareVersion.summary },
            { label: 'Nodes', value: compareSnapshot.nodes.length },
            { label: 'Edges', value: compareSnapshot.edges.length },
            { label: 'Status', value: compareSnapshot.status },
          ]}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] p-4 text-xs text-[#6F6256]">
        <p className="font-semibold uppercase tracking-wide text-[#B8977F]">Key Differences</p>
        <ul className="mt-3 space-y-1">
          <li>
            Nodes delta: <strong>{nodeDelta === 0 ? 'No change' : nodeDelta > 0 ? `+${nodeDelta}` : nodeDelta}</strong>
          </li>
          <li>
            Edges delta: <strong>{edgeDelta === 0 ? 'No change' : edgeDelta > 0 ? `+${edgeDelta}` : edgeDelta}</strong>
          </li>
        </ul>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#E8E4DE] bg-white p-4 shadow-inner">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B8977F]">Base Snapshot</p>
          <pre className="mt-3 max-h-64 overflow-auto text-[11px] leading-relaxed text-[#4A4139]">
            {JSON.stringify(baseSnapshot, null, 2)}
          </pre>
        </div>
        <div className="rounded-xl border border-[#E8E4DE] bg-white p-4 shadow-inner">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B8977F]">Comparison Snapshot</p>
          <pre className="mt-3 max-h-64 overflow-auto text-[11px] leading-relaxed text-[#4A4139]">
            {JSON.stringify(compareSnapshot, null, 2)}
          </pre>
        </div>
      </div>
    </Modal>
  );
}

