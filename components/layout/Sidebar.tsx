'use client';

import { useState, useEffect, useMemo } from 'react';
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
  MessageCircle,
  Zap,
  LogOut,
  User,
  Loader2,
  Contact,
  Workflow,
  BarChart3,
  CreditCard,
  Mail,
  Send,
  FileText,
  PieChart,
  Globe,
  FlaskConical,
  BellRing,
  ArrowRightLeft,
  UserPlus,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWindowStorage } from '@/lib/window-storage';
import { toast } from 'sonner';
import { StoreSwitcher } from '@/components/layout/StoreSwitcher';
import { ChatNotificationBadge } from '@/components/chat/ChatNotificationBadge';
import { X } from 'lucide-react';
import { useAppConfig } from '@/components/providers/AppConfigProvider';

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
  { name: 'Billing', href: '/billing', icon: CreditCard },
];

/** A nav item that is gated by subscription: greyed, lock icon, routes to Billing. */
function LockedNavItem({
  icon: Icon,
  label,
  small = false,
  isMobile,
  onClose,
}: {
  icon: React.ElementType;
  label: string;
  small?: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}) {
  return (
    <Link
      href="/billing"
      onClick={isMobile ? onClose : undefined}
      title="Subscribe to unlock this feature"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 opacity-60 hover:opacity-100 hover:bg-gray-800/60 transition-colors"
    >
      <Icon className={cn(small ? 'h-4 w-4' : 'h-5 w-5', 'shrink-0')} />
      <span className="flex-1">{label}</span>
      <Lock className="h-3.5 w-3.5 shrink-0" />
    </Link>
  );
}

