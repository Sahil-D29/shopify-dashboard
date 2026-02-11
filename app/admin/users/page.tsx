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
import { Plus, Search, Edit, Trash2, Eye, MoreVertical, Download, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getRoleDisplayName } from '@/lib/auth/permissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ResetPasswordModal from '@/components/modals/ResetPasswordModal';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  storeId: string;
  role: 'admin' | 'manager' | 'builder' | 'viewer';
  status: 'active' | 'inactive' | 'deleted';
  createdAt: string;
  lastLogin?: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUsers();
    fetchStores();
  }, [roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Ensure all users have required fields with defaults
        const safeUsers = (data.users || []).map((user: User) => ({
          ...user,
          name: user.name || 'Unknown',
          email: user.email || '',
          status: user.status || 'inactive',
          role: user.role || 'viewer',
          storeId: user.storeId || 'store_default',
          createdAt: user.createdAt || new Date().toISOString(),
        }));
        setUsers(safeUsers);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/admin/stores');
      if (response.ok) {
        const data = await response.json();
        setStores(
          data.stores.map((store: any) => ({
            id: store.id,
            name: store.name,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      // Fallback to default store
      setStores([{ id: 'store_default', name: 'Default Store' }]);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('User deleted successfully');
        fetchUsers();
        setSelectedUsers(new Set());
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Please select users to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedUsers.size} user(s)? This action cannot be undone.`)) return;

    try {
      const deletePromises = Array.from(selectedUsers).map(userId =>
        fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      );

      const results = await Promise.allSettled(deletePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      const failed = results.length - successful;

      if (successful > 0) {
        toast.success(`Successfully deleted ${successful} user(s)`);
      }
      if (failed > 0) {
        toast.error(`Failed to delete ${failed} user(s)`);
      }

      fetchUsers();
      setSelectedUsers(new Set());
    } catch (error) {
      console.error('Error bulk deleting users:', error);
      toast.error('Failed to delete users');
    }
  };

  const handleBulkStatusChange = async (status: 'active' | 'inactive') => {
    if (selectedUsers.size === 0) {
      toast.error('Please select users to update');
      return;
    }

    try {
      const updatePromises = Array.from(selectedUsers).map(userId =>
        fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      );

      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;

      toast.success(`Successfully updated ${successful} user(s)`);
      fetchUsers();
      setSelectedUsers(new Set());
    } catch (error) {
      console.error('Error bulk updating users:', error);
      toast.error('Failed to update users');
    }
  };

  const handleResetPassword = async (userId: string, newPassword: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      if (response.ok) {
        toast.success('Password reset successfully');
        setIsResetPasswordModalOpen(false);
        setSelectedUser(null);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to reset password');
        // Keep modal open on error so user can try again
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
      // Keep modal open on error so user can try again
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const selectAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Store', 'Role', 'Status', 'Created At', 'Last Login'];
    const rows = filteredUsers.map((user) => [
      user.name,
      user.email,
      user.phone || '',
      stores.find(s => s.id === user.storeId)?.name || user.storeId,
      getRoleDisplayName(user.role),
      user.status,
      new Date(user.createdAt).toLocaleString(),
      user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Users exported to CSV');
  };

  const getUserAvatar = (user: User) => {
    const initials = user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    return (
      <div 
        className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-medium"
        style={{ backgroundColor: '#5459AC' }}
      >
        {initials}
      </div>
    );
  };

  const filteredUsers = users.filter((user) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone?.includes(query)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string | undefined) => {
    // Add null/undefined check
    if (!status) {
      return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
    
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      deleted: 'bg-red-100 text-red-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    
    return (
      <Badge className={colors[status.toLowerCase()] || colors.inactive}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const roleLower = role.toLowerCase();
    if (roleLower === 'admin') {
      return (
        <Badge 
          className="text-white"
          style={{ 
            backgroundColor: 'rgba(84, 89, 172, 0.15)',
            color: '#5459AC',
            border: '1px solid rgba(84, 89, 172, 0.3)'
          }}
        >
          {getRoleDisplayName(role as any)}
        </Badge>
      );
    }
    const colors: Record<string, string> = {
      manager: 'bg-purple-100 text-purple-800',
      builder: 'bg-orange-100 text-orange-800',
      viewer: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[roleLower] || colors.viewer}>
        {getRoleDisplayName(role as any)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage all users across all stores
          </p>
        </div>
        <div className="flex gap-2">
          {selectedUsers.size > 0 && (
            <>
              <Button 
                variant="outline" 
                onClick={() => handleBulkStatusChange('active')}
                className="text-green-600"
              >
                Activate ({selectedUsers.size})
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleBulkStatusChange('inactive')}
                className="text-gray-600"
              >
                Deactivate ({selectedUsers.size})
              </Button>
              <Button 
                variant="outline" 
                onClick={handleBulkDelete}
                className="text-red-600"
              >
                Delete ({selectedUsers.size})
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add New User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="builder">Builder</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                  onChange={selectAllUsers}
                  className="rounded"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
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
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={`${user.id}-${user.storeId ?? ''}`}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {getUserAvatar(user)}
                      <span className="font-medium">{user.name || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email || '—'}</TableCell>
                  <TableCell>{user.phone || '—'}</TableCell>
                  <TableCell>{stores.find(s => s.id === user.storeId)?.name || user.storeId || '—'}</TableCell>
                  <TableCell>{getRoleBadge(user.role || 'viewer')}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
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
                          onClick={() => {
                            setSelectedUser(user);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setIsResetPasswordModalOpen(true);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(user.id)}
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

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchUsers();
        }}
        stores={stores}
      />

      {/* Edit User Modal */}
      {selectedUser && (
        <>
          <EditUserModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedUser(null);
            }}
            onSuccess={() => {
              setIsEditModalOpen(false);
              setSelectedUser(null);
              fetchUsers();
            }}
            user={selectedUser}
            stores={stores}
          />
          <ResetPasswordModal
            isOpen={isResetPasswordModalOpen}
            onClose={() => {
              setIsResetPasswordModalOpen(false);
              setSelectedUser(null);
            }}
            onSuccess={(newPassword) => {
              if (selectedUser) {
                handleResetPassword(selectedUser.id, newPassword);
              }
            }}
            user={selectedUser}
          />
        </>
      )}
    </div>
  );
}

// Add User Modal Component
function AddUserModal({
  isOpen,
  onClose,
  onSuccess,
  stores,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stores: Array<{ id: string; name: string }>;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    storeId: '',
    role: 'viewer' as const,
    sendWelcomeEmail: false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('User created successfully');
        onSuccess();
        setFormData({
          name: '',
          email: '',
          phone: '',
          password: '',
          storeId: '',
          role: 'viewer',
          sendWelcomeEmail: false,
        });
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account and assign them to a store.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="storeId">Assign Store *</Label>
            <Select
              value={formData.storeId}
              onValueChange={(value) => setFormData({ ...formData, storeId: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Assign Role *</Label>
            <div className="space-y-2 mt-2">
              {(['admin', 'manager', 'builder', 'viewer'] as const).map((role) => (
                <label key={role} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={formData.role === role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {getRoleDisplayName(role)} - {role === 'admin' ? 'Full access' : role === 'manager' ? 'Campaigns & Analytics' : role === 'builder' ? 'Journeys & Customers' : 'Read-only'}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="sendWelcomeEmail"
              checked={formData.sendWelcomeEmail}
              onChange={(e) => setFormData({ ...formData, sendWelcomeEmail: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="sendWelcomeEmail" className="font-normal">
              Send welcome email
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit User Modal Component
function EditUserModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  stores,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User;
  stores: Array<{ id: string; name: string }>;
}) {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    status: user.status,
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        status: formData.status,
      };

      if (formData.password) {
        updates.password = formData.password;
      }

      if (user.storeId != null && String(user.storeId).trim() !== '') {
        updates.storeId = String(user.storeId).trim();
      }

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        toast.success('User updated successfully');
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and permissions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email Address *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={8}
              />
            </div>
          </div>
          <div>
            <Label>Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['admin', 'manager', 'builder', 'viewer'] as const).map((role) => (
                  <SelectItem key={role} value={role}>
                    {getRoleDisplayName(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

