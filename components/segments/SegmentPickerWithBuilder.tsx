'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SegmentSelect } from '@/components/selectors/SegmentSelect';
import SegmentBuilder from './SegmentBuilder';
import type { CustomerSegment } from '@/lib/types/segment';

interface SegmentPickerWithBuilderProps {
  value: string;
  onValueChange: (segmentId: string) => void;
  className?: string;
  label?: string;
}

export function SegmentPickerWithBuilder({
  value,
  onValueChange,
  className,
  label = 'Select Segment',
}: SegmentPickerWithBuilderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSegmentSaved = (segment: CustomerSegment) => {
    onValueChange(segment.id);
    setDialogOpen(false);
  };

  return (
    <div className={className}>
      {label && <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SegmentSelect
            value={value}
            onValueChange={(val) => onValueChange(val)}
            className="w-full"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          New
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Segment</DialogTitle>
          </DialogHeader>
          <SegmentBuilder onSaved={handleSegmentSaved} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
