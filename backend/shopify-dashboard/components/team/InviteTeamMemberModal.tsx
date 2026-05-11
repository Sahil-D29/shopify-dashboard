"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteTeamMemberModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, role: string, permissions: string[], expiryDays?: number) => Promise<void>;
  subscriptionInfo?: {
    planType: string;
    teamMembersPerStore: number;
    currentCount: number;
  } | null;
}

const ROLE_DESCRIPTIONS = {
  manager: 'Can manage store operations, campaigns, and customers. Cannot access billing or store settings.',
  team_member: 'Limited access based on permissions. Can view campaigns and customers.',
  viewer: 'Read-only access. Can view data but cannot make changes.',
};

const PERMISSION_CATEGORIES = {
  dashboard: {
    label: 'Dashboard & Analytics',
    permissions: ['view_dashboard', 'view_analytics'],
  },
  campaigns: {
    label: 'Campaigns',
    permissions: ['view_campaigns', 'create_campaigns', 'edit_campaigns', 'delete_campaigns'],
  },
  customers: {
    label: 'Customers',
    permissions: ['view_customers', 'edit_customers'],
  },
  products: {
    label: 'Products',
    permissions: ['view_products', 'edit_products'],
  },
  orders: {
    label: 'Orders',
    permissions: ['view_orders'],
  },
  team: {
    label: 'Team Management',
    permissions: ['manage_team_members'],
  },
  settings: {
    label: 'Settings & Billing',
    permissions: ['edit_store_settings', 'view_billing'],
  },
};

const ROLE_PRESETS: Record<string, string[]> = {
  manager: [
    'view_dashboard',
    'view_analytics',
    'create_campaigns',
    'edit_campaigns',
    'delete_campaigns',
    'view_customers',
    'edit_customers',
    'view_products',
    'edit_products',
    'view_orders',
    'manage_team_members',
  ],
  team_member: [
    'view_dashboard',
    'view_campaigns',
    'view_customers',
    'view_products',
    'view_orders',
  ],
  viewer: [
    'view_dashboard',
    'view_analytics',
    'view_campaigns',
  ],
};

export function InviteTeamMemberModal({ open, onClose, onInvite, subscriptionInfo }: InviteTeamMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('team_member');
  const [permissions, setPermissions] = useState<string[]>(ROLE_PRESETS.team_member);
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [useRoleDefaults, setUseRoleDefaults] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (useRoleDefaults) {
      setPermissions(ROLE_PRESETS[newRole] || []);
    }
  };

  const togglePermission = (permission: string) => {
    setPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const toggleCategory = (categoryPermissions: string[]) => {
    const allSelected = categoryPermissions.every(p => permissions.includes(p));
    if (allSelected) {
      setPermissions(prev => prev.filter(p => !categoryPermissions.includes(p)));
    } else {
      setPermissions(prev => [...new Set([...prev, ...categoryPermissions])]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check plan limits
    if (subscriptionInfo && subscriptionInfo.teamMembersPerStore !== -1) {
      if (subscriptionInfo.currentCount >= subscriptionInfo.teamMembersPerStore) {
        toast.error(`Team member limit reached. Your ${subscriptionInfo.planType} plan allows ${subscriptionInfo.teamMembersPerStore} team members.`);
        return;
      }
    }

    setLoading(true);
    try {
      await onInvite(email, role, permissions, expiryDays);
      setEmail('');
      setRole('team_member');
      setPermissions(ROLE_PRESETS.team_member);
      setExpiryDays(7);
      setUseRoleDefaults(true);
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your store team
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Store Manager</SelectItem>
                <SelectItem value="team_member">Team Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry">Invitation Expires In</Label>
            <Select value={expiryDays.toString()} onValueChange={(v) => setExpiryDays(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useRoleDefaults"
              checked={useRoleDefaults}
              onChange={(e) => {
                setUseRoleDefaults(e.target.checked);
                if (e.target.checked) {
                  setPermissions(ROLE_PRESETS[role] || []);
                }
              }}
              className="rounded"
            />
            <Label htmlFor="useRoleDefaults" className="text-sm">
              Use Role Defaults
            </Label>
          </div>

          {!useRoleDefaults && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Custom Permissions</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allPerms = Object.values(PERMISSION_CATEGORIES).flatMap(c => c.permissions);
                      setPermissions(allPerms);
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPermissions([])}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

            <div className="space-y-4 border rounded-lg p-4">
              {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => {
                const categorySelected = category.permissions.some(p => permissions.includes(p));
                const allSelected = category.permissions.every(p => permissions.includes(p));
                
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => toggleCategory(category.permissions)}
                      />
                      <Label className="font-medium">{category.label}</Label>
                    </div>
                    <div className="ml-6 space-y-2">
                      {category.permissions.map(permission => (
                        <div key={permission} className="flex items-center space-x-2">
                          <Checkbox
                            checked={permissions.includes(permission)}
                            onCheckedChange={() => togglePermission(permission)}
                          />
                          <Label className="text-sm font-normal">
                            {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

