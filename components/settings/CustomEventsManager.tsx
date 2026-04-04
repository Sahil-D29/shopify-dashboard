"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Code, Loader2, Pencil, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useTenant } from '@/lib/tenant/tenant-context';

interface EventProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description?: string;
  required?: boolean;
}

interface CustomEventDef {
  id: string;
  eventName: string;
  displayName: string;
  description?: string | null;
  category: string;
  properties: EventProperty[];
  isActive: boolean;
  eventCount: number;
  lastSeenAt: string | null;
  createdAt: string;
}

export function CustomEventsManager() {
  const { currentStore } = useTenant();
  const [events, setEvents] = useState<CustomEventDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CustomEventDef | null>(null);
  const [editingEvent, setEditingEvent] = useState<CustomEventDef | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [properties, setProperties] = useState<EventProperty[]>([]);

  const storeId = currentStore?.id;

  const fetchEvents = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch('/api/settings/custom-events', {
        headers: { 'x-store-id': storeId },
      });
      const data = await res.json();
      if (data.success) setEvents(data.events);
    } catch {
      toast.error('Failed to load custom events');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const resetForm = () => {
    setDisplayName('');
    setDescription('');
    setProperties([]);
    setEditingEvent(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (event: CustomEventDef) => {
    setEditingEvent(event);
    setDisplayName(event.displayName);
    setDescription(event.description || '');
    setProperties(event.properties || []);
    setDialogOpen(true);
  };

  const openSnippet = (event: CustomEventDef) => {
    setSelectedEvent(event);
    setSnippetOpen(true);
  };

  const addProperty = () => {
    setProperties([...properties, { name: '', type: 'string', required: false }]);
  };

  const removeProperty = (index: number) => {
    setProperties(properties.filter((_, i) => i !== index));
  };

  const updateProperty = (index: number, field: keyof EventProperty, value: unknown) => {
    const updated = [...properties];
    (updated[index] as Record<string, unknown>)[field] = value;
    setProperties(updated);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  };

  const handleSave = async () => {
    if (!storeId || !displayName.trim()) return;

    setSaving(true);
    try {
      const payload = {
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        properties: properties.filter((p) => p.name.trim()),
      };

      if (editingEvent) {
        const res = await fetch(`/api/settings/custom-events/${editingEvent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-store-id': storeId },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success('Event updated');
      } else {
        const res = await fetch('/api/settings/custom-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-store-id': storeId },
          body: JSON.stringify({
            ...payload,
            eventName: generateSlug(displayName),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success('Event created');
      }

      setDialogOpen(false);
      resetForm();
      fetchEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (event: CustomEventDef) => {
    if (!storeId) return;
    try {
      await fetch(`/api/settings/custom-events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-store-id': storeId },
        body: JSON.stringify({ isActive: !event.isActive }),
      });
      fetchEvents();
      toast.success(event.isActive ? 'Event deactivated' : 'Event activated');
    } catch {
      toast.error('Failed to update event');
    }
  };

  const getSnippet = (event: CustomEventDef) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.com';
    return `curl -X POST ${baseUrl}/api/v1/events \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "eventName": "${event.eventName}",
  "email": "customer@example.com",
  "properties": {${event.properties.map((p) => `\n    "${p.name}": ${p.type === 'number' ? '0' : p.type === 'boolean' ? 'true' : '"value"'}`).join(',')}
  }
}'`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Custom Events</CardTitle>
            <CardDescription>
              Define custom events that third-party services can send to your dashboard.
              These events can be used in journeys, segments, campaigns, and analytics.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Create Event
          </Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No custom events defined yet.</p>
              <p className="text-sm mt-1">Create your first event to start receiving data from third-party services.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Properties</TableHead>
                  <TableHead>Event Count</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.displayName}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{event.eventName}</code>
                    </TableCell>
                    <TableCell>{(event.properties || []).length}</TableCell>
                    <TableCell>{event.eventCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {event.lastSeenAt
                        ? new Date(event.lastSeenAt).toLocaleDateString()
                        : <span className="text-muted-foreground">Never</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.isActive ? 'default' : 'secondary'}>
                        {event.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openSnippet(event)} title="Code snippet">
                          <Code className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(event)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Switch checked={event.isActive} onCheckedChange={() => toggleActive(event)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Custom Event'}</DialogTitle>
            <DialogDescription>
              {editingEvent
                ? 'Update event display name, description, or properties.'
                : 'Define a new custom event that external services can send.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Checkout Initiated"
              />
              {!editingEvent && displayName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Slug: <code>{generateSlug(displayName)}</code>
                </p>
              )}
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Fired when a customer starts checkout on Shiprocket"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Properties</Label>
                <Button variant="outline" size="sm" onClick={addProperty}>
                  <Plus className="h-3 w-3 mr-1" /> Add Property
                </Button>
              </div>

              {properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No properties defined. Add properties to define the data schema for this event.
                </p>
              ) : (
                <div className="space-y-2">
                  {properties.map((prop, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        placeholder="Property name"
                        value={prop.name}
                        onChange={(e) => updateProperty(index, 'name', e.target.value)}
                      />
                      <Select
                        value={prop.type}
                        onValueChange={(v) => updateProperty(index, 'type', v)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => removeProperty(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !displayName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingEvent ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Code Snippet Dialog */}
      <Dialog open={snippetOpen} onOpenChange={setSnippetOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>API Code Snippet</DialogTitle>
            <DialogDescription>
              Use this cURL command to send &quot;{selectedEvent?.displayName}&quot; events from your integration.
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                {getSnippet(selectedEvent)}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => {
                  navigator.clipboard.writeText(getSnippet(selectedEvent));
                  toast.success('Copied to clipboard');
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnippetOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
