'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminNavbar } from '@/components/admin/AdminNavbar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [adminSession, setAdminSession] = useState<any>(null);

  useEffect(() => {
    // Check admin session on client side
    const checkSession = async () => {
      try {
        const response = await fetch('/api/admin/auth/session');
        if (response.ok) {
          const data = await response.json();
          setAdminSession(data.session);
        } else {
          // Redirect to login if not authenticated
          if (pathname !== '/admin/login') {
            router.push('/admin/login');
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (pathname !== '/admin/login') {
          router.push('/admin/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Allow login page without session check
    if (pathname === '/admin/login') {
      setIsLoading(false);
      return;
    }

    checkSession();
  }, [pathname, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div 
            className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent mx-auto"
            style={{ borderColor: '#5459AC' }}
          ></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't show layout on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <AdminNavbar session={adminSession} />
        <main className="flex-1 overflow-y-auto px-4 py-5 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

