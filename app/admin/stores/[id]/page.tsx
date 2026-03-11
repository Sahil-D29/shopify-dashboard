'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  ArrowLeft, Store, Users, BarChart3, Settings, Plus, Trash2, Edit,
  Globe, Mail, Calendar, Shield, Loader2, UserPlus, Activity,
} from 'lucide-react';
import { toast } from 'sonner';

interface StoreDetail {
  id: string;
  name: string;
  shopDomain: string;
  owner: string;
  status: string;
  plan: string;
  createdAt: string;
  usersCount: number;
  messagesCount: number;
  campaignsCount?: number;
  journeysCount?: number;
  users?: Array<{ id: string; name: string; email: string; role: string; status: string }>;
}

interface StoreMember {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    globalRole: string;
    status: string;
    lastLogin: string | null;
  } | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [members, setMembers] = useState<StoreMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('TEAM_MEMBER');
  const [addingMember, setAddingMember] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Edit role modal
  const [editingMember, setEditingMember] = useState<StoreMember | null>(null);
  const [editRole, setEditRole] = useState('');

  // Settings
  const [editStatus, setEditStatus] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (storeId) {
      fetchStore();
      fetchMembers();
    }
  }, [storeId]);

  const fetchStore = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/stores/${storeId}`);
      if (!res.ok) throw new Error('Failed to load store');
      const data = await res.json();
      setStore(data);
      setEditStatus(data.status || 'active');
      setEditPlan(data.plan || 'free');
    } catch (error) {
      toast.error('Failed to load store details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setMembersLoading(true);
      const res = await fetch(`/api/admin/stores/${storeId}/members`);
      if (!res.ok) throw new Error('Failed to load members');
      const data = await res.json();
      setMembers(data.members || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/admin/users?count=200');
      if (res.ok) {
        const data = await res.json();
        const users = (data.users || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email }));
        // Deduplicate by id
        const unique = Array.from(new Map(users.map((u: UserOption) => [u.id, u])).values());
        setAllUsers(unique as UserOption[]);
      }
    } catch {}
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add member');
      toast.success('Member added successfully');
      setShowAddMember(false);
      setSelectedUserId('');
      setSelectedRole('TEAM_MEMBER');
      fetchMembers();
      fetchStore();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setAddingMember(false);
    }
  };

  const handleChangeRole = async () => {
    if (!editingMember || !editRole) return;
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editingMember.userId, role: editRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      toast.success('Role updated');
      setEditingMember(null);
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this store?`)) return;
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/members?userId=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove member');
      toast.success('Member removed');
      fetchMembers();
      fetchStore();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/stores/${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, plan: editPlan }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Store settings updated');
      fetchStore();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      OWNER: 'bg-purple-100 text-purple-700',
      MANAGER: 'bg-blue-100 text-blue-700',
      TEAM_MEMBER: 'bg-green-100 text-green-700',
      VIEWER: 'bg-gray-100 text-gray-700',
    };
    return <Badge className={colors[role] || 'bg-gray-100 text-gray-700'}>{role}</Badge>;
  };

  const filteredUsers = allUsers.filter(u =>
    !members.some(m => m.userId === u.id) &&
    (u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Store not found.</p>
        <Button variant="ghost" onClick={() => router.push('/admin/stores')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Stores
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/stores')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{store.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Globe className="h-4 w-4" /> {store.shopDomain}
          </p>
        </div>
        <Badge variant={store.status === 'active' ? 'default' : 'secondary'} className="text-sm">
          {store.status}
        </Badge>
        <Badge variant="outline" className="text-sm">{store.plan}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><Store className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-4 w-4 mr-1" /> Team ({members.length})</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1" /> Stats</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardDescription>Team Members</CardDescription><CardTitle className="text-2xl">{store.usersCount || 0}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Messages Sent</CardDescription><CardTitle className="text-2xl">{store.messagesCount || 0}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Campaigns</CardDescription><CardTitle className="text-2xl">{store.campaignsCount || 0}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Journeys</CardDescription><CardTitle className="text-2xl">{store.journeysCount || 0}</CardTitle></CardHeader></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Store Info</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Store ID</span><span className="font-mono text-xs">{store.id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span>{store.owner}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Domain</span><span>{store.shopDomain}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><Badge variant="outline">{store.plan}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(store.createdAt).toLocaleDateString()}</span></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Team Members</h3>
            <Button onClick={() => { setShowAddMember(true); fetchAllUsers(); }}>
              <UserPlus className="h-4 w-4 mr-2" /> Add Member
            </Button>
          </div>
          {membersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : members.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No team members yet.</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Store Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{m.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{roleBadge(m.role)}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'ACTIVE' ? 'default' : 'secondary'}>{m.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingMember(m); setEditRole(m.role); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleRemoveMember(m.userId, m.user?.name || m.user?.email || '')}>
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

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Store Statistics</CardTitle><CardDescription>Usage and performance metrics</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Users</span><span className="font-semibold">{store.usersCount || 0}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Messages Sent</span><span className="font-semibold">{store.messagesCount || 0}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Campaigns</span><span className="font-semibold">{store.campaignsCount || 0}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Journeys</span><span className="font-semibold">{store.journeysCount || 0}</span></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Store Settings</CardTitle><CardDescription>Manage store status and plan</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Plan</Label>
                  <Select value={editPlan} onValueChange={setEditPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Member Modal */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Assign an existing user to this store</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search User</Label>
              <Input placeholder="Search by name or email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
            <div>
              <Label>Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder="Choose a user..." /></SelectTrigger>
                <SelectContent>
                  {filteredUsers.slice(0, 20).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No users found</div>
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
            <Button variant="outline" onClick={() => setShowAddMember(false)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={!selectedUserId || addingMember}>
              {addingMember ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>Update role for {editingMember?.user?.name || editingMember?.user?.email}</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Role</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNER">Owner</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="TEAM_MEMBER">Team Member</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>Cancel</Button>
            <Button onClick={handleChangeRole}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
