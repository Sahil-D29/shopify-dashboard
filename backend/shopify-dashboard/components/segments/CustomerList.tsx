'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Customer } from '@/lib/types/customer';
import { Search, Download, MessageSquare, Phone, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fetchWithConfig } from '@/lib/fetch-with-config';

interface Props {
  segmentId: string;
  segmentName: string;
}

type SortOrder = 'asc' | 'desc';

interface SegmentCustomersResponse {
  customers: Customer[];
  total: number;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (timestamp?: number): string => {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function CustomerList({ segmentId, segmentName }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<string>('totalSpent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const router = useRouter();

  const fetchCustomers = useCallback(
    async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        sortBy,
        sortOrder,
      });

      const response = await fetchWithConfig(`/api/segments/${segmentId}/customers?${params.toString()}`, { signal });
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = (await response.json()) as SegmentCustomersResponse;

      setCustomers(data.customers ?? []);
      setTotal(data.total ?? 0);
      // Clear selection if list changes
      setSelectedCustomers(new Set());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
    },
    [page, search, segmentId, sortBy, sortOrder],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchCustomers(controller.signal);
    return () => controller.abort();
  }, [fetchCustomers]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const toggleSelectCustomer = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) newSelected.delete(customerId);
    else newSelected.add(customerId);
    setSelectedCustomers(newSelected);
  };

  const allSelected = useMemo(() => customers.length > 0 && selectedCustomers.size === customers.length, [customers, selectedCustomers]);

  const toggleSelectAll = () => {
    if (allSelected) setSelectedCustomers(new Set());
    else setSelectedCustomers(new Set(customers.map(c => c.id)));
  };

  const exportCustomers = () => {
    const headers = ['Email', 'Name', 'Phone', 'Total Orders', 'Total Spent', 'Last Order'];
    const rows = customers.map(c => [
      c.email,
      `${c.firstName} ${c.lastName}`,
      c.phone || '',
      String(c.totalOrders),
      String(c.totalSpent),
      formatDate(c.lastOrderDate),
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${segmentName}_customers.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkWhatsApp = () => {
    if (selectedCustomers.size === 0) return;
    const selectedIds = customers
      .filter(c => selectedCustomers.has(c.id))
      .map(c => c.id);
    const params = new URLSearchParams({
      segmentId,
      customerIds: selectedIds.join(','),
    });
    router.push(`/campaigns/create?${params.toString()}`);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronDown className="inline w-4 h-4 text-gray-300 ml-1" />;
    return sortOrder === 'asc' ? (
      <ChevronUp className="inline w-4 h-4 text-gray-500 ml-1" />
    ) : (
      <ChevronDown className="inline w-4 h-4 text-gray-500 ml-1" />
    );
  };

  if (loading && customers.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <div className="text-gray-600">Loading customers…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkWhatsApp}
            disabled={selectedCustomers.size === 0}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare className="w-4 h-4" />
            {selectedCustomers.size > 0 ? `Send WhatsApp (${selectedCustomers.size})` : 'Send WhatsApp'}
          </button>
          <button onClick={exportCustomers} className="px-3 py-2 border rounded-lg hover:bg-gray-50 inline-flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('firstName')}
                >
                  Customer <SortIcon field="firstName" />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('email')}
                >
                  Contact <SortIcon field="email" />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalOrders')}
                >
                  Orders <SortIcon field="totalOrders" />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalSpent')}
                >
                  Total Spent <SortIcon field="totalSpent" />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('lastOrderDate')}
                >
                  Last Order <SortIcon field="lastOrderDate" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.has(customer.id)}
                      onChange={() => toggleSelectCustomer(customer.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium">
                        {customer.firstName?.[0] ?? ''}
                        {customer.lastName?.[0] ?? ''}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {customer.city}, {customer.country}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{customer.email}</div>
                    {customer.phone && (
                      <div className="text-xs text-gray-500 inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {customer.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{customer.totalOrders}</div>
                    <div className="text-xs text-gray-500">{customer.orderFrequency}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(customer.totalSpent)}</div>
                    <div className="text-xs text-gray-500">Avg: {formatCurrency(customer.averageOrderValue)}</div>
                  </td>
                  <td className="px-4 py-3">{formatDate(customer.lastOrderDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        customer.riskLevel === 'low'
                          ? 'bg-green-100 text-green-800'
                          : customer.riskLevel === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {customer.riskLevel === 'low' ? 'Active' : customer.riskLevel === 'medium' ? 'At Risk' : 'Churned'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const phone = (customer.phone || '').trim();
                          const name = `${customer.firstName} ${customer.lastName}`.trim();
                          if (!phone) return;
                          const url = `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(`Hello ${name}`)}`;
                          window.open(url, '_blank');
                        }}
                        className="px-2 py-1 border rounded hover:bg-gray-50 text-xs inline-flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" /> WhatsApp
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-4 py-3 flex items-center justify-between border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} customers
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * 20 >= total}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {customers.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <div className="text-gray-400 mb-2">
            <Filter className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No customers found</h3>
          <p className="text-gray-500">
            {search ? 'Try adjusting your search terms' : 'This segment has no customers yet'}
          </p>
        </div>
      )}
    </div>
  );
}


