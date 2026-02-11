"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, Shield, Clock } from 'lucide-react';
// Simple date formatter - no external dependency needed
const formatDistanceToNow = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  return 'just now';
};

interface TeamMember {
  userId: string;
  role: string;
  permissions: string[];
  addedAt: string;
  addedBy: string;
  status: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    lastLogin: string | null;
  } | null;
}

interface TeamMemberCardProps {
  member: TeamMember;
  onEdit: () => void;
  onRemove: () => void;
  onRoleChange: (newRole: string) => void;
  getRoleColor: (role: string) => string;
}

export function TeamMemberCard({
  member,
  onEdit,
  onRemove,
  onRoleChange,
  getRoleColor,
}: TeamMemberCardProps) {
  const user = member.user;
  const initials = user?.name
    ? user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0].toUpperCase() || '?';

  const roleDisplayNames: Record<string, string> = {
    manager: 'Store Manager',
    team_member: 'Team Member',
    viewer: 'Viewer',
    store_owner: 'Store Owner',
  };

  const visiblePermissions = member.permissions.slice(0, 3);
  const remainingCount = Math.max(0, member.permissions.length - 3);

  const lastActive = user?.lastLogin
    ? formatDistanceToNow(new Date(user.lastLogin))
    : 'Never';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{user?.name || 'Unknown User'}</h3>
                <Badge className={getRoleColor(member.role)}>
                  {roleDisplayNames[member.role] || member.role}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              
              {member.permissions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {visiblePermissions.map(perm => (
                    <Badge key={perm} variant="outline" className="text-xs">
                      {perm.replace(/_/g, ' ').slice(0, 15)}
                    </Badge>
                  ))}
                  {remainingCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      +{remainingCount} more
                    </Badge>
                  )}
                </div>
              )}

              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Active {lastActive}</span>
                </div>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Permissions
              </DropdownMenuItem>
              {member.role !== 'manager' && (
                <DropdownMenuItem onClick={() => onRoleChange('manager')}>
                  <Shield className="w-4 h-4 mr-2" />
                  Make Manager
                </DropdownMenuItem>
              )}
              {member.role !== 'team_member' && (
                <DropdownMenuItem onClick={() => onRoleChange('team_member')}>
                  <Shield className="w-4 h-4 mr-2" />
                  Make Team Member
                </DropdownMenuItem>
              )}
              {member.role !== 'viewer' && (
                <DropdownMenuItem onClick={() => onRoleChange('viewer')}>
                  <Shield className="w-4 h-4 mr-2" />
                  Make Viewer
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onRemove} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

