'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Workflow, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = [
  { value: 'Survey', label: 'Survey' },
  { value: 'Lead Generation', label: 'Lead Generation' },
  { value: 'Appointment Booking', label: 'Appointment Booking' },
  { value: 'Feedback', label: 'Feedback' },
  { value: 'Custom', label: 'Custom' },
];

export default function CreateFlowPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Flow name is required');
      return;
    }
    if (!category) {
      setError('Please select a category');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create flow');
      }

      const flow = await res.json();
      router.push(`/flows/${flow.id}/builder`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        {/* Back link */}
        <Link
          href="/flows"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Flows
        </Link>

        <Card className="border-gray-100 shadow-sm">
          <CardContent className="p-8">
            {/* Icon header */}
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                <Workflow className="h-7 w-7 text-indigo-600" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-gray-900">
                Create a new Flow
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Build an interactive WhatsApp experience for your customers
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} className="space-y-5">
              {/* Flow Name */}
              <div className="space-y-2">
                <label
                  htmlFor="flowName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Flow Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="flowName"
                  placeholder="e.g. Customer Survey, Lead Capture"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11"
                  autoFocus
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Error */}
              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Flow'
                  )}
                </Button>
                <Link href="/flows">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
