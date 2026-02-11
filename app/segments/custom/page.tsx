'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Upload, Search, Users, X, FileText, CheckCircle2, AlertCircle,
  Loader2, Plus, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { CustomerImportModal } from '@/components/segments/CustomerImportModal';

interface Customer {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export default function CustomAudiencePage() {
  const router = useRouter();
  const [segmentName, setSegmentName] = useState('');
  const [segmentDescription, setSegmentDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load customers on mount
  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/customers?limit=1000');
      const data = await res.json();
      if (data.customers) {
        const formatted = data.customers.map((c: any) => ({
          id: c.id || `cust_${Date.now()}_${Math.random()}`,
          email: c.email || c.customer_email || '',
          phone: c.phone || c.customer_phone || '',
          firstName: c.first_name || c.firstName || '',
          lastName: c.last_name || c.lastName || '',
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
        }));
        setAllCustomers(formatted);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter customers based on search
  const filteredCustomers = allCustomers.filter(customer => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.name?.toLowerCase().includes(query) ||
      customer.firstName?.toLowerCase().includes(query) ||
      customer.lastName?.toLowerCase().includes(query)
    );
  });

  // Add customer to selection
  const addCustomer = (customer: Customer) => {
    if (!selectedCustomers.find(c => c.id === customer.id)) {
      setSelectedCustomers([...selectedCustomers, customer]);
    }
  };

  // Remove customer from selection
  const removeCustomer = (customerId: string) => {
    setSelectedCustomers(selectedCustomers.filter(c => c.id !== customerId));
  };

  // Bulk select from filtered results
  const bulkSelect = () => {
    const toAdd = filteredCustomers.filter(
      c => !selectedCustomers.find(sc => sc.id === c.id)
    );
    setSelectedCustomers([...selectedCustomers, ...toAdd]);
  };

  // Handle CSV/Excel import (modal may use Customer with id?: string)
  const handleImportComplete = (importedCustomers: Array<{ id?: string; email?: string; [key: string]: any }>) => {
    const normalized: Customer[] = importedCustomers.map(c => ({
      id: c.id ?? `cust_${Date.now()}_${Math.random()}`,
      email: c.email ?? '',
      phone: c.phone,
      firstName: c.firstName,
      lastName: c.lastName,
      name: c.name,
    }));
    const existingIds = new Set(selectedCustomers.map(c => c.id));
    const newCustomers = normalized.filter(c => !existingIds.has(c.id));
    setSelectedCustomers([...selectedCustomers, ...newCustomers]);
    setIsImportModalOpen(false);
    toast.success(`Imported ${importedCustomers.length} customers`);
  };

  // Save custom segment
  const handleSave = async () => {
    if (!segmentName.trim()) {
      toast.error('Please enter a segment name');
      return;
    }

    if (selectedCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: segmentName,
          description: segmentDescription,
          type: 'custom',
          customerIds: selectedCustomers.map(c => c.id),
          source: 'manual',
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create segment');
      }

      toast.success('Custom segment created successfully!');
      router.push('/segments');
    } catch (error: any) {
      console.error('Error creating segment:', error);
      toast.error(error.message || 'Failed to create segment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Custom Audience</h1>
          <p className="text-muted-foreground">
            Manually select customers or import from CSV/Excel
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/segments')}>
          Cancel
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Segment Details & Customer Search */}
        <div className="space-y-6">
          {/* Segment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Segment Details</CardTitle>
              <CardDescription>Name and describe your custom audience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Segment Name *</Label>
                <Input
                  id="name"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  placeholder="e.g., VIP Customers, Product Launch List"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={segmentDescription}
                  onChange={(e) => setSegmentDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Customer Search */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Search Customers</CardTitle>
                  <CardDescription>Find and add customers to your audience</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadCustomers}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Search by email, phone, or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredCustomers.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {filteredCustomers.length} customers found
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={bulkSelect}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Select All
                  </Button>
                </div>
              )}

              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredCustomers.slice(0, 50).map(customer => {
                  const isSelected = selectedCustomers.some(c => c.id === customer.id);
                  return (
                    <div
                      key={customer.id}
                      className={`p-3 border rounded-lg flex items-center justify-between ${
                        isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{customer.name || customer.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {customer.email} {customer.phone && `• ${customer.phone}`}
                        </p>
                      </div>
                      {isSelected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomer(customer.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addCustomer(customer)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Selected Customers & Actions */}
        <div className="space-y-6">
          {/* Selected Customers */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Selected Customers</CardTitle>
                  <CardDescription>
                    {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected
                  </CardDescription>
                </div>
                {selectedCustomers.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCustomers([])}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No customers selected</p>
                  <p className="text-sm mt-2">Search and add customers or import from file</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedCustomers.map(customer => (
                    <div
                      key={customer.id}
                      className="p-3 border rounded-lg flex items-center justify-between bg-blue-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{customer.name || customer.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {customer.email} {customer.phone && `• ${customer.phone}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomer(customer.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import Options */}
          <Card>
            <CardHeader>
              <CardTitle>Import Options</CardTitle>
              <CardDescription>Import customers from CSV or Excel file</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsImportModalOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import from CSV/Excel
              </Button>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Card>
            <CardContent className="pt-6">
              <Button
                className="w-full"
                size="lg"
                onClick={handleSave}
                disabled={isSaving || !segmentName.trim() || selectedCustomers.length === 0}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create Segment ({selectedCustomers.length} customers)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Import Modal */}
      <CustomerImportModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportComplete}
      />
    </div>
  );
}

