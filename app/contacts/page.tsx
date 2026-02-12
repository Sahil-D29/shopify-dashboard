'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import ContactsTable, { type Contact } from '@/components/contacts/ContactsTable';
import ContactForm, { type ContactFormData } from '@/components/contacts/ContactForm';
import ImportCSVModal from '@/components/contacts/ImportCSVModal';
import {
  Plus,
  Search,
  Upload,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Clock,
  Tag,
  Trash2,
  UserMinus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 25;

export default function ContactsPage() {
  const router = useRouter();

  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [optInFilter, setOptInFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', PAGE_SIZE.toString());
      if (searchQuery) params.set('search', searchQuery);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (optInFilter !== 'ALL') params.set('optInStatus', optInFilter);

      const res = await fetch(`/api/contacts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load contacts');

      const data = await res.json();
      if (!isMountedRef.current) return;

      setContacts(data.contacts || []);
      setTotalCount(data.total || 0);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      if (isMountedRef.current) {
        setContacts([]);
        setTotalCount(0);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [page, searchQuery, sourceFilter, optInFilter]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchQuery(value);
      setPage(1);
      setSelectedIds(new Set());
    }, 300);
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  };

  const handleAddContact = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add contact');
      }
      setShowAddDialog(false);
      loadContacts();
    } catch (error) {
      console.error('Failed to add contact:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncShopify = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/contacts/sync-shopify', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      loadContacts();
    } catch (error) {
      console.error('Failed to sync Shopify contacts:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} contact(s)?`)) return;
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', contactIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        loadContacts();
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
    }
  };

  const handleBulkOptOut = async () => {
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'optOut', contactIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        loadContacts();
      }
    } catch (error) {
      console.error('Bulk opt-out failed:', error);
    }
  };

  const handleBulkTag = async () => {
    const tag = prompt('Enter tag name to apply:');
    if (!tag?.trim()) return;
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tag', contactIds: Array.from(selectedIds), tag: tag.trim() }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        loadContacts();
      }
    } catch (error) {
      console.error('Bulk tag failed:', error);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Stats
  const stats = {
    total: totalCount,
    optedIn: contacts.filter(c => c.optInStatus === 'OPTED_IN').length,
    optedOut: contacts.filter(c => c.optInStatus === 'OPTED_OUT').length,
    pending: contacts.filter(c => c.optInStatus === 'PENDING').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="text-gray-600 mt-1">
              Manage your WhatsApp contacts, import from CSV, or sync from Shopify
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleSyncShopify}
              variant="outline"
              disabled={syncing}
              className="whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Shopify'}
            </Button>
            <Button
              onClick={() => setShowImportCSV(true)}
              variant="outline"
              className="whitespace-nowrap"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{stats.total.toLocaleString()}</div>
          <div className="text-sm opacity-90">Total Contacts</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UserCheck className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{stats.optedIn}</div>
          <div className="text-sm opacity-90">Opted In</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UserX className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{stats.optedOut}</div>
          <div className="text-sm opacity-90">Opted Out</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{stats.pending}</div>
          <div className="text-sm opacity-90">Pending</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by name, phone, or email..."
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </div>

          {/* Source Filter */}
          <div>
            <select
              value={sourceFilter}
              onChange={e => {
                setSourceFilter(e.target.value);
                setPage(1);
                setSelectedIds(new Set());
              }}
              className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Sources</option>
              <option value="SHOPIFY">Shopify</option>
              <option value="CSV">CSV Import</option>
              <option value="MANUAL">Manual</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </div>

          {/* Opt-in Filter */}
          <div>
            <select
              value={optInFilter}
              onChange={e => {
                setOptInFilter(e.target.value);
                setPage(1);
                setSelectedIds(new Set());
              }}
              className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Opt-in Status</option>
              <option value="OPTED_IN">Opted In</option>
              <option value="OPTED_OUT">Opted Out</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700">
            {selectedIds.size} contact{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBulkTag}>
              <Tag className="w-4 h-4 mr-1" />
              Tag
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkOptOut}>
              <UserMinus className="w-4 h-4 mr-1" />
              Opt Out
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkDelete} className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery || sourceFilter !== 'ALL' || optInFilter !== 'ALL'
                ? 'No contacts match your filters'
                : 'No contacts yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || sourceFilter !== 'ALL' || optInFilter !== 'ALL'
                ? 'Try adjusting your search or filters'
                : 'Add contacts manually, import from CSV, or sync from Shopify'}
            </p>
            {!searchQuery && sourceFilter === 'ALL' && optInFilter === 'ALL' && (
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setShowImportCSV(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
                <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <ContactsTable
              contacts={contacts}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} contacts
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage(p => p - 1);
                      setSelectedIds(new Set());
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-700 px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setPage(p => p + 1);
                      setSelectedIds(new Set());
                    }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to your WhatsApp contact list.
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            onSubmit={handleAddContact}
            onCancel={() => setShowAddDialog(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Import CSV Modal */}
      <ImportCSVModal
        open={showImportCSV}
        onOpenChange={setShowImportCSV}
        onImportComplete={() => loadContacts()}
      />
    </div>
  );
}
