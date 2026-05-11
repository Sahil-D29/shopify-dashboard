'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface AdminNavbarProps {
  session: any;
}

export function AdminNavbar({ session }: AdminNavbarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    toast.loading('Logging out...', { id: 'logout' });

    try {
      const response = await fetch('/api/admin/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Logged out successfully', { id: 'logout' });
        router.push('/admin/login');
        router.refresh();
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout', { id: 'logout' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="border-b border-gray-200 bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div className="flex h-[72px] items-center justify-between px-5">
        {/* Left side - can add breadcrumbs or title here */}
        <div className="flex items-center">
          <h2 className="text-base font-semibold text-gray-800">
            Admin Dashboard
          </h2>
        </div>

        {/* Right side - User Menu */}
        <div className="flex items-center">
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 hover:bg-gray-50"
              >
                <div 
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white text-sm font-medium"
                  style={{ backgroundColor: '#5459AC' }}
                >
                  {session?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <span className="hidden md:block text-sm font-medium text-gray-700">
                  {session?.name || 'Admin'}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{session?.name || 'Admin'}</p>
                  <p className="text-xs text-gray-500">{session?.email || 'admin@domain.com'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
                <User className="mr-2 h-4 w-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

