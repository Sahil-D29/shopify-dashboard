"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid invitation link. No token provided.');
    }
  }, [token]);

  const handleAccept = async () => {
    if (!token) {
      toast.error('Invalid invitation token');
      return;
    }

    setLoading(true);
    try {
      // Get current user token from cookies or session
      const userToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!userToken) {
        setStatus('error');
        setMessage('Please log in first to accept the invitation.');
        return;
      }

      const res = await fetch(`/api/teams/invitations/accept/${token}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to accept invitation' }));
        throw new Error(error.error || 'Failed to accept invitation');
      }

      const data = await res.json();
      setStatus('success');
      setMessage('Invitation accepted successfully! Redirecting to dashboard...');
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Failed to accept invitation. The invitation may have expired or already been used.');
      toast.error(error.message || 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Invalid Invitation
            </CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/auth/signin')} className="w-full">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : status === 'error' ? (
              <XCircle className="w-5 h-5 text-red-500" />
            ) : (
              <Mail className="w-5 h-5 text-blue-500" />
            )}
            Team Invitation
          </CardTitle>
          <CardDescription>
            {status === 'idle' && 'You have been invited to join a store team. Accept the invitation to get started.'}
            {status === 'success' && 'Invitation accepted successfully!'}
            {status === 'error' && 'Unable to accept invitation'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'idle' && (
            <>
              <p className="text-sm text-muted-foreground">
                Click the button below to accept this invitation and join the team.
              </p>
              <Button
                onClick={handleAccept}
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Accept Invitation
              </Button>
            </>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <p className="text-sm text-green-600">{message}</p>
              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-red-600">{message}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push('/auth/signin')}
                  className="flex-1"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => router.push('/dashboard')}
                  className="flex-1"
                >
                  Dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  );
}

