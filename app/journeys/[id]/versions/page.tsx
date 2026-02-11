"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';

import { JourneyTemplatePreview } from '@/components/journeys/templates/JourneyTemplatePreview';
import { VersionCompareModal } from '@/components/journeys/VersionCompareModal';
import { VersionHistoryList } from '@/components/journeys/VersionHistoryList';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/hooks/useToast';

import type { JourneyVersion, JourneyVersionMetadata } from '@/lib/types/journey-version';
import type { JourneyTemplateNode } from '@/lib/types/journey-template';

async function fetchVersionMetadata(journeyId: string): Promise<JourneyVersionMetadata[]> {
  const response = await fetch(`/api/journeys/${journeyId}/versions`, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load versions');
  }
  return payload.versions as JourneyVersionMetadata[];
}

async function fetchVersionDetail(journeyId: string, versionId: string): Promise<JourneyVersion> {
  const response = await fetch(`/api/journeys/${journeyId}/versions/${versionId}`, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load version');
  }
  return payload.version as JourneyVersion;
}

export default function JourneyVersionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const journeyId = params?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const metadataQuery = useQuery({
    queryKey: ['journey-versions', journeyId],
    queryFn: () => fetchVersionMetadata(journeyId),
    enabled: Boolean(journeyId),
  });

  const currentVersionId = metadataQuery.data?.[0]?.id;

  const previewQuery = useQuery({
    queryKey: ['journey-version', journeyId, previewVersionId],
    queryFn: () => fetchVersionDetail(journeyId, previewVersionId ?? ''),
    enabled: Boolean(journeyId && previewVersionId),
  });

  const baseCompareQuery = useQuery({
    queryKey: ['journey-version', journeyId, currentVersionId],
    queryFn: () => fetchVersionDetail(journeyId, currentVersionId ?? ''),
    enabled: Boolean(journeyId && currentVersionId && compareVersionId),
  });

  const compareQuery = useQuery({
    queryKey: ['journey-version', journeyId, compareVersionId],
    queryFn: () => fetchVersionDetail(journeyId, compareVersionId ?? ''),
    enabled: Boolean(journeyId && compareVersionId),
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async (payload: { label: string; summary?: string }) => {
      const response = await fetch(`/api/journeys/${journeyId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create snapshot');
      }
      return data.version as JourneyVersion;
    },
    onSuccess: version => {
      toast.success('Snapshot created');
      setCreateOpen(false);
      setNewLabel('');
      setNewSummary('');
      queryClient.invalidateQueries({ queryKey: ['journey-versions', journeyId] });
      queryClient.invalidateQueries({ queryKey: ['journey-version', journeyId, version.id] });
    },
    onError: error => {
      toast.error((error as Error)?.message ?? 'Unable to create snapshot');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const response = await fetch(`/api/journeys/${journeyId}/versions/${versionId}/restore`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to restore version');
      }
      return data.journey;
    },
    onSuccess: () => {
      toast.success('Journey restored to selected version');
      queryClient.invalidateQueries({ queryKey: ['journey-versions', journeyId] });
      router.push(`/journeys/${journeyId}/builder`);
    },
    onError: error => {
      toast.error((error as Error)?.message ?? 'Unable to restore version');
    },
  });

  const previewVersion = previewQuery.data ?? null;
  const previewNodes: JourneyTemplateNode[] = useMemo(() => {
    if (!previewVersion) return [];
    return previewVersion.snapshot.nodes.map(node => ({
      id: node.id,
      type: node.type,
      subtype: node.subtype,
      name: node.name,
      description: node.description,
    }));
  }, [previewVersion]);

  const previewTrigger = useMemo<JourneyTemplateNode | undefined>(() => {
    if (!previewVersion) return undefined;
    return previewVersion.snapshot.nodes.find(node => node.type === 'trigger');
  }, [previewVersion]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] text-[#4A4139]">
      <header className="border-b border-[#E8E4DE] bg-white/85 px-6 py-6 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" className="text-[#8B7F76] hover:text-[#4A4139]" asChild>
                <Link href={`/journeys/${journeyId}/builder`}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back to Builder
                </Link>
              </Button>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#B9AA9F]">Version history</p>
                <h1 className="text-3xl font-semibold tracking-tight text-[#3A3028]">Manage journey versions</h1>
                <p className="text-sm text-[#8B7F76]">
                  Capture manual snapshots, compare differences, and restore proven flows before activation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]"
                onClick={() => metadataQuery.refetch()}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', metadataQuery.isFetching && 'animate-spin')} /> Refresh
              </Button>
              <Button
                type="button"
                className="gap-2 bg-[#6A5C8F] text-white hover:bg-[#5A4F7D]"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" /> Save New Version
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        {metadataQuery.isError ? (
          <div className="rounded-3xl border border-[#F2C7C7] bg-white px-6 py-4 text-sm text-[#B45151]">
            {(metadataQuery.error as Error)?.message || 'Unable to load version history'}
          </div>
        ) : null}

        {metadataQuery.isLoading ? (
          <div className="grid place-items-center rounded-3xl border border-[#E8E4DE] bg-white py-16 text-[#8B7F76]">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="mt-3 text-sm">Loading version history…</p>
          </div>
        ) : (
          metadataQuery.data && (
            <VersionHistoryList
              versions={metadataQuery.data}
              onCreateSnapshot={() => setCreateOpen(true)}
              onPreview={versionId => setPreviewVersionId(versionId)}
              onCompare={versionId => setCompareVersionId(versionId)}
              onRestore={versionId => {
                if (
                  confirm(
                    'Restore this version? Current state will be backed up automatically and you will return to the builder.'
                  )
                ) {
                  restoreMutation.mutate(versionId);
                }
              }}
              currentVersionId={currentVersionId}
              isCreatingSnapshot={createSnapshotMutation.isPending}
              restoringVersionId={typeof restoreMutation.variables === 'string' ? restoreMutation.variables : null}
            />
          )
        )}
      </main>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Save Version"
        subtitle="Label this snapshot and optionally add notes about what changed."
        size="md"
        gradient
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]"
              onClick={() => setCreateOpen(false)}
              disabled={createSnapshotMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#6A5C8F] text-white hover:bg-[#5A4F7D]"
              onClick={() => createSnapshotMutation.mutate({ label: newLabel.trim(), summary: newSummary.trim() || undefined })}
              disabled={createSnapshotMutation.isPending || !newLabel.trim()}
            >
              {createSnapshotMutation.isPending ? 'Saving…' : 'Save Version'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]" htmlFor="versionLabel">
              Version label
            </label>
            <Input
              id="versionLabel"
              value={newLabel}
              onChange={event => setNewLabel(event.target.value)}
              placeholder="e.g. Pre-holiday updates"
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]" htmlFor="versionSummary">
              Notes (optional)
            </label>
            <Textarea
              id="versionSummary"
              rows={3}
              value={newSummary}
              onChange={event => setNewSummary(event.target.value)}
              placeholder="Describe what changed in this version."
              className="mt-2"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(previewVersionId)}
        onClose={() => setPreviewVersionId(null)}
        title={previewVersion?.label || 'Version Preview'}
        subtitle={previewVersion?.summary || 'Snapshot details'}
        size="xl"
        gradient
        footer={
          previewVersion ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-[#8B7F76]">
                Saved {formatDistanceToNow(previewVersion.createdAt, { addSuffix: true })}
              </div>
              <Button
                type="button"
                className="bg-[#B8875C] text-white hover:bg-[#A6764A]"
                onClick={() => {
                  if (
                    previewVersion &&
                    confirm('Restore this version? Current state will be backed up automatically before restore.')
                  ) {
                    restoreMutation.mutate(previewVersion.id);
                  }
                }}
                disabled={!previewVersion}
              >
                Restore this version
              </Button>
            </div>
          ) : undefined
        }
      >
        {previewQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center text-[#8B7F76]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : previewVersion ? (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <JourneyTemplatePreview trigger={previewTrigger} nodes={previewNodes} className="h-52" />
            <div className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B8977F]">Snapshot Details</h3>
              <ul className="space-y-2 text-sm text-[#4A4139]">
                <li>
                  Status: <strong>{previewVersion.snapshot.status}</strong>
                </li>
                <li>
                  Nodes: <strong>{previewVersion.snapshot.nodes.length}</strong>
                </li>
                <li>
                  Connections: <strong>{previewVersion.snapshot.edges.length}</strong>
                </li>
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>

      <VersionCompareModal
        open={Boolean(compareVersionId && baseCompareQuery.data && compareQuery.data)}
        onClose={() => setCompareVersionId(null)}
        baseVersion={baseCompareQuery.data ?? null}
        compareVersion={compareQuery.data ?? null}
      />
    </div>
  );
}

