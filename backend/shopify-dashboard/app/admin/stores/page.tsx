'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Search, Store, MoreVertical, Eye, Edit, Trash2, Users, Activity, Mail, Calendar, Globe, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Store {
  id: string;
  name: string;
  shopDomain: string;
  owner: string;
  status: 'active' | 'suspended' | 'inactive';
  plan: 'free' | 'basic' | 'pro';
  createdAt: string;
  usersCount?: number;
  messagesCount?: number;
}

export default function StoreManagementPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  useEffect(() => {
    fetchStores();
  }, [statusFilter, planFilter]);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (planFilter !== 'all') params.append('plan', planFilter);

      const response = await fetch(`/api/admin/stores?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || []);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (storeId: string) => {
    if (!confirm('Are you sure you want to delete this store? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/stores/${storeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Store deleted successfully');
        fetchStores();
      } else {
        toast.error('Failed to delete store');
      }
    } catch (error) {
      console.error('Error deleting store:', error);
      toast.error('Failed to delete store');
    }
  };

  const handleViewDetails = async (storeId: string) => {
    try {
      const response = await fetch(`/api/admin/stores/${storeId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedStore(data.store);
        setIsViewModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching store details:', error);
      toast.error('Failed to load store details');
    }
  };

  const filteredStores = stores.filter((store) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        store.name.toLowerCase().includes(query) ||
        store.shopDomain.toLowerCase().includes(query) ||
        store.owner.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[status] || colors.inactive}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPlanBadge = (plan: string) => {
    if (plan.toLowerCase() === 'basic') {
      return (
        <Badge 
          className="text-white"
          style={{ 
            backgroundColor: 'rgba(84, 89, 172, 0.15)',
            color: '#5459AC',
            border: '1px solid rgba(84, 89, 172, 0.3)'
          }}
        >
          {plan.charAt(0).toUpperCase() + plan.slice(1)}
        </Badge>
      );
    }
    const colors: Record<string, string> = {
      pro: 'bg-purple-100 text-purple-800',
      free: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[plan.toLowerCase()] || colors.free}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Store Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage all connected Shopify stores
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Connect New Store
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="free">Free</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stores Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Owner Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredStores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No stores found
                </TableCell>
              </TableRow>
            ) : (
              filteredStores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-gray-400" />
                      {store.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {store.shopDomain}
                  </TableCell>
                  <TableCell>{store.owner}</TableCell>
                  <TableCell>{getPlanBadge(store.plan)}</TableCell>
                  <TableCell>{getStatusBadge(store.status)}</TableCell>
                  <TableCell>{store.usersCount || 0}</TableCell>
                  <TableCell>{store.messagesCount?.toLocaleString() || 0}</TableCell>
                  <TableCell>
                    {new Date(store.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleViewDetails(store.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(store.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Store Modal */}
      <AddStoreModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchStores();
        }}
      />

      {/* View Store Details Modal */}
      {selectedStore && (
        <StoreDetailsModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedStore(null);
          }}
          store={selectedStore}
        />
      )}
    </div>
  );
}

