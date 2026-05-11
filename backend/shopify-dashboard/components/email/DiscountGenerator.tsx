'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Percent, Copy } from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

interface DiscountGeneratorProps {
  onInsert: (code: string) => void;
  onClose: () => void;
}

export default function DiscountGenerator({ onInsert, onClose }: DiscountGeneratorProps) {
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [value, setValue] = useState('10');
  const [prefix, setPrefix] = useState('SAVE');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`${EMAIL_API}/discounts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: discountType,
          value: parseFloat(value),
          prefix,
          count: 1,
          storeId: 'tsg-api.myshopify.com',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const code = data.codes?.[0] || data.code || '';
        setGeneratedCode(code);
        toast.success('Discount code generated!');
      }
    } catch {
      toast.error('Failed to generate discount code');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Discount Code Generator</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Discount Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDiscountType('percentage')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  discountType === 'percentage' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                Percentage (%)
              </button>
              <button
                onClick={() => setDiscountType('fixed_amount')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  discountType === 'fixed_amount' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                Fixed Amount ($)
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {discountType === 'percentage' ? 'Percentage Off' : 'Amount Off ($)'}
            </label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} min="1" max={discountType === 'percentage' ? '100' : '10000'} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Code Prefix</label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="e.g., SAVE" />
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="w-full bg-blue-600 text-white hover:bg-blue-700">
            {generating ? 'Generating...' : 'Generate Code'}
          </Button>

          {generatedCode && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-xs text-green-600 font-medium mb-2">Generated Code:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold text-green-700 bg-white rounded px-3 py-2 border">
                  {generatedCode}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(generatedCode); toast.success('Copied!'); }}
                  className="text-green-600 hover:text-green-700"
                >
                  <Copy className="h-5 w-5" />
                </button>
              </div>
              <Button onClick={() => onInsert(generatedCode)} className="w-full mt-3 bg-green-600 text-white hover:bg-green-700">
                Insert into Email
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
