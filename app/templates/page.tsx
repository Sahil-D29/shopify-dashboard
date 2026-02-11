"use client";

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RefreshCw, Plus, Search, CheckCircle } from 'lucide-react';
import { WhatsAppConfigManager } from '@/lib/whatsapp-config';
import { WhatsAppTemplate, TemplateStatus, TemplateCategory } from '@/lib/types/template';
import CreateTemplateModal from '@/components/templates/CreateTemplateModal';
import TemplateCard from '@/components/templates/TemplateCard';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/lib/hooks/useToast';
import { getWindowStorage } from '@/lib/window-storage';

interface TemplateListResponse {
  templates?: WhatsAppTemplate[];
  error?: string;
}

interface SyncTemplatesResponse {
  syncedCount?: number;
  templates?: WhatsAppTemplate[];
  error?: string;
  details?: unknown;
}

interface DeleteResponse {
  error?: string;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function TemplatesPage() {
  const [configured, setConfigured] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TemplateStatus | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'ALL'>('ALL');
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [editTemplate, setEditTemplate] = useState<WhatsAppTemplate | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; templateId: string | null }>({
    isOpen: false,
    templateId: null,
  });

  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Get WhatsApp config to pass in headers
      const config = WhatsAppConfigManager.getConfig();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add WhatsApp config to headers if available
      if (config?.wabaId && config?.accessToken) {
        headers['X-WhatsApp-Config'] = JSON.stringify({
          wabaId: config.wabaId,
          accessToken: config.accessToken,
        });
      }

      const res = await fetch('/api/whatsapp/templates', {
        cache: 'no-store',
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as TemplateListResponse;
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to load templates');
      }
      setTemplates(data.templates ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load templates'));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setConfigured(Boolean(WhatsAppConfigManager.getConfig()));
    void load();

    if (typeof window !== 'undefined') {
      const storage = getWindowStorage();
      const stored = storage.get('whatsapp_templates_last_sync');
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed)) {
          setLastSyncTime(parsed);
        }
      }
    }
  }, [load]);

  // Auto-sync on page load if no recent sync (tries with config or env vars)
  useEffect(() => {
    // Early return if already syncing or loading
    if (syncing || loading) {
      return;
    }

    const shouldAutoSync = (): boolean => {
      if (!lastSyncTime) return true; // Never synced
      const hoursSinceSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);
      return hoursSinceSync >= 1; // Sync if last sync was more than 1 hour ago
    };

    if (!shouldAutoSync()) {
      return;
    }

    // Auto-sync in background after initial load
    const timer = setTimeout(() => {
      const cfg = WhatsAppConfigManager.getConfig();
      setSyncing(true);
      
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      let body: string;

      if (cfg?.wabaId && cfg?.accessToken) {
        body = JSON.stringify({ wabaId: cfg.wabaId, accessToken: cfg.accessToken });
        headers['X-WhatsApp-Config'] = JSON.stringify({
          wabaId: cfg.wabaId,
          accessToken: cfg.accessToken,
        });
      } else {
        // Try with env vars (API route will handle)
        body = JSON.stringify({});
      }
      
      fetch('/api/whatsapp/templates/sync', {
        method: 'POST',
        headers,
        body,
      })
        .then(async (response) => {
          const result = (await response.json().catch(() => ({}))) as SyncTemplatesResponse;
          if (response.ok) {
            const syncTime = Date.now();
            setLastSyncTime(syncTime);
            const storage = getWindowStorage();
            storage.set('whatsapp_templates_last_sync', syncTime.toString());
            await load();
          } else {
            // Silent fail for auto-sync - don't show error toast
            console.log('Auto-sync failed (silent):', result.error);
          }
        })
        .catch(() => {
          // Silent fail for auto-sync
        })
        .finally(() => {
          setSyncing(false);
        });
    }, 2000); // Wait 2 seconds after page load
    
    return () => clearTimeout(timer);
  }, [lastSyncTime, syncing, loading, load]);

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.body.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleDelete = async () => {
    if (!deleteDialog.templateId) return;

    try {
      const response = await fetch(`/api/whatsapp/templates/${deleteDialog.templateId}`, {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => ({}))) as DeleteResponse;

      if (response.ok) {
        toast.success('Template deleted successfully!');
        await load();
      } else {
        toast.error(payload.error ?? 'Failed to delete template');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Error deleting template'));
    } finally {
      setDeleteDialog({ isOpen: false, templateId: null });
    }
  };

  const handleEdit = (template: WhatsAppTemplate) => {
    setEditTemplate(template);
    setOpen(true);
  };

  const handleModalClose = () => {
    setOpen(false);
    setEditTemplate(null);
  };

  const handleModalSuccess = () => {
    load();
    handleModalClose();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Get config from localStorage (if configured in Settings)
      const cfg = WhatsAppConfigManager.getConfig();
      
      // Prepare headers and body
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      let body: string;

      if (cfg?.wabaId && cfg?.accessToken) {
        // Use config from Settings page
        body = JSON.stringify({ wabaId: cfg.wabaId, accessToken: cfg.accessToken });
        headers['X-WhatsApp-Config'] = JSON.stringify({
          wabaId: cfg.wabaId,
          accessToken: cfg.accessToken,
        });
        console.log('📤 Syncing with config from Settings page');
      } else {
        // Try to sync without credentials - API will use env vars as fallback
        body = JSON.stringify({});
        console.log('📤 Syncing with environment variables (fallback)');
      }
      
      const response = await fetch('/api/whatsapp/templates/sync', {
        method: 'POST',
        headers,
        body,
      });

      const result = (await response.json().catch(() => ({}))) as SyncTemplatesResponse;

      if (response.ok) {
        const syncTime = Date.now();
        setLastSyncTime(syncTime);
        const storage = getWindowStorage();
        storage.set('whatsapp_templates_last_sync', syncTime.toString());

        toast.success(`✅ Synced ${result.syncedCount ?? 0} templates from WhatsApp Manager!`);
        await load();
      } else {
        toast.error(`❌ Sync failed: ${result.error ?? 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, '❌ Network error during sync'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-8 max-w-[1920px] mx-auto">
      {/* Config warning banner */}
      {!configured && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>WhatsApp is not configured. You can still view and edit local templates. Configure WhatsApp in Settings to sync and send.</CardDescription>
          </CardHeader>
        </Card>
      )}
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight truncate">Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and manage WhatsApp message templates
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          <Button
            onClick={handleSync}
            disabled={syncing}
            variant="outline"
            className="whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from WhatsApp Manager'}
          </Button>
          
          {/* Show last sync time */}
          {lastSyncTime && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="hidden sm:inline">Last synced:</span>
              <span>{new Date(lastSyncTime).toLocaleString()}</span>
            </div>
          )}
          
          <Button
            onClick={() => {
              setEditTemplate(null);
              setOpen(true);
            }}
            className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Filters - Improved responsiveness */}
      <div className="bg-white rounded-lg border p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TemplateStatus | 'ALL')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as TemplateCategory | 'ALL')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Categories</option>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </div>
        </div>
      </div>

      {/* Templates Grid - Fixed layout */}
      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {templates.length === 0 ? 'No templates created yet' : 'No templates match your filters'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onDelete={(id) => setDeleteDialog({ isOpen: true, templateId: id })}
              onRefresh={load}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      <CreateTemplateModal 
        open={open} 
        onClose={handleModalClose} 
        onCreated={handleModalSuccess}
        editTemplate={editTemplate}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, templateId: null })}
        onConfirm={handleDelete}
        title="Delete Template?"
        message="Are you sure you want to delete this template? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}