// Add Store Modal
function AddStoreModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    shopDomain: '',
    owner: '',
    plan: 'free' as const,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Store created successfully');
        onSuccess();
        setFormData({
          name: '',
          shopDomain: '',
          owner: '',
          plan: 'free',
        });
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create store');
      }
    } catch (error) {
      console.error('Error creating store:', error);
      toast.error('Failed to create store');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect New Store</DialogTitle>
          <DialogDescription>
            Add a new Shopify store to the system.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="store-name">Store Name *</Label>
            <Input
              id="store-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Store"
              required
            />
          </div>
          <div>
            <Label htmlFor="shop-domain">Shop Domain *</Label>
            <Input
              id="shop-domain"
              value={formData.shopDomain}
              onChange={(e) => setFormData({ ...formData, shopDomain: e.target.value })}
              placeholder="mystore.myshopify.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="owner-email">Owner Email *</Label>
            <Input
              id="owner-email"
              type="email"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
              placeholder="owner@store.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="plan">Plan</Label>
            <Select
              value={formData.plan}
              onValueChange={(value) => setFormData({ ...formData, plan: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Store'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Store Details Modal - Enhanced with Tabs
function StoreDetailsModal({
  isOpen,
  onClose,
  store,
}: {
  isOpen: boolean;
  onClose: () => void;
  store: any;
}) {
  const [loading, setLoading] = useState(false);
  const [storeData, setStoreData] = useState<any>(store);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isOpen && store?.id) {
      fetchStoreDetails();
    }
  }, [isOpen, store?.id]);

  const fetchStoreDetails = async () => {
    if (!store?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/stores/${store.id}`);
      if (response.ok) {
        const data = await response.json();
        setStoreData(data.store || store);
      }
    } catch (error) {
      console.error('Error fetching store details:', error);
      toast.error('Failed to load store details');
    } finally {
      setLoading(false);
    }
  };

  if (!storeData) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[status] || colors.inactive}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPlanBadge = (plan: string) => {
    if (plan?.toLowerCase() === 'basic') {
      return (
        <Badge 
          className="text-white"
          style={{ 
            backgroundColor: 'rgba(84, 89, 172, 0.15)',
            color: '#5459AC',
            border: '1px solid rgba(84, 89, 172, 0.3)'
          }}
        >
          {plan.charAt(0).toUpperCase() + plan.slice(1)}
        </Badge>
      );
    }
    const colors: Record<string, string> = {
      pro: 'bg-purple-100 text-purple-800',
      free: 'bg-gray-100 text-gray-800',
      enterprise: 'bg-blue-100 text-blue-800',
    };
    return (
      <Badge className={colors[plan?.toLowerCase()] || colors.free}>
        {plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Free'}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Store className="h-6 w-6" />
                {storeData.name || 'Store Details'}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Globe className="h-4 w-4" />
                {storeData.shopDomain}
              </DialogDescription>
            </div>
            {getStatusBadge(storeData.status)}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">
                Users {storeData.users?.length ? `(${storeData.users.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-4 border rounded-lg">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    Store Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Store ID:</span>
                      <span className="font-mono text-xs">{storeData.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Domain:</span>
                      <a 
                        href={`https://${storeData.shopDomain}`} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {storeData.shopDomain}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plan:</span>
                      {getPlanBadge(storeData.plan)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(storeData.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {storeData.lastSync && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Sync:</span>
                        <span>{new Date(storeData.lastSync).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 p-4 border rounded-lg">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Owner Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Owner Email:</span>
                      <span>{storeData.owner}</span>
                    </div>
                    {storeData.ownerName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Owner Name:</span>
                        <span>{storeData.ownerName}</span>
                      </div>
                    )}
                    {storeData.settings?.timezone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timezone:</span>
                        <span>{storeData.settings.timezone}</span>
                      </div>
                    )}
                    {storeData.settings?.currency && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Currency:</span>
                        <span>{storeData.settings.currency}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Quick Stats
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold">{storeData.usersCount || storeData.users?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">Team Members</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold">{storeData.messagesCount?.toLocaleString() || 0}</div>
                    <div className="text-sm text-muted-foreground">Messages Sent</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold">{storeData.campaignsCount || 0}</div>
                    <div className="text-sm text-muted-foreground">Campaigns</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold">{storeData.journeysCount || 0}</div>
                    <div className="text-sm text-muted-foreground">Journeys</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4 mt-4">
              <div className="space-y-2">
                {!storeData.users || storeData.users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No users assigned to this store</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {storeData.users.map((user: any) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div>
                          <div className="font-medium">{user.name || user.email}</div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                            {user.lastLogin && (
                              <span className="ml-2">
                                • Last active: {new Date(user.lastLogin).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline">{user.role || 'user'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="stats" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 p-4 border rounded-lg">
                  <h3 className="font-semibold">Revenue</h3>
                  <div className="text-3xl font-bold">
                    {storeData.totalRevenue ? `₹${storeData.totalRevenue.toLocaleString()}` : '₹0'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Avg. Order Value: {storeData.avgOrderValue ? `₹${storeData.avgOrderValue.toLocaleString()}` : '₹0'}
                  </div>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <h3 className="font-semibold">Campaigns</h3>
                  <div className="text-3xl font-bold">{storeData.totalCampaigns || storeData.campaignsCount || 0}</div>
                  <div className="text-sm text-muted-foreground">
                    Active: {storeData.activeCampaigns || 0}
                  </div>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <h3 className="font-semibold">Orders</h3>
                  <div className="text-3xl font-bold">{storeData.totalOrders || 0}</div>
                  <div className="text-sm text-muted-foreground">
                    Conversion Rate: {storeData.conversionRate || 0}%
                  </div>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <h3 className="font-semibold">Customers</h3>
                  <div className="text-3xl font-bold">{storeData.totalCustomers || 0}</div>
                  <div className="text-sm text-muted-foreground">
                    Active: {storeData.activeCustomers || 0}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Store Status</h3>
                    <p className="text-sm text-muted-foreground">
                      {storeData.status === 'active' ? 'Store is currently active' : 'Store is inactive'}
                    </p>
                  </div>
                  <Button 
                    variant={storeData.status === 'active' ? 'destructive' : 'default'}
                    onClick={() => toast.info('Status change functionality coming soon')}
                  >
                    {storeData.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Billing Plan</h3>
                    <p className="text-sm text-muted-foreground">
                      Current plan: {storeData.plan || 'Free'}
                    </p>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={() => toast.info('Plan change functionality coming soon')}
                  >
                    Change Plan
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">API Access</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage API credentials and webhooks
                    </p>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={() => toast.info('API configuration coming soon')}
                  >
                    Configure
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

