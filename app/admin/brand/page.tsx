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
import { Palette, Plus, Pencil, Globe, Mail, Clock } from 'lucide-react';

interface Brand {
  id: string;
  storeId: string;
  brandName: string;
  brandLogo: string | null;
  brandColor: string;
  brandSecondaryColor: string | null;
  timezone: string;
  industryType: string | null;
  emailSignature: string | null;
  socialLinks: Record<string, string> | null;
  settings: Record<string, any> | null;
  createdAt: string;
}

interface StoreOption {
  id: string;
  storeName: string;
}

export default function BrandPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    storeId: '',
    brandName: '',
    brandLogo: '',
    brandColor: '#5459AC',
    brandSecondaryColor: '',
    timezone: 'UTC',
    industryType: '',
    emailSignature: '',
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    youtube: '',
  });

  useEffect(() => {
    fetchBrands();
    fetchStores();
  }, []);

  async function fetchBrands() {
    try {
      const res = await fetch('/api/admin/brand', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBrands(data.brands || []);
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStores() {
    try {
      const res = await fetch('/api/admin/stores', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStores(Array.isArray(data) ? data : data.stores || []);
      }
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    }
  }

  function openCreate() {
    setEditingBrand(null);
    setForm({
      storeId: '', brandName: '', brandLogo: '', brandColor: '#5459AC',
      brandSecondaryColor: '', timezone: 'UTC', industryType: '', emailSignature: '',
      facebook: '', twitter: '', instagram: '', linkedin: '', youtube: '',
    });
    setDialogOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditingBrand(brand);
    const social = brand.socialLinks || {};
    setForm({
      storeId: brand.storeId,
      brandName: brand.brandName,
      brandLogo: brand.brandLogo || '',
      brandColor: brand.brandColor,
      brandSecondaryColor: brand.brandSecondaryColor || '',
      timezone: brand.timezone,
      industryType: brand.industryType || '',
      emailSignature: brand.emailSignature || '',
      facebook: (social as any).facebook || '',
      twitter: (social as any).twitter || '',
      instagram: (social as any).instagram || '',
      linkedin: (social as any).linkedin || '',
      youtube: (social as any).youtube || '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: any = {
        storeId: form.storeId,
        brandName: form.brandName,
        brandLogo: form.brandLogo || null,
        brandColor: form.brandColor,
        brandSecondaryColor: form.brandSecondaryColor || null,
        timezone: form.timezone,
        industryType: form.industryType || null,
        emailSignature: form.emailSignature || null,
        socialLinks: {
          facebook: form.facebook || null,
          twitter: form.twitter || null,
          instagram: form.instagram || null,
          linkedin: form.linkedin || null,
          youtube: form.youtube || null,
        },
      };
      if (editingBrand) body.id = editingBrand.id;

      const res = await fetch('/api/admin/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDialogOpen(false);
        fetchBrands();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save');
      }
    } catch (err) {
      alert('Failed to save brand');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brand Management</h1>
          <p className="text-gray-500 text-sm">Manage brand identities for stores</p>
        </div>
        <Button onClick={openCreate} className="gap-2" style={{ backgroundColor: '#5459AC' }}>
          <Plus className="h-4 w-4" /> Add Brand
        </Button>
      </div>

      {loading ? (
        <div className="text-gray-400 p-8 text-center">Loading brands...</div>
      ) : brands.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-400">
            No brands configured yet. Click "Add Brand" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {brands.map(brand => (
            <Card key={brand.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: brand.brandColor }}>
                      {brand.brandName.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{brand.brandName}</CardTitle>
                      {brand.industryType && <p className="text-sm text-gray-500">{brand.industryType}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(brand)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-gray-400" />
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded border" style={{ backgroundColor: brand.brandColor }} />
                    <span>{brand.brandColor}</span>
                    {brand.brandSecondaryColor && (
                      <>
                        <div className="w-5 h-5 rounded border" style={{ backgroundColor: brand.brandSecondaryColor }} />
                        <span>{brand.brandSecondaryColor}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>{brand.timezone}</span>
                </div>
                {brand.socialLinks && Object.values(brand.socialLinks).some(Boolean) && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-gray-400" />
                    <div className="flex gap-1">
                      {Object.entries(brand.socialLinks as Record<string, string>).filter(([, v]) => v).map(([k]) => (
                        <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400 pt-1">Store: {brand.storeId.slice(0, 8)}...</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBrand ? 'Edit Brand' : 'Add Brand'}</DialogTitle>
            <DialogDescription>Configure brand identity settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingBrand && (
              <div>
                <label className="text-sm font-medium">Store</label>
                <Select value={form.storeId} onValueChange={v => setForm({ ...form, storeId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select store" /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.storeName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Brand Name</label>
              <Input value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Logo URL</label>
              <Input value={form.brandLogo} onChange={e => setForm({ ...form, brandLogo: e.target.value })} placeholder="https://..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Primary Color</label>
                <div className="flex gap-2 mt-1">
                  <input type="color" value={form.brandColor} onChange={e => setForm({ ...form, brandColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  <Input value={form.brandColor} onChange={e => setForm({ ...form, brandColor: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Secondary Color</label>
                <div className="flex gap-2 mt-1">
                  <input type="color" value={form.brandSecondaryColor || '#ffffff'} onChange={e => setForm({ ...form, brandSecondaryColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  <Input value={form.brandSecondaryColor} onChange={e => setForm({ ...form, brandSecondaryColor: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Timezone</label>
                <Input value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Industry</label>
                <Input value={form.industryType} onChange={e => setForm({ ...form, industryType: e.target.value })} placeholder="e.g. E-commerce" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Email Signature</label>
              <Input value={form.emailSignature} onChange={e => setForm({ ...form, emailSignature: e.target.value })} className="mt-1" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Social Links</label>
              {['facebook', 'twitter', 'instagram', 'linkedin', 'youtube'].map(key => (
                <Input
                  key={key}
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1) + ' URL'}
                  value={(form as any)[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.brandName} style={{ backgroundColor: '#5459AC' }}>
              {saving ? 'Saving...' : editingBrand ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