export function Sidebar({ onClose, isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { settings: appSettings, featureFlags } = useAppConfig();
  const disabled = useMemo(
    () => new Set(featureFlags.disabledItems),
    [featureFlags.disabledItems],
  );
  const isEnabled = (key: string) => !disabled.has(key);
  // Locked = visible but gated by subscription (greyed + lock → Billing).
  const locked = useMemo(
    () => new Set(featureFlags.lockedItems || []),
    [featureFlags.lockedItems],
  );
  const isLocked = (key: string) => locked.has(key);
  const lockedItem = (icon: React.ElementType, label: string, small = false) => (
    <LockedNavItem icon={icon} label={label} small={small} isMobile={isMobile} onClose={onClose} />
  );
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
      // 1. Clear all auth cookies via our logout API
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});

      // 2. Sign out via NextAuth (clears session state)
      await signOut({ redirect: false }).catch(() => {});

      // 3. Clear client-side state
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        // Manually clear auth cookies from client side as fallback
        document.cookie.split(';').forEach(c => {
          const name = c.split('=')[0].trim();
          if (name.includes('auth') || name.includes('session') || name === 'current_store_id') {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          }
        });
      }

      toast.dismiss('signout');
      // Hard redirect to sign-in page
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('[SignOut] Error:', error);
      toast.error('Error signing out', { id: 'signout' });
      // Fallback: force redirect even on error
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      window.location.href = '/auth/signin';
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
    // Auto-expand email section when on email pages
    if (pathname?.startsWith('/email')) {
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
        <div className="flex h-16 items-center justify-center gap-2 border-b border-gray-800 px-3">
          {appSettings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={appSettings.logoUrl}
              alt={appSettings.appName}
              className="h-8 w-8 rounded object-contain"
            />
          ) : null}
          <h1 className="text-xl font-bold truncate">{appSettings.appName}</h1>
        </div>
      )}
      
      {/* Store Switcher */}
      <div className="px-4 py-3 border-b border-gray-800">
        <StoreSwitcher />
      </div>
      
      <nav className="flex-1 flex flex-col space-y-1 px-4 py-4 overflow-y-auto">
        <div className="flex-1 space-y-1">
          {/* Dashboard */}
          {isEnabled('dashboard') && (
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
          )}

          {/* Live Chat */}
          {isEnabled('chat') && (isLocked('chat') ? lockedItem(MessageCircle, 'Live Chat') : (
          <Link
            href="/chat"
            onClick={isMobile ? onClose : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname?.startsWith('/chat')
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )}
          >
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span className="flex-1">Live Chat</span>
            <ChatNotificationBadge storeId={null} />
          </Link>
          ))}

        {/* Customers Section with Nested Segments */}
        {isEnabled('customers') && (isLocked('customers') ? lockedItem(Users, 'Customers') : (
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
          {isEnabled('segments') && (
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
          )}
        </div>
        ))}

        {/* Contacts (WhatsApp) */}
        {isEnabled('contacts') && (isLocked('contacts') ? lockedItem(Contact, 'Contacts') : (
        <Link
          href="/contacts"
          onClick={isMobile ? onClose : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith('/contacts')
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <Contact className="h-5 w-5 shrink-0" />
          Contacts
        </Link>
        ))}

        {/* Templates */}
        {isEnabled('templates') && (isLocked('templates') ? lockedItem(MessageSquare, 'Templates') : (
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
        ))}

        {/* Campaigns */}
        {isEnabled('campaigns') && (isLocked('campaigns') ? lockedItem(Zap, 'Campaigns') : (
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
        ))}

        {/* Email Marketing Section */}
        {isEnabled('email_marketing') && (isLocked('email_marketing') ? lockedItem(Mail, 'Email Marketing') : (
        <div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleEmail}
              className={cn(
                "flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname?.startsWith('/email')
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Mail className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">Email Marketing</span>
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
            <div className="ml-4 space-y-0.5 mt-1">
              {[
                { name: 'Campaigns', href: '/email/campaigns', icon: Send, flag: 'email_campaigns' },
                { name: 'Templates', href: '/email/templates', icon: FileText, flag: 'email_templates' },
                { name: 'Analytics', href: '/email/analytics', icon: PieChart, flag: 'email_analytics' },
                { name: 'Subscribers', href: '/email/subscribers', icon: UserPlus, flag: 'email_subscribers' },
                { name: 'Domains', href: '/email/domains', icon: Globe, flag: 'email_domains' },
                { name: 'A/B Tests', href: '/email/ab-tests', icon: FlaskConical, flag: 'email_ab_tests' },
                { name: 'Back-in-Stock', href: '/email/back-in-stock', icon: BellRing, flag: 'email_back_in_stock' },
                { name: 'Cross-Sell', href: '/email/cross-sell', icon: ArrowRightLeft, flag: 'email_cross_sell' },
              ]
                .filter(item => isEnabled(item.flag))
                .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={isMobile ? onClose : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
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
        </div>
        ))}

        {/* Journeys */}
        {isEnabled('journeys') && (isLocked('journeys') ? lockedItem(Zap, 'Journeys') : (
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
        ))}

        {/* Flows */}
        {isEnabled('flows') && (isLocked('flows') ? lockedItem(Workflow, 'Flows') : (
        <Link
          href="/flows"
          onClick={isMobile ? onClose : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith('/flows')
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <Workflow className="h-5 w-5 shrink-0" />
          Flows
        </Link>
        ))}

        {/* Analytics */}
        {isEnabled('analytics') && (isLocked('analytics') ? lockedItem(BarChart3, 'Analytics') : (
        <Link
          href="/analytics"
          onClick={isMobile ? onClose : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith('/analytics')
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          )}
        >
          <BarChart3 className="h-5 w-5 shrink-0" />
          Analytics
        </Link>
        ))}

        {/* Other Navigation Items (excluding Dashboard and Settings) */}
        {navigation.map((item) => {
          if (item.name === 'Dashboard' || item.name === 'Settings') return null;
          const flagKey =
            item.name === 'Orders' ? 'orders'
              : item.name === 'Products' ? 'products'
              : item.name === 'Abandoned Carts' ? 'abandoned_carts'
              : item.name === 'Billing' ? 'billing'
              : null;
          if (flagKey && !isEnabled(flagKey)) return null;
          if (flagKey && isLocked(flagKey)) {
            return <LockedNavItem key={item.name} icon={item.icon} label={item.name} isMobile={isMobile} onClose={onClose} />;
          }

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
        {isEnabled('settings') && (
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
        )}
        
        </div>
      </nav>

      {/* Customer Support (shown if configured in admin settings) */}
      {(appSettings.supportEmail || appSettings.supportPhone || appSettings.supportUrl || appSettings.helpDocsUrl) && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-1 text-xs text-gray-400">
          <p className="font-semibold uppercase tracking-wider text-gray-500 mb-1">Support</p>
          {appSettings.supportEmail && (
            <a href={`mailto:${appSettings.supportEmail}`} className="block hover:text-white truncate">
              ✉ {appSettings.supportEmail}
            </a>
          )}
          {appSettings.supportPhone && (
            <a href={`tel:${appSettings.supportPhone}`} className="block hover:text-white">
              ☎ {appSettings.supportPhone}
            </a>
          )}
          {appSettings.supportUrl && (
            <a href={appSettings.supportUrl} target="_blank" rel="noreferrer noopener" className="block hover:text-white truncate">
              ↗ Help Center
            </a>
          )}
          {appSettings.helpDocsUrl && (
            <a href={appSettings.helpDocsUrl} target="_blank" rel="noreferrer noopener" className="block hover:text-white truncate">
              ↗ Docs
            </a>
          )}
        </div>
      )}

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
