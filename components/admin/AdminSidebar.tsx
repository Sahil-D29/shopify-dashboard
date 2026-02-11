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
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'User Management', href: '/admin/users', icon: Users },
  { name: 'Store Management', href: '/admin/stores', icon: Store },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
  { name: 'Access Logs', href: '/admin/logs', icon: Shield },
  { name: 'Audit Trail', href: '/admin/audit', icon: FileText },
];

export function AdminSidebar() {
  const pathname = usePathname();

  // Group navigation items
  const dashboardGroup = [navigation[0]]; // Dashboard
  const managementGroup = [navigation[1], navigation[2]]; // Users, Stores
  const systemGroup = [navigation[3], navigation[4]]; // Analytics, Settings
  const logsGroup = [navigation[5], navigation[6]]; // Access Logs, Audit Trail

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
        {/* Dashboard Group */}
        <div className="mb-6">
          {dashboardGroup.map((item) => {
            const isActive = pathname === item.href || 
                            (item.href !== '/admin' && pathname?.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-all relative',
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
                <item.icon className="h-[20px] w-[20px] flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Management Group */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Management
          </p>
          <div className="space-y-1">
            {managementGroup.map((item) => {
              const isActive = pathname === item.href || 
                              (item.href !== '/admin' && pathname?.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-all relative',
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
                  <item.icon className="h-[20px] w-[20px] flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* System Group */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            System
          </p>
          <div className="space-y-1">
            {systemGroup.map((item) => {
              const isActive = pathname === item.href || 
                              (item.href !== '/admin' && pathname?.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-all relative',
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
                  <item.icon className="h-[20px] w-[20px] flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Logs Group */}
        <div>
          <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Logs
          </p>
          <div className="space-y-1">
            {logsGroup.map((item) => {
              const isActive = pathname === item.href || 
                              (item.href !== '/admin' && pathname?.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-all relative',
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
                  <item.icon className="h-[20px] w-[20px] flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div 
        className="border-t p-4"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Admin Portal v1.0
        </p>
      </div>
    </div>
  );
}

