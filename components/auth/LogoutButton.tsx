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
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Use redirect: false — signOut with redirect: true is unreliable on mobile browsers
      await signOut({ redirect: false });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always force redirect — works reliably on both desktop and mobile
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

