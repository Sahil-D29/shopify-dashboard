'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';

interface ImportCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'mapping' | 'importing' | 'results';

const CONTACT_FIELDS = [
  { value: '', label: '-- Skip --' },
  { value: 'phone', label: 'Phone' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'name', label: 'Full Name' },
  { value: 'email', label: 'Email' },
  { value: 'tags', label: 'Tags' },
];

interface ImportResults {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export default function ImportCSVModal({ open, onOpenChange, onImportComplete }: ImportCSVModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [results, setResults] = useState<ImportResults | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setCsvHeaders([]);
    setCsvRows([]);
    setAllRows([]);
    setColumnMapping({});
    setResults(null);
    setError('');
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      return row;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setError('CSV file must have at least a header row and one data row');
          return;
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);

        setCsvHeaders(headers);
        setCsvRows(dataRows.slice(0, 3)); // Preview first 3 rows
        setAllRows(dataRows);

        // Auto-map columns based on header names
        const autoMapping: Record<number, string> = {};
        headers.forEach((header, index) => {
          const lower = header.toLowerCase().trim();
          if (lower.includes('phone') || lower.includes('mobile') || lower.includes('tel')) {
            autoMapping[index] = 'phone';
          } else if (lower === 'email' || lower.includes('e-mail')) {
            autoMapping[index] = 'email';
          } else if (lower === 'first name' || lower === 'firstname' || lower === 'first_name') {
            autoMapping[index] = 'firstName';
          } else if (lower === 'last name' || lower === 'lastname' || lower === 'last_name') {
            autoMapping[index] = 'lastName';
          } else if (lower === 'name' || lower === 'full name' || lower === 'fullname') {
            autoMapping[index] = 'name';
          } else if (lower === 'tags' || lower === 'tag') {
            autoMapping[index] = 'tags';
          }
        });
        setColumnMapping(autoMapping);
        setStep('mapping');
      } catch {
        setError('Failed to parse CSV file. Please check the file format.');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    // Validate that phone is mapped
    const mappedFields = Object.values(columnMapping);
    if (!mappedFields.includes('phone')) {
      setError('Phone column must be mapped');
      return;
    }

    setStep('importing');
    setError('');

    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers: csvHeaders,
          rows: allRows,
          columnMapping,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Import failed');
      }

      const data = await res.json();
      setResults(data);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('mapping');
    }
  };

  const handleDone = () => {
    onImportComplete();
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import contacts into your contact list.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 py-3">
          {(['upload', 'mapping', 'results'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-gray-300" />}
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                  step === s || (step === 'importing' && s === 'results')
                    ? 'bg-blue-600 text-white'
                    : (['results'] as string[]).includes(step) || (step === 'mapping' && s === 'upload')
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {i + 1}
              </div>
              <span className="text-xs text-gray-600 capitalize">{s}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">CSV files only</p>
              {fileName && (
                <div className="flex items-center justify-center gap-2 mt-3 text-sm text-blue-600">
                  <FileText className="w-4 h-4" />
                  {fileName}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Map your CSV columns to contact fields. Preview of first {csvRows.length} rows shown below.
            </p>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {csvHeaders.map((header, colIndex) => (
                      <th key={colIndex} className="px-3 py-2 text-left">
                        <div className="space-y-1.5">
                          <span className="text-xs text-gray-500 font-normal">{header}</span>
                          <select
                            value={columnMapping[colIndex] || ''}
                            onChange={e => {
                              setColumnMapping(prev => ({
                                ...prev,
                                [colIndex]: e.target.value,
                              }));
                            }}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                          >
                            {CONTACT_FIELDS.map(field => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b last:border-0">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 text-xs text-gray-600 truncate max-w-[150px]">
                          {cell || '--'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-gray-500">
              Total rows to import: <span className="font-medium">{allRows.length}</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { reset(); }}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleImport} className="bg-blue-600 hover:bg-blue-700">
                Import {allRows.length} Contacts
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm font-medium text-gray-700">Importing contacts...</p>
            <p className="text-xs text-gray-500">This may take a moment for large files.</p>
          </div>
        )}

        {/* Step: Results */}
        {step === 'results' && results && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">Import completed successfully!</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{results.total}</div>
                <div className="text-xs text-gray-500">Total Processed</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{results.created}</div>
                <div className="text-xs text-green-600">Created</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{results.updated}</div>
                <div className="text-xs text-blue-600">Updated</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-700">{results.skipped}</div>
                <div className="text-xs text-yellow-600">Skipped</div>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Errors ({results.errors.length})</h4>
                <div className="max-h-32 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                  {results.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleDone} className="bg-blue-600 hover:bg-blue-700">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
