'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Download, X, Loader2, CheckCircle2 } from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { fetchWithConfig } from '@/lib/fetch-with-config';

interface CreateCustomerPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  accepts_marketing: boolean;
  note?: string;
  addresses?: Array<{
    address1?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  }>;
  tags?: string[];
}

export interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  orders_count?: number;
  total_spent?: string;
  state?: string;
  created_at?: string;
  addresses?: Array<{
    address1?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  }>;
  tags?: string;
  note?: string;
}

interface CustomerManagementProps {
  customers: Customer[];
  onRefresh?: () => void;
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function CustomerManagement({ customers, onRefresh }: CustomerManagementProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address1: '',
    city: '',
    province: '',
    zip: '',
    country: '',
    accepts_marketing: false,
    tags: '',
    note: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const customerData: CreateCustomerPayload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        accepts_marketing: formData.accepts_marketing,
        note: formData.note,
      };

      // Add address if provided
      if (formData.address1 || formData.city || formData.province || formData.zip || formData.country) {
        customerData.addresses = [
          {
            address1: formData.address1,
            city: formData.city,
            province: formData.province,
            zip: formData.zip,
            country: formData.country,
          },
        ];
      }

      // Add tags if provided
      if (formData.tags) {
        customerData.tags = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
      }

      const response = await fetchWithConfig('/api/shopify/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customer: customerData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create customer');
      }

      setSubmitSuccess(true);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address1: '',
        city: '',
        province: '',
        zip: '',
        country: '',
        accepts_marketing: false,
        tags: '',
        note: '',
      });
      setErrors({});

      setTimeout(() => {
        setShowAddModal(false);
        setSubmitSuccess(false);
        if (onRefresh) {
          onRefresh();
        }
      }, 1500);
    } catch (error) {
      setErrors({ submit: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);

    try {
      // Prepare CSV data - handle empty customers list
      const csvData = customers.length > 0 
        ? customers.map((customer) => ({
            Name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
            Email: customer.email || '',
            Phone: customer.phone || '',
            Orders: customer.orders_count || 0,
            'Total Spent': customer.total_spent || '0',
            Status: customer.state || 'enabled',
            Location: customer.addresses?.[0]
              ? `${customer.addresses[0].city || ''}, ${customer.addresses[0].province || ''}`.trim()
              : '',
            'Date Created': customer.created_at ? format(new Date(customer.created_at), 'yyyy-MM-dd') : '',
            Tags: customer.tags || '',
          }))
        : [{
            Name: '',
            Email: '',
            Phone: '',
            Orders: 0,
            'Total Spent': '0',
            Status: '',
            Location: '',
            'Date Created': '',
            Tags: '',
          }];

      // Generate CSV
      const csv = Papa.unparse(csvData);

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `customers_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export customers to CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExportCSV} disabled={isExporting} variant="outline">
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export to CSV
              </>
            )}
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <div className="mb-6 pb-4 border-b relative">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Add New Customer</h2>
                  <p className="text-sm text-gray-600 mt-1">Create a new customer in your Shopify store</p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => {
                        setFormData({ ...formData, first_name: e.target.value });
                        if (errors.first_name) setErrors({ ...errors, first_name: '' });
                      }}
                      className={errors.first_name ? 'border-red-500' : ''}
                      aria-invalid={!!errors.first_name}
                      aria-describedby={errors.first_name ? 'first_name_error' : undefined}
                    />
                    {errors.first_name && (
                      <p id="first_name_error" className="text-sm text-red-500" role="alert">{errors.first_name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => {
                        setFormData({ ...formData, last_name: e.target.value });
                        if (errors.last_name) setErrors({ ...errors, last_name: '' });
                      }}
                      className={errors.last_name ? 'border-red-500' : ''}
                      aria-invalid={!!errors.last_name}
                      aria-describedby={errors.last_name ? 'last_name_error' : undefined}
                    />
                    {errors.last_name && (
                      <p id="last_name_error" className="text-sm text-red-500" role="alert">{errors.last_name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (errors.email) setErrors({ ...errors, email: '' });
                    }}
                    className={errors.email ? 'border-red-500' : ''}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email_error' : undefined}
                  />
                  {errors.email && (
                    <p id="email_error" className="text-sm text-red-500" role="alert">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (errors.phone) setErrors({ ...errors, phone: '' });
                    }}
                    className={errors.phone ? 'border-red-500' : ''}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone_error' : undefined}
                  />
                  {errors.phone && (
                    <p id="phone_error" className="text-sm text-red-500" role="alert">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    placeholder="Street Address"
                    value={formData.address1}
                    onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Input
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                  <Input
                    placeholder="State/Province"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  />
                  <Input
                    placeholder="ZIP Code"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Input
                    placeholder="Country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="VIP, Newsletter, etc."
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">Notes</Label>
                  <Textarea
                    id="note"
                    placeholder="Internal notes about this customer..."
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="accepts_marketing"
                    checked={formData.accepts_marketing}
                    onChange={(e) => setFormData({ ...formData, accepts_marketing: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="accepts_marketing" className="font-normal cursor-pointer">
                    Marketing opt-in
                  </Label>
                </div>

                {errors.submit && (
                  <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm border border-red-200" role="alert" aria-live="polite">
                    {errors.submit}
                  </div>
                )}

                {submitSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 text-green-800">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Customer created successfully!</span>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Customer'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

