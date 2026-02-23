'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Bell, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  storeId: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Notification | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'info',
    audience: 'all',
    storeId: '',
    expiresAt: '',
  });

  useEffect(() => { fetchNotifications(); }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/admin/notifications', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ title: '', message: '', type: 'info', audience: 'all', storeId: '', expiresAt: '' });
    setDialogOpen(true);
  }

  function openEdit(n: Notification) {
    setEditing(n);
    setForm({
      title: n.title,
      message: n.message,
      type: n.type,
      audience: n.audience,
      storeId: n.storeId || '',
      expiresAt: n.expiresAt ? n.expiresAt.split('T')[0] : '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        await fetch('/api/admin/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: editing.id, ...form, storeId: form.storeId || null, expiresAt: form.expiresAt || null }),
        });
      } else {
        await fetch('/api/admin/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...form, storeId: form.storeId || null, expiresAt: form.expiresAt || null }),
        });
      }
      setDialogOpen(false);
      fetchNotifications();
    } catch (err) {
      alert('Failed to save notification');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(n: Notification) {
    try {
      await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: n.id, isActive: !n.isActive }),
      });
      fetchNotifications();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  }

  async function deleteNotification(n: Notification) {
    if (!confirm(`Delete notification "${n.title}"?`)) return;
    try {
      await fetch(`/api/admin/notifications?id=${n.id}`, { method: 'DELETE', credentials: 'include' });
      fetchNotifications();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  const typeColor = (t: string) => {
    switch (t) {
      case 'info': return 'bg-blue-100 text-blue-700';
      case 'warning': return 'bg-yellow-100 text-yellow-700';
      case 'success': return 'bg-green-100 text-green-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const active = notifications.filter(n => n.isActive).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-gray-500 text-sm">Manage system announcements and banners</p>
        </div>
        <Button onClick={openCreate} className="gap-2" style={{ backgroundColor: '#5459AC' }}>
          <Plus className="h-4 w-4" /> Create Notification
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold text-green-600">{active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Inactive</div>
            <div className="text-2xl font-bold text-gray-400">{notifications.length - active}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No notifications yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Audience</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Expires</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map(n => (
                    <tr key={n.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium">{n.title}</div>
                        <div className="text-xs text-gray-400 truncate max-w-xs">{n.message}</div>
                      </td>
                      <td className="p-3"><Badge className={typeColor(n.type)}>{n.type}</Badge></td>
                      <td className="p-3"><Badge variant="outline">{n.audience}</Badge></td>
                      <td className="p-3">
                        <Badge className={n.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {n.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-500 text-xs">
                        {n.expiresAt ? new Date(n.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="p-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(n)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(n)}>
                            {n.isActive
                              ? <ToggleRight className="h-4 w-4 text-green-600" />
                              : <ToggleLeft className="h-4 w-4 text-gray-400" />
                            }
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteNotification(n)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Notification' : 'Create Notification'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update the notification details.' : 'Create a system-wide announcement.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Notification message..."
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-offset-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Audience</label>
                <Select value={form.audience} onValueChange={v => setForm({ ...form, audience: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="store_owners">Store Owners</SelectItem>
                    <SelectItem value="specific_store">Specific Store</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.audience === 'specific_store' && (
              <div>
                <label className="text-sm font-medium">Store ID</label>
                <Input value={form.storeId} onChange={e => setForm({ ...form, storeId: e.target.value })} placeholder="Store UUID" className="mt-1" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Expires At (optional)</label>
              <Input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.message} style={{ backgroundColor: '#5459AC' }}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
