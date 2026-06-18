"use client";

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';
import { useAppConfig } from '@/components/providers/AppConfigProvider';

// Maps a route prefix to its sidebar feature key, for the subscription gate.
// Dashboard (/), Settings, Billing are intentionally absent (never locked).
const ROUTE_KEY: { prefix: string; key: string }[] = [
  { prefix: '/chat', key: 'chat' },
  { prefix: '/customers', key: 'customers' },
  { prefix: '/segments', key: 'segments' },
  { prefix: '/contacts', key: 'contacts' },
  { prefix: '/templates', key: 'templates' },
  { prefix: '/campaigns', key: 'campaigns' },
  { prefix: '/email', key: 'email_marketing' },
  { prefix: '/journeys', key: 'journeys' },
  { prefix: '/flows', key: 'flows' },
  { prefix: '/analytics', key: 'analytics' },
  { prefix: '/orders', key: 'orders' },
  { prefix: '/products', key: 'products' },
  { prefix: '/abandoned-carts', key: 'abandoned_carts' },
];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings: appSettings, featureFlags } = useAppConfig();
  const isAuthPage = pathname?.startsWith('/auth');
  const isChatPage = pathname?.startsWith('/chat');
  const isBuilderPage = /^\/(journeys|flows)\/[^/]+\/builder/.test(pathname ?? '');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Defense-in-depth: if the current route maps to a subscription-locked feature,
  // bounce to Billing (the sidebar already shows it locked, this stops direct URLs).
  useEffect(() => {
    const locked = new Set(featureFlags.lockedItems || []);
    if (locked.size === 0 || !pathname) return;
    const match = ROUTE_KEY.find(r => pathname === r.prefix || pathname.startsWith(r.prefix + '/'));
    if (match && locked.has(match.key)) {
      router.replace('/billing');
    }
  }, [pathname, featureFlags.lockedItems, router]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  if (isAuthPage || isBuilderPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF9F6] text-[#4A4139]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar (slide-in) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} isMobile={true} />
      </div>

      {/* Desktop sidebar (always visible) */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar isMobile={false} />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 lg:ml-0 min-w-0">
        {/* Mobile header with menu button */}
        <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm lg:hidden">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 text-sm font-semibold leading-6 text-gray-900">
            {appSettings.appName}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {isChatPage ? (
            children
          ) : (
            <div className="px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

