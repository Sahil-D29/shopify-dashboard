'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTenant } from '@/lib/tenant/tenant-context';

export default function NewStorePage() {
  const router = useRouter();
  const { refreshStores, switchStore } = useTenant();
  const [name, setName] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const domain = shopDomain.trim().toLowerCase().endsWith('.myshopify.com')
      ? shopDomain.trim().toLowerCase()
      : `${shopDomain.trim().toLowerCase().replace(/\.myshopify\.com$/i, '')}.myshopify.com`;

    if (!name.trim()) {
      toast.error('Please enter a store name');
      return;
    }
    if (!domain || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(domain)) {
      toast.error('Please enter a valid Shopify domain (e.g. your-store.myshopify.com)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), shopDomain: domain }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to create store');
        return;
      }

      toast.success('Store created. You are the owner.');
      await refreshStores();
      if (data.store?.id) {
        await switchStore(data.store.id);
      }
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create store');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-md">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Add New Store</h1>
              <p className="text-sm text-muted-foreground">
                You will be the store owner and can manage users and roles.
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Store name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Store"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="shopDomain">Shopify domain *</Label>
              <Input
                id="shopDomain"
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                required
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Your store’s myshopify.com domain (e.g. my-store.myshopify.com)
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create Store'
                )}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
