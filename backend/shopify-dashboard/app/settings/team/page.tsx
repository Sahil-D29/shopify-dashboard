"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Users, UserPlus, Shield, Key, Activity, Search, 
  MoreVertical, Edit, Trash2, Mail, Clock, CheckCircle2, XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useTenant } from '@/lib/tenant/tenant-context';
import { InviteTeamMemberModal } from '@/components/team/InviteTeamMemberModal';
import { TeamMemberCard } from '@/components/team/TeamMemberCard';
import { PermissionsEditor } from '@/components/team/PermissionsEditor';
import { ActivityLogViewer } from '@/components/team/ActivityLogViewer';
import { PendingInvitationsTable } from '@/components/team/PendingInvitationsTable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

interface TeamData {
  storeId: string;
  ownerId: string;
  teamMembers: TeamMember[];
}

export default function TeamManagementPage() {
  const router = useRouter();
  const { currentStore } = useTenant();
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('members');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showPermissionsEditor, setShowPermissionsEditor] = useState(false);

  const storeId = currentStore?.id;

  useEffect(() => {
    if (storeId) {
      loadTeamData();
      loadInvitations();
    }
  }, [storeId]);

  const loadTeamData = async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${storeId}`);
      if (!res.ok) throw new Error('Failed to load team data');
      const data = await res.json();
      setTeamData(data.team);
    } catch (error) {
      console.error('Failed to load team:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    if (!storeId) return;
    
    try {
      const res = await fetch(`/api/teams/invitations/pending?storeId=${storeId}`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const handleInvite = async (email: string, role: string, permissions: string[]) => {
    if (!storeId) return;
    
    try {
      const res = await fetch(`/api/teams/${storeId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, permissions }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send invitation');
      }
      
      toast.success('Invitation sent successfully');
      setShowInviteModal(false);
      loadInvitations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!storeId || !confirm('Are you sure you want to remove this team member?')) return;
    
    try {
      const res = await fetch(`/api/teams/${storeId}/members/${userId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Failed to remove team member');
      
      toast.success('Team member removed successfully');
      loadTeamData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove team member');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!storeId) return;
    
    try {
      const res = await fetch(`/api/teams/${storeId}/members/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (!res.ok) throw new Error('Failed to update role');
      
      toast.success('Role updated successfully');
      loadTeamData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleUpdatePermissions = async (userId: string, permissions: string[]) => {
    if (!storeId) return;
    
    try {
      const res = await fetch(`/api/teams/${storeId}/members/${userId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });
      
      if (!res.ok) throw new Error('Failed to update permissions');
      
      toast.success('Permissions updated successfully');
      setShowPermissionsEditor(false);
      setEditingMember(null);
      loadTeamData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update permissions');
    }
  };

  const filteredMembers = teamData?.teamMembers.filter(member => {
    const matchesSearch = !searchQuery || 
      member.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.user?.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  }) || [];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'store_owner': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'manager': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'team_member': return 'bg-green-100 text-green-700 border-green-200';
      case 'viewer': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (!storeId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Please select a store</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your store team members and their permissions
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Team Member
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="members">
            <Users className="w-4 h-4 mr-2" />
            Team Members
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="w-4 h-4 mr-2" />
            Pending Invitations
            {invitations.length > 0 && (
              <span className="ml-2 bg-blue-500 text-white rounded-full px-2 py-0.5 text-xs">
                {invitations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="all">All Roles</option>
                    <option value="manager">Manager</option>
                    <option value="team_member">Team Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No team members found</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredMembers.map((member) => (
                    <TeamMemberCard
                      key={member.userId}
                      member={member}
                      onEdit={() => {
                        setEditingMember(member);
                        setShowPermissionsEditor(true);
                      }}
                      onRemove={() => handleRemoveMember(member.userId)}
                      onRoleChange={(newRole) => handleUpdateRole(member.userId, newRole)}
                      getRoleColor={getRoleColor}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations">
          <PendingInvitationsTable
            invitations={invitations}
            onRefresh={loadInvitations}
            storeId={storeId}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityLogViewer storeId={storeId} />
        </TabsContent>
      </Tabs>

      {showInviteModal && (
        <InviteTeamMemberModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInvite}
        />
      )}

      {showPermissionsEditor && editingMember && (
        <PermissionsEditor
          open={showPermissionsEditor}
          onClose={() => {
            setShowPermissionsEditor(false);
            setEditingMember(null);
          }}
          member={editingMember}
          onSave={(permissions) => handleUpdatePermissions(editingMember.userId, permissions)}
        />
      )}
    </div>
  );
}

