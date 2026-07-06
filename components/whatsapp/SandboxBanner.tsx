'use client';

import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';

import { useTenant } from '@/lib/tenant/tenant-context';

/**
 * Shows a clear banner when WhatsApp is not connected for the current store —
 * i.e. Sandbox mode is active and messages are simulated, not delivered. Keeps
 * the behaviour transparent for merchants (and app reviewers).
 */
export function SandboxBanner() {
  const { currentStore } = useTenant();
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => {
    const headers: HeadersInit | undefined = currentStore?.id
      ? { 'x-store-id': currentStore.id }
      : undefined;
    fetch('/api/settings/whatsapp', { headers })
      .then(r => r.json())
      .then(d => setSandbox(!(d?.isConfigured || d?.config?.isConfigured)))
      .catch(() => {});
  }, [currentStore?.id]);

  if (!sandbox) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="text-sm text-amber-800">
        <p className="font-semibold">Sandbox mode active</p>
        <p className="mt-0.5 leading-relaxed">
          WhatsApp isn&apos;t connected, so messages are <strong>simulated</strong> (not
          actually delivered). You can still build and run campaigns, journeys, and cart
          recovery end-to-end to explore every feature.{' '}
          <a href="/settings/whatsapp" className="font-medium underline">
            Connect WhatsApp
          </a>{' '}
          to send real messages.
        </p>
      </div>
    </div>
  );
}
