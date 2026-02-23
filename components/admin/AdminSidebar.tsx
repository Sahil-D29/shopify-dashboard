'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Store,
  BarChart3,
  Settings,
  Shield,
  FileText,
  CreditCard,
  Tag,
  Palette,
  Package,
  Megaphone,
  MessageSquare,
  HeartPulse,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: '',
    items: [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Management',
    items: [
      { name: 'Users', href: '/admin/users', icon: Users },
      { name: 'Stores', href: '/admin/stores', icon: Store },
      { name: 'Brand', href: '/admin/brand', icon: Palette },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { name: 'Billing', href: '/admin/billing', icon: CreditCard },
      { name: 'Coupons', href: '/admin/coupons', icon: Tag },
      { name: 'Plans', href: '/admin/plans', icon: Package },
    ],
  },
  {
    label: 'Campaigns',
    items: [
      { name: 'Campaigns', href: '/admin/campaigns', icon: Megaphone },
      { name: 'Templates', href: '/admin/templates', icon: MessageSquare },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { name: 'System Health', href: '/admin/system-health', icon: HeartPulse },
      { name: 'Error Logs', href: '/admin/error-logs', icon: AlertTriangle },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { name: 'Notifications', href: '/admin/notifications', icon: Bell },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
  {
    label: 'Logs',
    items: [
      { name: 'Access Logs', href: '/admin/logs', icon: Shield },
      { name: 'Audit Trail', href: '/admin/audit', icon: FileText },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href ||
      (item.href !== '/admin' && pathname?.startsWith(item.href));

    return (
      <Link
        key={item.name}
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-normal transition-all relative',
          isActive && 'bg-white/10'
        )}
        style={{
          color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
          borderLeft: isActive ? '3px solid #ffffff' : '3px solid transparent',
          paddingLeft: isActive ? '12px' : '15px'
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = '';
          }
        }}
      >
        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <div
      className="flex h-screen w-56 flex-col border-r text-white"
      style={{
        backgroundColor: '#5459AC',
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }}
    >
      {/* Logo/Brand */}
      <div
        className="flex h-16 items-center justify-center border-b px-4"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-white" />
          <h1 className="text-base font-semibold text-white">Admin Portal</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, idx) => (
          <div key={group.label || 'dashboard'} className="mb-4">
            {group.label && (
              <p className="px-3 mb-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="border-t p-4"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Admin Portal v2.0
        </p>
      </div>
    </div>
  );
}
