'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, FileText, CheckCircle2, AlertCircle, X, Loader2,
  Download, AlertTriangle
} from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';

interface Customer {
  id?: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

interface ImportResult {
  customers: Customer[];
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: string[];
}

interface ColumnMapping {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (customers: Customer[]) => void;
}

export function CustomerImportModal({ open, onClose, onImport }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
  });
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/tab-separated-values',
    ];
    
    const validExtensions = ['.csv', '.xlsx', '.xls', '.tsv'];
    const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension)) {
      toast.error('Invalid file type. Please upload CSV or Excel file.');
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setPreviewData([]);
    setColumnMapping({ email: '', phone: '', firstName: '', lastName: '' });

    // Parse file
    parseFile(selectedFile);
  }, []);

  const parseFile = async (fileToParse: File) => {
    setIsProcessing(true);
    try {
      if (fileToParse.name.endsWith('.csv') || fileToParse.name.endsWith('.tsv')) {
        // Parse CSV
        Papa.parse(fileToParse, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              console.warn('CSV parsing errors:', results.errors);
            }
            handleParsedData(results.data, results.meta.fields || []);
          },
          error: (error) => {
            console.error('CSV parsing error:', error);
            toast.error('Failed to parse CSV file');
            setIsProcessing(false);
          },
        });
      } else {
        // For Excel files, we'd need xlsx library
        // For now, show error
        toast.error('Excel files (.xlsx, .xls) require additional setup. Please convert to CSV first.');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Failed to parse file');
      setIsProcessing(false);
    }
  };

  const handleParsedData = (data: any[], columns: string[]) => {
    setAvailableColumns(columns);
    setPreviewData(data.slice(0, 10)); // Show first 10 rows as preview

    // Auto-detect column mapping
    const emailColumn = columns.find(
      col => 
        col.toLowerCase().includes('email') || 
        col.toLowerCase().includes('e-mail')
    );
    const phoneColumn = columns.find(
      col => 
        col.toLowerCase().includes('phone') || 
        col.toLowerCase().includes('mobile') ||
        col.toLowerCase().includes('tel')
    );
    const firstNameColumn = columns.find(
      col => 
        col.toLowerCase().includes('first') && col.toLowerCase().includes('name') ||
        col.toLowerCase() === 'firstname' ||
        col.toLowerCase() === 'fname'
    );
    const lastNameColumn = columns.find(
      col => 
        col.toLowerCase().includes('last') && col.toLowerCase().includes('name') ||
        col.toLowerCase() === 'lastname' ||
        col.toLowerCase() === 'lname'
    );

    setColumnMapping({
      email: emailColumn || columns[0] || '',
      phone: phoneColumn || '',
      firstName: firstNameColumn || '',
      lastName: lastNameColumn || '',
    });

    setIsProcessing(false);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // Basic phone validation (digits, +, spaces, dashes, parentheses)
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  };

  const processImport = () => {
    if (!file || !columnMapping.email) {
      toast.error('Please select a file and map the email column');
      return;
    }

    setIsProcessing(true);
    const errors: string[] = [];
    const customers: Customer[] = [];
    let importedCount = 0;
    let skippedCount = 0;

    // Re-parse file to process all rows
    if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          results.data.forEach((row: any, index: number) => {
            const email = row[columnMapping.email]?.toString().trim();
            
            if (!email) {
              skippedCount++;
              errors.push(`Row ${index + 2}: Missing email`);
              return;
            }

            if (!validateEmail(email)) {
              skippedCount++;
              errors.push(`Row ${index + 2}: Invalid email format: ${email}`);
              return;
            }

            const phone = columnMapping.phone ? row[columnMapping.phone]?.toString().trim() : '';
            if (phone && !validatePhone(phone)) {
              // Warn but don't skip
              errors.push(`Row ${index + 2}: Invalid phone format: ${phone}`);
            }

            const customer: Customer = {
              id: `imported_${Date.now()}_${index}`,
              email,
              phone: phone || undefined,
              firstName: columnMapping.firstName ? row[columnMapping.firstName]?.toString().trim() : undefined,
              lastName: columnMapping.lastName ? row[columnMapping.lastName]?.toString().trim() : undefined,
            };

            customer.name = [customer.firstName, customer.lastName]
              .filter(Boolean)
              .join(' ') || customer.email;

            customers.push(customer);
            importedCount++;
          });

          const importResult: ImportResult = {
            customers,
            totalRows: results.data.length,
            importedRows: importedCount,
            skippedRows: skippedCount,
            errors: errors.slice(0, 20), // Limit errors shown
          };

          setResult(importResult);
          setIsProcessing(false);
        },
        error: (error) => {
          console.error('Error processing file:', error);
          toast.error('Failed to process file');
          setIsProcessing(false);
        },
      });
    }
  };

  const handleImport = () => {
    if (!result || result.customers.length === 0) {
      toast.error('No valid customers to import');
      return;
    }

    onImport(result.customers);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setPreviewData([]);
    setColumnMapping({ email: '', phone: '', firstName: '', lastName: '' });
    setAvailableColumns([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Customers from CSV/Excel</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with customer data. Map columns to customer fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          {!file && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-blue-600 hover:underline">Click to upload</span> or drag and drop
              </Label>
              <p className="text-sm text-muted-foreground mt-2">
                CSV, XLSX, XLS, TSV (Max 10MB)
              </p>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls,.tsv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* File Selected */}
          {file && !result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Column Mapping */}
              {availableColumns.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Map Columns</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email Column *</Label>
                      <select
                        className="w-full p-2 border rounded-md"
                        value={columnMapping.email}
                        onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                      >
                        <option value="">Select column...</option>
                        {availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Column</Label>
                      <select
                        className="w-full p-2 border rounded-md"
                        value={columnMapping.phone || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                      >
                        <option value="">None</option>
                        {availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>First Name Column</Label>
                      <select
                        className="w-full p-2 border rounded-md"
                        value={columnMapping.firstName || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, firstName: e.target.value })}
                      >
                        <option value="">None</option>
                        {availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name Column</Label>
                      <select
                        className="w-full p-2 border rounded-md"
                        value={columnMapping.lastName || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, lastName: e.target.value })}
                      >
                        <option value="">None</option>
                        {availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Preview */}
                  {previewData.length > 0 && (
                    <div className="space-y-2">
                      <Label>Preview (First 10 rows)</Label>
                      <div className="border rounded-lg overflow-auto max-h-48">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              {availableColumns.map(col => (
                                <th key={col} className="p-2 text-left border-b">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.map((row, i) => (
                              <tr key={i} className="border-b">
                                {availableColumns.map(col => (
                                  <td key={col} className="p-2">
                                    {row[col]?.toString().substring(0, 30) || ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={processImport}
                    disabled={isProcessing || !columnMapping.email}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Process Import
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Import Results */}
          {result && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Processed {result.totalRows} rows: {result.importedRows} imported, {result.skippedRows} skipped
                </AlertDescription>
              </Alert>

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">Errors ({result.errors.length}):</p>
                    <ul className="list-disc list-inside space-y-1 text-sm max-h-32 overflow-y-auto">
                      {result.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleImport}
                  disabled={result.customers.length === 0}
                  className="flex-1"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Import {result.importedRows} Customers
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

