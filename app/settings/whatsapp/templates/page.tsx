'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCcw, Download, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useToast } from '@/lib/hooks/useToast';

interface Template {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  category: string;
  language: string;
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED';
  body: string;
  variables: string[];
  buttons?: Array<{ id: string; type: string; text: string }>;
  lastSynced: string;
}

export default function TemplateLibraryPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    language: 'all',
    search: '',
  });
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadTemplates();
    
    // Auto-sync every 15 minutes
    const interval = setInterval(() => {
      syncTemplates();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [filters]);

  const loadTemplates = async () => {
    try {
      const params = new URLSearchParams({
        status: filters.status !== 'all' ? filters.status : '',
        category: filters.category !== 'all' ? filters.category : '',
        language: filters.language !== 'all' ? filters.language : '',
        search: filters.search,
      });

      const response = await fetch(`/api/whatsapp/templates?${params}`);
      if (!response.ok) throw new Error('Failed to load templates');
      
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('[TemplateLibrary] Failed to load templates', error);
      toast.error('Failed to load templates');
    }
  };

  const syncTemplates = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/settings/whatsapp/templates/sync', {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Sync failed');
      
      const result = await response.json();
      setLastSync(new Date());
      await loadTemplates();
      
      toast.success(`Synced ${result.synced || 0} templates. ${result.statusChanges || 0} status changes.`);
    } catch (error) {
      console.error('[TemplateLibrary] Sync failed', error);
      toast.error('Failed to sync templates from Meta');
    } finally {
      setSyncing(false);
    }
  };

  const importFromMeta = async () => {
    try {
      const response = await fetch('/api/settings/whatsapp/templates/import', {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Import failed');
      
      const result = await response.json();
      await loadTemplates();
      
      toast.success(`Imported ${result.imported || 0} templates, updated ${result.updated || 0}`);
    } catch (error) {
      console.error('[TemplateLibrary] Import failed', error);
      toast.error('Failed to import templates from Meta');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      APPROVED: { variant: 'default', icon: CheckCircle2 },
      PENDING: { variant: 'secondary', icon: AlertCircle },
      REJECTED: { variant: 'destructive', icon: XCircle },
    };
    
    const config = variants[status] || variants.PENDING;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getQualityBadge = (rating?: string) => {
    if (!rating) return null;
    
    const colors: Record<string, string> = {
      GREEN: 'bg-green-100 text-green-800 border-green-200',
      YELLOW: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      RED: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <Badge variant="outline" className={colors[rating]}>
        Quality: {rating}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Library</h1>
          <p className="text-muted-foreground">
            Manage WhatsApp message templates
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={syncTemplates} variant="outline" disabled={syncing}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Button onClick={importFromMeta}>
            <Download className="h-4 w-4 mr-2" />
            Import from Meta
          </Button>
        </div>
      </div>

      {/* Sync Status */}
      {lastSync && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last synced: {lastSync.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters({ ...filters, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                  <SelectItem value="ORDER">Order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Language</label>
              <Select
                value={filters.language}
                onValueChange={(value) => setFilters({ ...filters, language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <Input
                placeholder="Search templates..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Grid */}
      <div className="grid grid-cols-1 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    {getStatusBadge(template.status)}
                    {getQualityBadge(template.qualityRating)}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span>Category: {template.category}</span>
                    <span>•</span>
                    <span>Language: {template.language.toUpperCase()}</span>
                    <span>•</span>
                    <span>Variables: {template.variables?.length || 0}</span>
                    {template.buttons && (
                      <>
                        <span>•</span>
                        <span>Buttons: {template.buttons.length}</span>
                      </>
                    )}
                  </div>

                  <div className="text-sm text-foreground mb-3 line-clamp-2">
                    {template.body}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last synced: {new Date(template.lastSynced).toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <Button size="sm" variant="outline">
                    View Details
                  </Button>
                  {template.status === 'APPROVED' && (
                    <Button size="sm">
                      Test Template
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-muted-foreground mb-4">No templates found</p>
            <Button onClick={importFromMeta}>
              Import from Meta Business Manager
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

