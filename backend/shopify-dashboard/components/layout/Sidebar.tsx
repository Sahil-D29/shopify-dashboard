'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  ShoppingBag,
  Settings,
  Filter,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Zap,
  LogOut,
  User,
  Loader2,
  Phone,
  Mail,
  BarChart3,
  UserCheck,
  Globe,
  FlaskConical,
  BellRing,
  ArrowRightLeft,
  Send,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWindowStorage } from '@/lib/window-storage';
import { toast } from 'sonner';
import { StoreSwitcher } from '@/components/layout/StoreSwitcher';
import { X } from 'lucide-react';

const USER_PREFERENCES_KEY = 'user:preferences';

interface UserPreferences {
  sidebarCustomersExpanded?: boolean;
  sidebarEmailExpanded?: boolean;
}

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Abandoned Carts', href: '/abandoned-carts', icon: ShoppingBag },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ onClose, isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isCustomersExpanded, setIsCustomersExpanded] = useState(false);
  const [isEmailExpanded, setIsEmailExpanded] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [canAccessSettings, setCanAccessSettings] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    toast.loading('Signing out...', { id: 'signout' });
    
    try {
      // Step 1: Clear all client-side storage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // Step 2: Call custom logout API to clear server-side cookies
      const logoutResponse = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      console.log('[SignOut] Custom logout response:', logoutResponse.status);
      
      // Step 3: Also call NextAuth signOut to be thorough
      await signOut({ redirect: false });
      
      // Step 4: Clear cookies from client side
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const cookieName = cookie.split('=')[0].trim();
          // Clear with various path options
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
        }
      }
      
      toast.success('Signed out successfully!', { id: 'signout' });
      
      // Step 5: Force full page redirect to sign-in
      // Use replace to prevent back button from going to authenticated pages
      window.location.replace('/auth/signin');
      
    } catch (error) {
      console.error('[SignOut] Error:', error);
      toast.error('Error signing out', { id: 'signout' });
      
      // Force redirect even on error
      window.location.replace('/auth/signin');
    }
  };

  // Check user permissions for Settings access
  useEffect(() => {
    const checkPermissions = async () => {
      if (status !== 'authenticated') {
        setCanAccessSettings(false);
        return;
      }

      try {
        const response = await fetch('/api/user/permissions');
        const data = await response.json();
        if (data.success && data.permissions?.canAccessSettings) {
          setCanAccessSettings(true);
        } else {
          setCanAccessSettings(false);
        }
      } catch (error) {
        console.warn('[Sidebar] Failed to check permissions:', error);
        setCanAccessSettings(false);
      }
    };

    checkPermissions();
  }, [status]);

  useEffect(() => {
    if (pathname === '/segments') {
      setIsCustomersExpanded(true);
    } else {
      try {
        const storage = getWindowStorage();
        const preferences = storage.getJSON<UserPreferences>(USER_PREFERENCES_KEY, {});
        if (preferences?.sidebarCustomersExpanded != null) {
          setIsCustomersExpanded(Boolean(preferences.sidebarCustomersExpanded));
        }
      } catch (error) {
        console.warn('[Sidebar] Failed to load user preferences', error);
      }
    }
    if (pathname?.startsWith('/email/')) {
      setIsEmailExpanded(true);
    } else {
      try {
        const storage = getWindowStorage();
        const preferences = storage.getJSON<UserPreferences>(USER_PREFERENCES_KEY, {});
        if (preferences?.sidebarEmailExpanded != null) {
          setIsEmailExpanded(Boolean(preferences.sidebarEmailExpanded));
        }
      } catch (error) {
        console.warn('[Sidebar] Failed to load email preferences', error);
      }
    }
  }, [pathname]);

  const toggleCustomers = () => {
    const newState = !isCustomersExpanded;
    setIsCustomersExpanded(newState);
    
    try {
      const storage = getWindowStorage();
      const preferences = storage.getJSON<UserPreferences>(USER_PREFERENCES_KEY, {}) ?? {};
      const updated: UserPreferences = {
        ...preferences,
        sidebarCustomersExpanded: newState,
      };
      storage.setJSON(USER_PREFERENCES_KEY, updated);
    } catch (error) {
      console.warn('[Sidebar] Failed to persist user preferences', error);
    }
  };

  const toggleEmail = () => {
    const newState = !isEmailExpanded;
    setIsEmailExpanded(newState);
    try {
      const storage = getWindowStorage();
      const preferences = storage.getJSON<UserPreferences>(USER_PREFERENCES_KEY, {}) ?? {};
      const updated: UserPreferences = { ...preferences, sidebarEmailExpanded: newState };
      storage.setJSON(USER_PREFERENCES_KEY, updated);
    } catch (error) {
      console.warn('[Sidebar] Failed to persist email preferences', error);
    }
  };

  const isCustomersActive = pathname === '/customers';
  const isSegmentsActive = pathname?.startsWith('/segments');
  const isEmailActive = pathname?.startsWith('/email/');

  // User display info
  const user = session?.user;
  const userName = user?.name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const userImage = user?.image;
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen w-64 flex-col bg-gray-900 text-white">
      {/* Mobile header with close button */}
      {isMobile && (
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-gray-800">
          <h1 className="text-lg font-bold">Menu</h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-700 rounded-md p-1"
            aria-label="Close sidebar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Desktop header */}
      {!isMobile && (
        <div className="flex h-16 items-center justify-center border-b border-gray-800">
          <h1 className="text-xl font-bold">Shopify Dashboard</h1>
        </div>
      )}
      
      {/* Store Switcher */}
      <div className="px-4 py-3 border-b border-gray-800">
        <StoreSwitcher />
      </div>
      
      <nav className="flex-1 flex flex-col space-y-1 px-4 py-4 overflow-y-auto">
        <div className="flex-1 space-y-1">
          {/* Dashboard */}
          <Link
            href="/"
            onClick={isMobile ? onClose : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === '/'
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            Dashboard
          </Link>

        {/* Customers Section with Nested Segments */}
        <div>
          <div className="flex items-center gap-1">
            <Link
              href="/customers"
              onClick={isMobile ? onClose : undefined}
              className={cn(
                "flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isCustomersActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Users className="h-5 w-5 shrink-0" />
              <span className="flex-1">Customers</span>
            </Link>
            <button
              onClick={toggleCustomers}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                "text-gray-400 hover:bg-gray-800 hover:text-white",
                "focus:outline-none focus:ring-2 focus:ring-gray-700"
              )}
              aria-label={isCustomersExpanded ? "Collapse Customers" : "Expand Customers"}
              aria-expanded={isCustomersExpanded}
            >
              {isCustomersExpanded ? (
                <ChevronDown className="h-4 w-4 transition-transform duration-200" />
              ) : (
                <ChevronRight className="h-4 w-4 transition-transform duration-200" />
              )}
            </button>
          </div>
          
          {/* Nested Segments */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isCustomersExpanded ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <Link
              href="/segments"
              onClick={isMobile ? onClose : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ml-8 mt-1",
                isSegmentsActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Filter className="h-4 w-4 shrink-0" />
              <span className="text-xs">Segments</span>
            </Link>
          </div>
        </div>

        {/* Templates */}
        <Link
          href="/templates"
          onClick={isMobile ? onClose : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === '/templates'
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <MessageSquare className="h-5 w-5 shrink-0" />
          Templates
        </Link>

        {/* WhatsApp CRM */}
        <Link
          href="/whatsapp-crm"
          onClick={isMobile ? onClose : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith('/whatsapp-crm')
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <Phone className="h-5 w-5 shrink-0" />
          WhatsApp CRM
        </Link>

        {/* Email Marketing Section */}
        <div>
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-default",
                isEmailActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400"
              )}
            >
              <Mail className="h-5 w-5 shrink-0" />
              <span className="flex-1">Email Marketing</span>
            </div>
            <button
              onClick={toggleEmail}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                "text-gray-400 hover:bg-gray-800 hover:text-white",
                "focus:outline-none focus:ring-2 focus:ring-gray-700"
              )}
              aria-label={isEmailExpanded ? "Collapse Email Marketing" : "Expand Email Marketing"}
              aria-expanded={isEmailExpanded}
            >
              {isEmailExpanded ? (
                <ChevronDown className="h-4 w-4 transition-transform duration-200" />
              ) : (
                <ChevronRight className="h-4 w-4 transition-transform duration-200" />
              )}
            </button>
          </div>

          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isEmailExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            {[
              { name: 'Campaigns', href: '/email/campaigns', icon: Send },
              { name: 'Templates', href: '/email/templates', icon: FileText },
              { name: 'Analytics', href: '/email/analytics', icon: BarChart3 },
              { name: 'Subscribers', href: '/email/subscribers', icon: UserCheck },
              { name: 'Domains', href: '/email/domains', icon: Globe },
              { name: 'A/B Tests', href: '/email/ab-tests', icon: FlaskConical },
              { name: 'Back-in-Stock', href: '/email/back-in-stock', icon: BellRing },
              { name: 'Cross-Sell', href: '/email/cross-sell', icon: ArrowRightLeft },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={isMobile ? onClose : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ml-6 mt-0.5",
                  pathname === item.href
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="text-xs">{item.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Campaigns */}
        <Link
          href="/campaigns"
          onClick={isMobile ? onClose : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith('/campaigns')
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <Zap className="h-5 w-5 shrink-0" />
          Campaigns
        </Link>

        {/* Journeys */}
        <Link
          href="/journeys"
          onClick={isMobile ? onClose : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith('/journeys')
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <Zap className="h-5 w-5 shrink-0" />
          Journeys
        </Link>

        {/* Other Navigation Items (excluding Dashboard and Settings) */}
        {navigation.map((item) => {
          if (item.name === 'Dashboard' || item.name === 'Settings') return null;
          
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={isMobile ? onClose : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
        
        {/* Settings - Right after Abandoned Carts */}
        <Link
          href="/settings"
          onClick={isMobile ? onClose : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === '/settings'
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          Settings
        </Link>
        
        </div>
      </nav>

      {/* User Profile & Sign Out */}
      <div className="border-t border-gray-800 p-4 space-y-3">
        {/* User Info */}
        {status === 'loading' ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-gray-700 rounded animate-pulse w-24" />
              <div className="h-3 bg-gray-700 rounded animate-pulse w-32" />
            </div>
          </div>
        ) : user ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              {userImage && !imageError ? (
                <Image
                  src={userImage}
                  alt={userName}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                  onError={() => setImageError(true)}
                  unoptimized
                />
              ) : (
                <span className="text-white font-semibold text-sm">
                  {userInitials || <User className="w-5 h-5" />}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {userName}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {userEmail}
              </p>
            </div>
          </div>
        ) : null}

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
            "bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300",
            "border border-red-900/50 hover:border-red-800",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "active:scale-[0.98]"
          )}
        >
          {isSigningOut ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LogOut className="h-5 w-5" />
          )}
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}
