'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface DeleteSegmentModalProps {
  isOpen: boolean;
  segmentName: string;
  customerCount?: number;
  usage?: {
    campaigns?: number;
    activeCampaigns?: number;
    journeys?: number;
    activeJourneys?: number;
  };
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteSegmentModal({
  isOpen,
  segmentName,
  customerCount,
  usage,
  onClose,
  onConfirm,
}: DeleteSegmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const campaignsUsing = usage?.campaigns ?? 0;
  const journeysUsing = usage?.journeys ?? 0;

  const warningMessages: string[] = [];
  if (campaignsUsing > 0) {
    const activeCampaigns = usage?.activeCampaigns ?? 0;
    warningMessages.push(
      `${campaignsUsing} campaign${campaignsUsing === 1 ? '' : 's'} (${activeCampaigns} active)`
    );
  }
  if (journeysUsing > 0) {
    const activeJourneys = usage?.activeJourneys ?? 0;
    warningMessages.push(
      `${journeysUsing} journey${journeysUsing === 1 ? '' : 's'} (${activeJourneys} active)`
    );
  }

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Delete Segment?</h2>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-gray-600 mb-6">
          <p>
            Are you sure you want to delete <span className="font-semibold">{segmentName}</span>?
            {typeof customerCount === 'number' && (
              <> This will remove {customerCount.toLocaleString()} customer{customerCount === 1 ? '' : 's'} from this segment.</>
            )}
          </p>
          {warningMessages.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
              <p className="font-medium mb-1">This segment is used in:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {warningMessages.map(message => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
              <p className="text-xs mt-2">Deleting the segment will affect these campaigns or journeys.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Deleting…' : 'Delete Segment'}
          </button>
        </div>
      </div>
    </div>
  );
}
