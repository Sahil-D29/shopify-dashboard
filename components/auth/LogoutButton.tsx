'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface LogoutButtonProps {
  variant?: 'default' | 'ghost' | 'outline' | 'destructive';
  showIcon?: boolean;
  className?: string;
}

export default function LogoutButton({
  variant = 'ghost',
  showIcon = true,
  className = ''
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      // 1. Clear all auth cookies via our logout API
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});

      // 2. Sign out via NextAuth (clears session state)
      await signOut({ redirect: false }).catch(() => {});

      // 3. Clear client-side state
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Hard redirect to sign-in page
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: force redirect even on error
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      window.location.href = '/auth/signin';
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleLogout}
      disabled={isLoading}
      className={`w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 ${className}`}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : showIcon ? (
        <LogOut className="mr-2 h-4 w-4" />
      ) : null}
      {isLoading ? 'Logging out...' : 'Logout'}
    </Button>
  );
}
