"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

interface TeamMember {
  userId: string;
  role: string;
  permissions: string[];
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
}

interface PermissionsEditorProps {
  open: boolean;
  onClose: () => void;
  member: TeamMember;
  onSave: (permissions: string[]) => Promise<void>;
}

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

export function PermissionsEditor({
  open,
  onClose,
  member,
  onSave,
}: PermissionsEditorProps) {
  const [permissions, setPermissions] = useState<string[]>(member.permissions || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPermissions(member.permissions || []);
    }
  }, [open, member]);

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

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(permissions);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Permissions</DialogTitle>
          <DialogDescription>
            Update permissions for {member.user?.name || member.user?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Permissions</Label>
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

