'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, User as UserIcon, Store, Shield, Plus, Trash2,
  Mail, Calendar, Clock, Loader2, Activity,
} from 'lucide-react';
import { toast } from 'sonner';

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  createdAt: string;
  lastLogin?: string;
  storeId?: string;
}

interface UserStore {
  storeId: string;
  storeName: string;
  shopifyDomain: string;
  isActive: boolean;
  role: string;
  isOwner: boolean;
  membershipStatus: string;
}

interface StoreOption {
  id: string;
  name: string;
  shopDomain: string;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [stores, setStores] = useState<UserStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [storesLoading, setStoresLoading] = useState(true);

  // Add to store modal
  const [showAddStore, setShowAddStore] = useState(false);
  const [allStores, setAllStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedRole, setSelectedRole] = useState('TEAM_MEMBER');
  const [addingStore, setAddingStore] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  useEffect(() => {
    if (userId) {
      fetchUser();
      fetchUserStores();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) throw new Error('Failed to load user');
      const data = await res.json();
      setUser(data.user || data);
    } catch {
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStores = async () => {
    try {
      setStoresLoading(true);
      const res = await fetch(`/api/admin/users/${userId}/stores`);
      if (!res.ok) throw new Error('Failed to load stores');
      const data = await res.json();
      setStores(data.stores || []);
    } catch {
      console.error('Failed to load user stores');
    } finally {
      setStoresLoading(false);
    }
  };

  const fetchAllStores = async () => {
    try {
      const res = await fetch('/api/admin/stores');
      if (res.ok) {
        const data = await res.json();
        setAllStores((data.stores || []).map((s: any) => ({ id: s.id, name: s.name, shopDomain: s.shopDomain })));
      }
    } catch {}
  };

  const handleAddToStore = async () => {
    if (!selectedStoreId) return;
    setAddingStore(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: selectedStoreId, role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign');
      toast.success('User assigned to store');
      setShowAddStore(false);
      setSelectedStoreId('');
      setSelectedRole('TEAM_MEMBER');
      fetchUserStores();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setAddingStore(false);
    }
  };

  const handleRemoveFromStore = async (storeId: string, storeName: string) => {
    if (!confirm(`Remove this user from ${storeName}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/stores?storeId=${storeId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast.success('User removed from store');
      fetchUserStores();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      OWNER: 'bg-purple-100 text-purple-700',
      MANAGER: 'bg-blue-100 text-blue-700',
      TEAM_MEMBER: 'bg-green-100 text-green-700',
      VIEWER: 'bg-gray-100 text-gray-700',
      admin: 'bg-purple-100 text-purple-700',
      manager: 'bg-blue-100 text-blue-700',
      builder: 'bg-green-100 text-green-700',
      viewer: 'bg-gray-100 text-gray-700',
    };
    return <Badge className={colors[role] || 'bg-gray-100 text-gray-700'}>{role}</Badge>;
  };

  const filteredStores = allStores.filter(s =>
    !stores.some(us => us.storeId === s.id) &&
    (s.name?.toLowerCase().includes(storeSearch.toLowerCase()) || s.shopDomain?.toLowerCase().includes(storeSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">User not found.</p>
        <Button variant="ghost" onClick={() => router.push('/admin/users')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/users')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
            {user.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" /> {user.email}
            </p>
          </div>
        </div>
        {roleBadge(user.role)}
        <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>{user.status}</Badge>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><UserIcon className="h-4 w-4 mr-1" /> Profile</TabsTrigger>
          <TabsTrigger value="stores"><Store className="h-4 w-4 mr-1" /> Stores ({stores.length})</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>User Information</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">User ID</span><span className="font-mono text-xs">{user.id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{user.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user.email}</span></div>
              {user.phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{user.phone}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Role</span>{roleBadge(user.role)}</div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={user.status === 'active' ? 'default' : 'secondary'}>{user.status}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(user.createdAt).toLocaleDateString()}</span></div>
              {user.lastLogin && <div className="flex justify-between"><span className="text-muted-foreground">Last Login</span><span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(user.lastLogin).toLocaleString()}</span></div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stores Tab */}
        <TabsContent value="stores" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Store Memberships</h3>
            <Button onClick={() => { setShowAddStore(true); fetchAllStores(); }}>
              <Plus className="h-4 w-4 mr-2" /> Assign to Store
            </Button>
          </div>
          {storesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : stores.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Not assigned to any store.</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Owner?</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map(s => (
                    <TableRow key={s.storeId}>
                      <TableCell className="font-medium">
                        <button className="text-blue-600 hover:underline" onClick={() => router.push(`/admin/stores/${s.storeId}`)}>
                          {s.storeName}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.shopifyDomain}</TableCell>
                      <TableCell>{roleBadge(s.role)}</TableCell>
                      <TableCell>{s.isOwner ? <Badge className="bg-purple-100 text-purple-700">Owner</Badge> : '—'}</TableCell>
                      <TableCell><Badge variant={s.membershipStatus === 'ACTIVE' ? 'default' : 'secondary'}>{s.membershipStatus}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleRemoveFromStore(s.storeId, s.storeName)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add to Store Modal */}
      <Dialog open={showAddStore} onOpenChange={setShowAddStore}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to Store</DialogTitle>
            <DialogDescription>Add {user.name} to a store</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search Store</Label>
              <Input placeholder="Search by name or domain..." value={storeSearch} onChange={e => setStoreSearch(e.target.value)} />
            </div>
            <div>
              <Label>Select Store</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger><SelectValue placeholder="Choose a store..." /></SelectTrigger>
                <SelectContent>
                  {filteredStores.slice(0, 20).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.shopDomain})</SelectItem>
                  ))}
                  {filteredStores.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No stores found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="TEAM_MEMBER">Team Member</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStore(false)}>Cancel</Button>
            <Button onClick={handleAddToStore} disabled={!selectedStoreId || addingStore}>
              {addingStore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
