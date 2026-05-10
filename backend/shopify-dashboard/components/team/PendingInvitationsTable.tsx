"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock, X, Copy, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: string;
  token: string;
}

interface PendingInvitationsTableProps {
  invitations: Invitation[];
  onRefresh: () => void;
  storeId: string;
}

export function PendingInvitationsTable({
  invitations,
  onRefresh,
  storeId,
}: PendingInvitationsTableProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/accept-invitation?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied to clipboard');
  };

  const handleResend = async (invitationId: string) => {
    setLoading(invitationId);
    try {
      const res = await fetch(`/api/teams/invitations/${invitationId}/resend`, {
        method: 'POST',
      });
      
      if (!res.ok) throw new Error('Failed to resend invitation');
      
      toast.success('Invitation resent successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invitation');
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    
    setLoading(invitationId);
    try {
      const res = await fetch(`/api/teams/invitations/${invitationId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Failed to cancel invitation');
      
      toast.success('Invitation cancelled');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel invitation');
    } finally {
      setLoading(null);
    }
  };

  const roleDisplayNames: Record<string, string> = {
    manager: 'Store Manager',
    team_member: 'Team Member',
    viewer: 'Viewer',
  };

  if (invitations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Mail className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No pending invitations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pending Invitations</CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Invited By</TableHead>
              <TableHead>Invited Date</TableHead>
              <TableHead>Expires In</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium">{invitation.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {roleDisplayNames[invitation.role] || invitation.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invitation.invitedBy}
                </TableCell>
                <TableCell>
                  {new Date(invitation.invitedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{getTimeUntilExpiry(invitation.expiresAt)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyInvitationLink(invitation.token)}
                      title="Copy invitation link"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleResend(invitation.id)}
                      disabled={loading === invitation.id}
                      title="Resend invitation"
                    >
                      {loading === invitation.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCancel(invitation.id)}
                      disabled={loading === invitation.id}
                      title="Cancel invitation"
                    >
                      {loading === invitation.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

