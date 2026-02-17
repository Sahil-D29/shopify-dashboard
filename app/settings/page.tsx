"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter, redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, CheckCircle2, XCircle, Eye, EyeOff, Loader2, Info, 
  ShoppingBag, MessageSquare, Phone, ShieldCheck, RefreshCcw, ExternalLink,
  CreditCard, Bell, Link as LinkIcon, Users, UserPlus, Mail, Activity, 
  Search, MoreVertical, Edit, Trash2, Shield
} from 'lucide-react';
import { StoreConfigManager, ShopifyConfig } from '@/lib/store-config';
import { getWindowStorage } from '@/lib/window-storage';
import { useTenant } from '@/lib/tenant/tenant-context';
import { toast } from 'sonner';
import { InviteTeamMemberModal } from '@/components/team/InviteTeamMemberModal';
import { PermissionsEditor } from '@/components/team/PermissionsEditor';
import { ActivityLogViewer } from '@/components/team/ActivityLogViewer';
import { PendingInvitationsTable } from '@/components/team/PendingInvitationsTable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TestConnectionResponse {
  success: boolean;
  message?: string;
}

interface WhatsAppConfig {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  contactEmail: string;
  connectedPhoneNumber?: string;
  isVerified: boolean;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

// Settings sections configuration
const settingsSections = [
  { id: 'shop', name: 'Shop', icon: ShoppingBag, description: 'Shopify integration' },
  { id: 'wa', name: 'WA', icon: MessageSquare, description: 'WhatsApp configuration' },
  { id: 'team', name: 'Team', icon: Users, description: 'Team management', requiresOwner: true },
  { id: 'integrations', name: 'Integrations', icon: LinkIcon, description: 'Third-party apps', disabled: true },
  { id: 'payments', name: 'Payments', icon: CreditCard, description: 'Payment settings', disabled: true },
  { id: 'webhooks', name: 'Webhooks', icon: Settings, description: 'Webhook configuration', disabled: true },
  { id: 'notifications', name: 'Notifications', icon: Bell, description: 'Alert settings', disabled: true },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentStore, stores, refreshStores, switchStore } = useTenant();
  const [activeSection, setActiveSection] = useState('shop');
  const [activeTab, setActiveTab] = useState('shopify');
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  // Team tab is now always visible - RBAC is enforced at API level
  
  // Shopify state
  const [shopifyConfig, setShopifyConfig] = useState<ShopifyConfig>({
    shopUrl: '',
    accessToken: '',
    apiKey: '',
    apiSecret: '',
  });
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyResult, setShopifyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showShopifyToken, setShowShopifyToken] = useState(false);
  const [showShopifySecret, setShowShopifySecret] = useState(false);
  const [shopifyErrors, setShopifyErrors] = useState<Record<string, string>>({});
  const [isSetupMode, setIsSetupMode] = useState(false);

  // WhatsApp state
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>({
    wabaId: '',
    phoneNumberId: '',
    accessToken: '',
    appId: '',
    appSecret: '',
    webhookVerifyToken: '',
    contactEmail: '',
    isVerified: false,
  });
  const [showWaToken, setShowWaToken] = useState(false);
  const [showWaSecret, setShowWaSecret] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [waTesting, setWaTesting] = useState(false);
  const [waResult, setWaResult] = useState<{ success: boolean; message: string } | null>(null);
  const [embeddedLoading, setEmbeddedLoading] = useState(false);
  const [embeddedConnected, setEmbeddedConnected] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ shopifyConfigured: boolean; whatsappConfigured: boolean; settingsCompleted: boolean; missingConfigs: string[] } | null>(null);

  // Check access permissions
  useEffect(() => {
    const checkAccess = async () => {
      try {
        console.log('[Settings Page] Checking access permissions...');
        
        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.warn('[Settings Page] Permission check timeout');
          setIsCheckingAccess(false);
          setHasAccess(false);
          toast.error('Timeout checking permissions. Please try again.');
        }, 10000); // 10 second timeout

        // First, try to get user data from /api/user
        let userData = null;
        try {
          const userResponse = await fetch('/api/user', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (userResponse.ok) {
            userData = await userResponse.json();
            console.log('[Settings Page] User data from /api/user:', userData);
          } else {
            console.warn('[Settings Page] /api/user returned:', userResponse.status);
          }
        } catch (error) {
          console.error('[Settings Page] Error fetching /api/user:', error);
        }

        // Then get permissions
        const response = await fetch('/api/user/permissions', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        clearTimeout(timeoutId);

        console.log('[Settings Page] Permission response status:', response.status);
        
        const data = await response.json();
        console.log('[Settings Page] Permission response data:', data);
        
        // Store user role for conditional rendering - check multiple possible locations
        // Priority: userData.role > userContext.role > permissions.role > roles[0] > user.role > fallback
        const role = userData?.role || 
                     userData?.user?.role ||
                     data.userContext?.role || 
                     data.permissions?.role || 
                     data.roles?.[0] || 
                     data.user?.role ||
                     (data.canAccessSettings ? 'STORE_OWNER' : null); // Fallback if canAccessSettings is true
        
        // Normalize role - handle both uppercase and lowercase
        let normalizedRole = role ? role.toLowerCase() : null;
        
        // Map various role formats to standard values for Team tab visibility
        // user-context.ts returns: 'ADMIN', 'STORE_OWNER', 'USER' (uppercase)
        // But we also need to handle: 'admin', 'super_admin', 'store_owner', 'manager' (lowercase)
        let finalRole = normalizedRole;
        if (!normalizedRole) {
          finalRole = null;
        } else if (normalizedRole === 'admin' || normalizedRole === 'administrator' || normalizedRole === 'super_admin') {
          finalRole = 'super_admin';
        } else if (normalizedRole === 'store_owner' || normalizedRole === 'storeowner' || normalizedRole === 'owner' || normalizedRole === 'manager') {
          finalRole = 'store_owner';
        }
        
        setUserRole(finalRole);
        console.log('[Settings Page] 🔍 Role Detection:', { 
          raw: role, 
          normalized: normalizedRole, 
          final: finalRole,
          canAccessSettings: data.canAccessSettings,
          userDataRole: userData?.role,
          userContextRole: data.userContext?.role,
          permissionsRole: data.permissions?.role
        });
        
        // Show Team tab if:
        // 1. Role is ADMIN (from user-context, which maps super_admin to ADMIN)
        // 2. Role is STORE_OWNER
        // 3. OR user has canAccessSettings permission (fallback)
        // Team tab is now always visible - RBAC is enforced at API level, not UI level
        // Role detection is still logged for debugging purposes
        const roleUpper = role ? role.toUpperCase() : '';
        
        console.log('[Settings Page] 🔍 Role Detection (Team tab always visible):', {
          role,
          roleUpper,
          finalRole, 
          canAccessSettings: data.canAccessSettings
        });
        
        // 🔍 DEBUG: Log all possible access indicators
        console.log('🔍 DEBUG - Full response:', JSON.stringify(data, null, 2));
        console.log('🔍 DEBUG - data.success:', data.success);
        console.log('🔍 DEBUG - data.canAccess:', data.canAccess);
        console.log('🔍 DEBUG - data.permissions?.canAccessSettings:', data.permissions?.canAccessSettings);
        console.log('🔍 DEBUG - data.roles:', data.roles);
        console.log('🔍 DEBUG - User role:', role);
        
        // FIX: Handle multiple response formats
        // Format 1: { success: true, canAccess: true, roles: [...] }
        // Format 2: { success: true, permissions: { canAccessSettings: true } }
        const hasAccess = 
          (data.success === true && data.canAccess === true) ||
          (data.success === true && data.permissions?.canAccessSettings === true);
        
        console.log('🔍 DEBUG - Calculated hasAccess:', hasAccess);
        console.log('🔍 DEBUG - Setting hasAccess to:', hasAccess);
        
        // Always allow access in setup mode or if user has permission
        if (hasAccess || isSetupMode) {
          console.log('[Settings Page] ✅ Access GRANTED', { hasAccess, isSetupMode });
          setHasAccess(true);
          if (isSetupMode) {
            toast.info('Please complete your store setup');
          }
        } else {
          console.warn('[Settings Page] ❌ Access DENIED:', {
            success: data.success,
            canAccess: data.canAccess,
            canAccessSettings: data.permissions?.canAccessSettings,
            role: data.permissions?.role || data.roles?.[0],
            error: data.error,
          });
          
          // Still allow access but show warning
          console.log('[Settings Page] Allowing access anyway for settings configuration');
          setHasAccess(true);
          toast.warning('You may not have full permissions, but you can configure settings');
        }
      } catch (error) {
        console.error('[Settings Page] Error checking permissions:', error);
        
        // Always allow access - settings page should be accessible for configuration
        console.log('[Settings Page] Allowing access despite permission check error');
        setHasAccess(true);
        if (isSetupMode) {
          toast.info('Please complete your store setup');
        } else {
          toast.warning('Could not verify permissions, but allowing access to settings');
        }
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkAccess();
  }, [router, searchParams]);

  useEffect(() => {
    // Allow loading in setup mode even if access check failed
    // This allows users to complete setup even if there's a permission issue
    if (!hasAccess && !isSetupMode) return;

    const setupParam = searchParams.get('setup');
    const tabParam = searchParams.get('tab');
    const successParam = searchParams.get('success');
    const errorParam = searchParams.get('error');
    
    setIsSetupMode(setupParam === 'true');
    
    if (tabParam === 'whatsapp') {
      setActiveTab('whatsapp');
      setActiveSection('wa');
    } else if (tabParam === 'shopify') {
      setActiveTab('shopify');
      setActiveSection('shop');
    }
    
    // Handle OAuth success/error
    if (successParam === 'shopify_connected') {
      toast.success('Store connected successfully!');
      refreshStores();
      setActiveTab('shopify');
    } else if (errorParam) {
      toast.error(`Connection failed: ${searchParams.get('message') || errorParam}`);
      setActiveTab('shopify');
    }

    // Load Shopify config
    const existingShopify = StoreConfigManager.getConfig();
    if (existingShopify) {
      setShopifyConfig(existingShopify);
    }

    // Load WhatsApp config from server
    loadWhatsAppConfig();
    
    // Check settings status
    checkSettingsStatus();
  }, [searchParams, refreshStores, hasAccess]);

  const checkSettingsStatus = async () => {
    try {
      const response = await fetch('/api/settings/status');
      const data = await response.json();
      if (data.success) {
        setSettingsStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking settings status:', error);
    }
  };

  const loadWhatsAppConfig = async () => {
    try {
      const storeId = currentStore?.id;
      const res = await fetch(`/api/settings/whatsapp${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''}`);
      const data = await res.json();
      if (data.success && data.config) {
        setWhatsappConfig({
          wabaId: data.config.wabaId || '',
          phoneNumberId: data.config.phoneNumberId || '',
          accessToken: '', // Don't show existing token
          appId: data.config.appId || '',
          appSecret: '', // Don't show existing secret
          webhookVerifyToken: data.config.webhookVerifyToken || '',
          contactEmail: data.config.contactEmail || '',
          connectedPhoneNumber: data.config.connectedPhoneNumber,
          isVerified: data.config.isVerified || false,
        });
      }
    } catch (error) {
      console.error('Failed to load WhatsApp config:', error);
    }
  };

  // Shopify functions
  const validateShopifyForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!shopifyConfig.shopUrl.trim()) newErrors.shopUrl = 'Shop URL is required';
    else if (!StoreConfigManager.validateShopUrl(shopifyConfig.shopUrl)) newErrors.shopUrl = 'Please enter a valid .myshopify.com domain';
    if (!shopifyConfig.accessToken.trim()) newErrors.accessToken = 'Access token is required';
    if (!shopifyConfig.apiKey.trim()) newErrors.apiKey = 'API Key is required';
    if (!shopifyConfig.apiSecret.trim()) newErrors.apiSecret = 'API Secret is required';
    setShopifyErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleShopifyTest = async () => {
    if (!validateShopifyForm()) {
      setShopifyResult({ success: false, message: 'Please fix the validation errors' });
      return;
    }
    setShopifyLoading(true);
    setShopifyResult(null);
    try {
      const res = await fetch('/api/shopify/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shopifyConfig),
      });
      const data = await res.json();
      setShopifyResult({
        success: res.ok && data?.success,
        message: res.ok && data?.success ? `Connected to ${shopifyConfig.shopUrl}` : data?.message || 'Connection failed',
      });
    } catch (error) {
      setShopifyResult({ success: false, message: getErrorMessage(error, 'Connection failed') });
    } finally {
      setShopifyLoading(false);
    }
  };

  const handleShopifySave = async () => {
    if (!validateShopifyForm()) {
      setShopifyResult({ success: false, message: 'Please fix the validation errors' });
      return;
    }
    try {
      // Save to localStorage (client-side)
      StoreConfigManager.saveConfig(shopifyConfig);
      
      // Also save to server-side
      try {
        const res = await fetch('/api/settings/shopify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shopifyConfig),
        });
        const data = await res.json();
        if (!data.success) {
          console.warn('Server-side save failed:', data.message);
          // Continue anyway since client-side save succeeded
        } else {
          // Refresh stores and switch to the created/updated store so the switcher shows real name/domain
          const newStoreId = data?.store?.id as string | undefined;
          if (newStoreId && newStoreId !== currentStore?.id) {
            await refreshStores();
            await switchStore(newStoreId);
          } else {
            await refreshStores();
          }
        }
      } catch (error) {
        console.warn('Error saving to server:', error);
        // Continue anyway since client-side save succeeded
      }
      
      setShopifyResult({
        success: true,
        message: 'Shopify configuration saved!',
      });
      
      // Refresh settings status
      await checkSettingsStatus();
      
      // Check if both configs are now complete (whether in setup mode or not)
      const newStatus = await fetch('/api/settings/status').then(r => r.json());
      if (newStatus.success && newStatus.status?.settingsCompleted) {
        // Automatically mark setup as completed when both configs are saved
        // This ensures setup completion persists even if user saves configs later
        if (!StoreConfigManager.isSetupCompleted()) {
          StoreConfigManager.markSetupCompleted();
          console.log('[Settings] Setup automatically marked as completed');
        }
        
        // If in setup mode, redirect to dashboard
        if (isSetupMode) {
          setTimeout(() => {
            toast.success('All settings configured! Redirecting to dashboard...');
            router.push('/');
          }, 1500);
        }
      }
    } catch (error) {
      setShopifyResult({ success: false, message: getErrorMessage(error, 'Failed to save') });
    }
  };

  const handleShopifyReset = () => {
    if (!confirm('Reset Shopify configuration?')) return;
    StoreConfigManager.clearConfig();
    // Clear setup completion since config is reset
    StoreConfigManager.clearSetupCompleted();
    setShopifyConfig({ shopUrl: '', accessToken: '', apiKey: '', apiSecret: '' });
    setShopifyResult({ success: true, message: 'Configuration reset!' });
  };

  // Facebook Embedded Signup
  const handleEmbeddedSignup = async () => {
    setEmbeddedLoading(true);
    try {
      const res = await fetch('/api/whatsapp/embedded-signup');
      const data = await res.json();
      if (data.loginUrl) {
        window.location.href = data.loginUrl;
      } else {
        setWaResult({ success: false, message: data.error || 'Failed to start signup' });
        setEmbeddedLoading(false);
      }
    } catch (err) {
      setWaResult({ success: false, message: getErrorMessage(err, 'Failed to start embedded signup') });
      setEmbeddedLoading(false);
    }
  };

  // Handle embedded signup OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setWaResult({ success: false, message: decodeURIComponent(oauthError) });
      setActiveSection('wa');
      return;
    }

    if (code) {
      setActiveSection('wa');
      setEmbeddedLoading(true);
      (async () => {
        try {
          const res = await fetch('/api/whatsapp/embedded-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();
          if (data.success) {
            setEmbeddedConnected(true);
            setWaResult({ success: true, message: 'WhatsApp Business Account connected successfully!' });
            window.history.replaceState({}, '', '/settings');
          } else {
            setWaResult({ success: false, message: data.error || 'Failed to complete signup' });
          }
        } catch (err) {
          setWaResult({ success: false, message: getErrorMessage(err, 'Callback processing failed') });
        } finally {
          setEmbeddedLoading(false);
        }
      })();
    }

    if (searchParams.get('connected') === 'true') {
      setEmbeddedConnected(true);
      setActiveSection('wa');
    }
  }, [searchParams]);

  // WhatsApp functions
  const handleWaTest = async () => {
    if (!whatsappConfig.wabaId || !whatsappConfig.phoneNumberId || !whatsappConfig.accessToken) {
      setWaResult({ success: false, message: 'Please fill in WABA ID, Phone Number ID, and Access Token' });
      return;
    }
    setWaTesting(true);
    setWaResult(null);
    try {
      const res = await fetch('/api/whatsapp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wabaId: whatsappConfig.wabaId,
          phoneNumberId: whatsappConfig.phoneNumberId,
          accessToken: whatsappConfig.accessToken,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setWaResult({ success: true, message: `Connected! Phone: ${data.phoneNumber || 'N/A'}` });
        setWhatsappConfig(prev => ({ ...prev, connectedPhoneNumber: data.phoneNumber, isVerified: true }));
      } else {
        setWaResult({ success: false, message: data?.error || 'Connection failed' });
      }
    } catch (error) {
      setWaResult({ success: false, message: getErrorMessage(error, 'Connection failed') });
    } finally {
      setWaTesting(false);
    }
  };

  const handleWaSave = async () => {
    if (!whatsappConfig.wabaId || !whatsappConfig.phoneNumberId || !whatsappConfig.accessToken) {
      setWaResult({ success: false, message: 'Please fill in required fields' });
      return;
    }
    setWaLoading(true);
    try {
      const res = await fetch('/api/settings/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(currentStore?.id ? { 'x-store-id': currentStore.id } : {}) },
        body: JSON.stringify({ ...whatsappConfig, ...(currentStore?.id ? { storeId: currentStore.id } : {}) }),
      });
      const data = await res.json();
      if (data.success) {
        setWaResult({ success: true, message: 'WhatsApp configuration saved!' });
        // Also save to localStorage for client-side access
        const storage = getWindowStorage();
        storage.setJSON('whatsapp_config', { ...whatsappConfig, configuredAt: Date.now() });
        // If server created/used a store (e.g. default store), refresh store list and set current
        if (data.storeId) {
          await refreshStores();
          if (!currentStore?.id) await switchStore(data.storeId);
        }
        // Refresh settings status
        await checkSettingsStatus();
        
        // Check if both configs are now complete (whether in setup mode or not)
        const newStatus = await fetch('/api/settings/status').then(r => r.json());
        if (newStatus.success && newStatus.status?.settingsCompleted) {
          // Automatically mark setup as completed when both configs are saved
          // This ensures setup completion persists even if user saves configs later
          if (!StoreConfigManager.isSetupCompleted()) {
            StoreConfigManager.markSetupCompleted();
            console.log('[Settings] Setup automatically marked as completed');
          }
          
          // If in setup mode, redirect to dashboard
          if (isSetupMode) {
            setTimeout(() => {
              toast.success('All settings configured! Redirecting to dashboard...');
              router.push('/');
            }, 1500);
          }
        }
      } else {
        setWaResult({ success: false, message: data.message || 'Failed to save' });
      }
    } catch (error) {
      setWaResult({ success: false, message: getErrorMessage(error, 'Failed to save') });
    } finally {
      setWaLoading(false);
    }
  };

  const handleWaReset = async () => {
    if (!confirm('Reset WhatsApp configuration?')) return;
    try {
      const storeId = currentStore?.id;
      await fetch(`/api/settings/whatsapp${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''}`, { method: 'DELETE' });
      setWhatsappConfig({
        wabaId: '', phoneNumberId: '', accessToken: '', appId: '',
        appSecret: '', webhookVerifyToken: '', contactEmail: '', isVerified: false,
      });
      const storage = getWindowStorage();
      storage.remove('whatsapp_config');
      // Clear setup completion since config is reset
      StoreConfigManager.clearSetupCompleted();
      setWaResult({ success: true, message: 'Configuration reset!' });
    } catch (error) {
      setWaResult({ success: false, message: 'Failed to reset' });
    }
  };

  // ✅ ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  // Sync activeSection with activeTab for backward compatibility
  useEffect(() => {
    if (activeTab === 'shopify') setActiveSection('shop');
    else if (activeTab === 'whatsapp') setActiveSection('wa');
  }, [activeTab]);

  // ✅ NOW we can have early returns AFTER all hooks
  // Show loading while checking access (but don't block)
  if (isCheckingAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">Loading settings...</p>
      </div>
    );
  }

  // Always show settings page - no access denial
  // Users need to configure settings regardless of permissions
  // The permission check is just for logging, not blocking

  // Handle section change
  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === 'shop') setActiveTab('shopify');
    else if (sectionId === 'wa') setActiveTab('whatsapp');
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Column 2: Settings Section Menu - Enhanced */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-700 flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">Settings</h1>
              <p className="text-xs text-slate-400 mt-0.5">Configure integrations</p>
            </div>
          </div>
        </div>

        {/* Settings Menu Items - Enhanced */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {settingsSections.filter(s => {
            // Show all non-disabled sections (Team tab is always visible now)
            return !s.disabled;
          }).map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => !section.disabled && handleSectionChange(section.id)}
                disabled={section.disabled}
                className={`
                  w-full flex items-center justify-between px-4 py-3.5 rounded-lg
                  text-left transition-all duration-200 group
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                  ${section.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon 
                    className={`h-5 w-5 flex-shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`} 
                  />
                  <div className="text-left">
                    <span className={`text-[15px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                      {section.name}
                    </span>
                    <p className={`text-xs mt-0.5 ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                      {section.description}
                    </p>
                  </div>
                </div>
                {section.disabled && (
                  <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Info - Enhanced */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <div className="p-3 bg-gradient-to-br from-blue-50/10 to-indigo-50/10 rounded-lg border border-blue-500/20">
            <p className="text-xs font-medium text-slate-400 mb-1">💡 Quick Tip</p>
            <p className="text-xs text-slate-500">
              More integrations coming soon
            </p>
          </div>
        </div>
      </aside>

      {/* Column 3: Content Area */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center space-x-3">
            <Settings className="h-6 w-6 text-gray-700" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Settings</h1>
              <p className="text-xs text-gray-500">Configure integrations</p>
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4">
          <div className="flex space-x-1">
            {settingsSections.filter(s => {
              // Show all non-disabled sections (Team tab is always visible now)
              return !s.disabled;
            }).map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionChange(section.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors
                    ${activeSection === section.id
                      ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span>{section.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">

          {isSetupMode && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8 shadow-sm">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Info className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Welcome! Configure Your Store
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Please configure your Shopify and WhatsApp integrations to get started.
                  </p>
                  {settingsStatus && (
                    <div className="flex items-center space-x-6 mb-4">
                      <div className="flex items-center space-x-2">
                        {settingsStatus.shopifyConfigured ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-amber-600" />
                        )}
                        <span className="text-sm font-medium text-gray-700">
                          Shopify {settingsStatus.shopifyConfigured ? 'Configured' : 'Not Configured'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {settingsStatus.whatsappConfigured ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-amber-600" />
                        )}
                        <span className="text-sm font-medium text-gray-700">
                          WhatsApp {settingsStatus.whatsappConfigured ? 'Configured' : 'Not Configured'}
                        </span>
                      </div>
                    </div>
                  )}
                  {settingsStatus?.settingsCompleted && (
                    <div className="mt-4">
                      <span className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                        ✓ Setup Complete!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Desktop Tabs (hidden on mobile, shown in sidebar) */}
          <div className="hidden md:block mb-8">
            <div className="flex space-x-8 border-b border-gray-200">
              <button
                onClick={() => handleSectionChange('shop')}
                className={`pb-4 px-1 text-sm font-semibold border-b-2 transition-colors ${
                  activeSection === 'shop'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Shop
              </button>
              <button
                onClick={() => handleSectionChange('wa')}
                className={`pb-4 px-1 text-sm font-semibold border-b-2 transition-colors ${
                  activeSection === 'wa'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                WA
              </button>
              <button
                onClick={() => handleSectionChange('team')}
                className={`pb-4 px-1 text-sm font-semibold border-b-2 transition-colors ${
                  activeSection === 'team'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Team
              </button>
            </div>
          </div>

          {/* Shopify Section */}
          {activeSection === 'shop' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 md:px-8 py-5 border-b border-gray-200">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Shopify Store Configuration</h2>
                    <p className="text-sm text-gray-600 mt-1">Connect your Shopify store to the Admin API</p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="px-6 md:px-8 py-6 md:py-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Shop URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shopifyConfig.shopUrl}
                    onChange={(e) => setShopifyConfig(prev => ({ ...prev, shopUrl: e.target.value }))}
                    className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                      shopifyErrors.shopUrl ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="your-store.myshopify.com"
                  />
                  {shopifyErrors.shopUrl && <p className="text-xs text-red-500 mt-1">{shopifyErrors.shopUrl}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Access Token <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showShopifyToken ? 'text' : 'password'}
                      value={shopifyConfig.accessToken}
                      onChange={(e) => setShopifyConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                      className={`w-full px-4 py-3 pr-12 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                        shopifyErrors.accessToken ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="shpat_xxxxx"
                    />
                    <button
                      type="button"
                      onClick={() => setShowShopifyToken(!showShopifyToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showShopifyToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {shopifyErrors.accessToken && <p className="text-xs text-red-500 mt-1">{shopifyErrors.accessToken}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shopifyConfig.apiKey}
                      onChange={(e) => setShopifyConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                        shopifyErrors.apiKey ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="xxxxx"
                    />
                    {shopifyErrors.apiKey && <p className="text-xs text-red-500 mt-1">{shopifyErrors.apiKey}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      API Secret <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showShopifySecret ? 'text' : 'password'}
                        value={shopifyConfig.apiSecret}
                        onChange={(e) => setShopifyConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                        className={`w-full px-4 py-3 pr-12 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                          shopifyErrors.apiSecret ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="xxxxx"
                      />
                      <button
                        type="button"
                        onClick={() => setShowShopifySecret(!showShopifySecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showShopifySecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {shopifyErrors.apiSecret && <p className="text-xs text-red-500 mt-1">{shopifyErrors.apiSecret}</p>}
                  </div>
                </div>

                {shopifyResult && (
                  <div className={`flex items-center gap-2 p-3 rounded-md border ${
                    shopifyResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {shopifyResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span className="text-sm">{shopifyResult.message}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center space-x-4 pt-6">
                  <button
                    onClick={handleShopifyTest}
                    disabled={shopifyLoading}
                    className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {shopifyLoading ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </span>
                    ) : (
                      'Test Connection'
                    )}
                  </button>
                  <button
                    onClick={handleShopifySave}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-base font-semibold rounded-lg shadow-lg shadow-orange-500/30 transition-all"
                  >
                    Save Configuration
                  </button>
                  <button
                    onClick={handleShopifyReset}
                    className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* WhatsApp Section */}
          {activeSection === 'wa' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 md:px-8 py-5 border-b border-gray-200">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">WhatsApp Configuration</h2>
                    <p className="text-sm text-gray-600 mt-1">Configure WhatsApp Business API settings</p>
                  </div>
                </div>
              </div>

              <div className="px-6 md:px-8 py-6 md:py-8 space-y-6">
                {/* Facebook Embedded Signup */}
                <div className={`p-5 rounded-lg border ${embeddedConnected ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        {embeddedConnected ? (
                          <><CheckCircle2 className="h-5 w-5 text-green-600" /> WhatsApp Connected</>
                        ) : (
                          <><ExternalLink className="h-5 w-5 text-blue-600" /> Quick Setup with Facebook</>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {embeddedConnected
                          ? 'Your WhatsApp Business Account is connected via Facebook'
                          : 'One-click setup — connect your WhatsApp Business Account via Facebook Login'}
                      </p>
                    </div>
                    <button
                      onClick={handleEmbeddedSignup}
                      disabled={embeddedLoading}
                      className={`px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        embeddedConnected
                          ? 'bg-gray-600 hover:bg-gray-700'
                          : 'bg-[#1877F2] hover:bg-[#166FE5] shadow-lg shadow-blue-600/30'
                      }`}
                    >
                      {embeddedLoading ? (
                        <span className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </span>
                      ) : embeddedConnected ? (
                        'Reconnect'
                      ) : (
                        <span className="flex items-center">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Connect with Facebook
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-white text-gray-500">OR configure manually</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Business Account ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={whatsappConfig.wabaId}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, wabaId: e.target.value }))}
                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="854321680362580"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={whatsappConfig.phoneNumberId}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="901548389701354"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Access Token <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showWaToken ? 'text' : 'password'}
                      value={whatsappConfig.accessToken}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                      className="w-full px-4 py-3 pr-12 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="EAAdDz6bQLkM..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaToken(!showWaToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showWaToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Meta App ID</label>
                    <input
                      type="text"
                      value={whatsappConfig.appId}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, appId: e.target.value }))}
                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="2044883972927043"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Meta App Secret</label>
                    <div className="relative">
                      <input
                        type={showWaSecret ? 'text' : 'password'}
                        value={whatsappConfig.appSecret}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, appSecret: e.target.value }))}
                        className="w-full px-4 py-3 pr-12 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWaSecret(!showWaSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showWaSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Webhook Verification Token</label>
                    <input
                      type="text"
                      value={whatsappConfig.webhookVerifyToken}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, webhookVerifyToken: e.target.value }))}
                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="your-webhook-verify-token"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Email</label>
                    <input
                      type="email"
                      value={whatsappConfig.contactEmail}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, contactEmail: e.target.value }))}
                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                {whatsappConfig.connectedPhoneNumber && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <Phone className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-800">Connected: {whatsappConfig.connectedPhoneNumber}</span>
                  </div>
                )}

                {waResult && (
                  <div className={`flex items-center gap-2 p-3 rounded-md border ${
                    waResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {waResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span className="text-sm">{waResult.message}</span>
                  </div>
                )}

                <div className="flex items-center space-x-4 pt-6">
                  <button
                    onClick={handleWaTest}
                    disabled={waTesting}
                    className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {waTesting ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Phone className="mr-2 h-4 w-4" />
                        Test Connection
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleWaSave}
                    disabled={waLoading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-base font-semibold rounded-lg shadow-lg shadow-green-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {waLoading ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Save Configuration'
                    )}
                  </button>
                  <button
                    onClick={handleWaReset}
                    className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Coming Soon Sections */}
          {activeSection === 'integrations' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LinkIcon className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Integrations</h3>
                <p className="text-gray-600">This feature is coming soon. Stay tuned!</p>
              </div>
            </div>
          )}

          {activeSection === 'payments' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Payments</h3>
                <p className="text-gray-600">This feature is coming soon. Stay tuned!</p>
              </div>
            </div>
          )}

          {activeSection === 'webhooks' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Webhooks</h3>
                <p className="text-gray-600">This feature is coming soon. Stay tuned!</p>
              </div>
            </div>
          )}

          {activeSection === 'team' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <TeamAutoAccessSection />
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h3>
                <p className="text-gray-600">This feature is coming soon. Stay tuned!</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Team Management Section Component - Renders inline in Settings
function TeamManagementSection() {
  const { currentStore } = useTenant();
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('members');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [showPermissionsEditor, setShowPermissionsEditor] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ planType: string; teamMembersPerStore: number; currentCount: number } | null>(null);

  const storeId = currentStore?.id;

  useEffect(() => {
    if (storeId) {
      loadTeamData();
      loadInvitations();
    }
  }, [storeId]);

  useEffect(() => {
    if (teamData) {
      loadSubscriptionInfo();
    }
  }, [teamData]);

  const loadTeamData = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${storeId}`);
      if (!res.ok) throw new Error('Failed to load team data');
      const data = await res.json();
      setTeamData(data.team);
    } catch (error) {
      console.error('Failed to load team:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/teams/invitations/pending?storeId=${storeId}`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const loadSubscriptionInfo = async () => {
    try {
      // Get current user's subscription
      const userRes = await fetch('/api/user/permissions');
      if (userRes.ok) {
        const userData = await userRes.json();
        const userId = userData.user?.id;
        
        if (userId) {
          const res = await fetch(`/api/subscriptions?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            const subscription = Array.isArray(data.subscriptions) ? data.subscriptions[0] : data.subscription;
            if (subscription) {
              // Get plan features
              const planRes = await fetch('/api/subscriptions/plan-features');
              if (planRes.ok) {
                const plansData = await planRes.json();
                const plan = plansData.plans?.find((p: any) => p.id === subscription.planType);
                if (plan) {
                  setSubscriptionInfo({
                    planType: subscription.planType,
                    teamMembersPerStore: plan.features?.teamMembersPerStore || 0,
                    currentCount: teamData?.teamMembers?.length || 0
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load subscription info:', error);
    }
  };

  const handleInvite = async (email: string, role: string, permissions: string[], expiryDays?: number) => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/teams/${storeId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, permissions, expiryDays }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send invitation');
      }
      toast.success(`Invitation sent to ${email}`);
      setShowInviteModal(false);
      loadInvitations();
      loadTeamData();
      loadSubscriptionInfo();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/teams/${storeId}/members/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      toast.success('Role updated successfully');
      loadTeamData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'store_owner': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'manager': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'team_member': return 'bg-green-100 text-green-700 border-green-200';
      case 'viewer': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredMembers = teamData?.teamMembers?.filter((member: any) => {
    const matchesSearch = !searchQuery || 
      member.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  }) || [];

  if (!storeId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Please select a store</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your store team members and their permissions
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Team Member
        </Button>
      </div>

      {/* Subscription Info */}
      {subscriptionInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                Team Members: {subscriptionInfo.currentCount}/{subscriptionInfo.teamMembersPerStore === -1 ? '∞' : subscriptionInfo.teamMembersPerStore} ({subscriptionInfo.planType.charAt(0).toUpperCase() + subscriptionInfo.planType.slice(1)} Plan)
              </p>
            </div>
            {subscriptionInfo.teamMembersPerStore !== -1 && subscriptionInfo.currentCount >= subscriptionInfo.teamMembersPerStore && (
              <Button variant="outline" size="sm">
                Upgrade Plan
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="members">
            <Users className="w-4 h-4 mr-2" />
            Team Members
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="w-4 h-4 mr-2" />
            Pending Invitations
            {invitations.length > 0 && (
              <span className="ml-2 bg-blue-500 text-white rounded-full px-2 py-0.5 text-xs">
                {invitations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="all">All Roles</option>
                    <option value="manager">Manager</option>
                    <option value="team_member">Team Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No team members found</p>
                  <Button onClick={() => setShowInviteModal(true)} className="mt-4">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Your First Team Member
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Added Date</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member: any) => {
                        const initials = member.user?.name
                          ? member.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                          : member.user?.email?.[0].toUpperCase() || '?';
                        
                        const roleDisplayNames: Record<string, string> = {
                          manager: 'Store Manager',
                          team_member: 'Team Member',
                          viewer: 'Viewer',
                          store_owner: 'Store Owner',
                        };

                        const visiblePermissions = member.permissions?.slice(0, 3) || [];
                        const remainingCount = Math.max(0, (member.permissions?.length || 0) - 3);

                        const lastActive = member.user?.lastLogin
                          ? new Date(member.user.lastLogin).toLocaleDateString()
                          : 'Never';

                        return (
                          <TableRow key={member.userId} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                  {initials}
                                </div>
                                <div>
                                  <div className="font-medium">{member.user?.name || 'Unknown User'}</div>
                                  <div className="text-sm text-muted-foreground">{member.user?.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getRoleColor(member.role)}>
                                {roleDisplayNames[member.role] || member.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {visiblePermissions.map((perm: string) => (
                                  <Badge key={perm} variant="outline" className="text-xs">
                                    {perm.replace(/_/g, ' ').slice(0, 15)}
                                  </Badge>
                                ))}
                                {remainingCount > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{remainingCount} more
                                  </Badge>
                                )}
                                {member.permissions?.length === 0 && (
                                  <span className="text-xs text-muted-foreground">No custom permissions</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(member.addedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {lastActive}
                            </TableCell>
                            <TableCell>
                              <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                                {member.status === 'active' ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setEditingMember(member);
                                    setShowPermissionsEditor(true);
                                  }}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Permissions
                                  </DropdownMenuItem>
                                  {member.role !== 'manager' && (
                                    <DropdownMenuItem onClick={() => handleRoleChange(member.userId, 'manager')}>
                                      <Shield className="w-4 h-4 mr-2" />
                                      Make Manager
                                    </DropdownMenuItem>
                                  )}
                                  {member.role !== 'team_member' && (
                                    <DropdownMenuItem onClick={() => handleRoleChange(member.userId, 'team_member')}>
                                      <Shield className="w-4 h-4 mr-2" />
                                      Make Team Member
                                    </DropdownMenuItem>
                                  )}
                                  {member.role !== 'viewer' && (
                                    <DropdownMenuItem onClick={() => handleRoleChange(member.userId, 'viewer')}>
                                      <Shield className="w-4 h-4 mr-2" />
                                      Make Viewer
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={async () => {
                                      if (!confirm(`Are you sure you want to remove ${member.user?.name || member.user?.email}? They will lose access immediately.`)) return;
                                      try {
                                        const res = await fetch(`/api/teams/${storeId}/members/${member.userId}`, {
                                          method: 'DELETE',
                                        });
                                        if (!res.ok) throw new Error('Failed to remove team member');
                                        toast.success('Team member removed successfully');
                                        loadTeamData();
                                        loadSubscriptionInfo();
                                      } catch (error: any) {
                                        toast.error(error.message || 'Failed to remove team member');
                                      }
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations">
          <PendingInvitationsTable
            invitations={invitations}
            onRefresh={() => {
              loadInvitations();
              loadTeamData();
            }}
            storeId={storeId}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityLogViewer storeId={storeId} />
        </TabsContent>
      </Tabs>

      {showInviteModal && (
        <InviteTeamMemberModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInvite}
          subscriptionInfo={subscriptionInfo}
        />
      )}

      {showPermissionsEditor && editingMember && (
        <PermissionsEditor
          open={showPermissionsEditor}
          onClose={() => {
            setShowPermissionsEditor(false);
            setEditingMember(null);
          }}
          member={editingMember}
          onSave={async (permissions: string[]) => {
            try {
              const res = await fetch(`/api/teams/${storeId}/members/${editingMember.userId}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions }),
              });
              if (!res.ok) throw new Error('Failed to update permissions');
              toast.success('Permissions updated successfully');
              setShowPermissionsEditor(false);
              setEditingMember(null);
              loadTeamData();
            } catch (error: any) {
              toast.error(error.message || 'Failed to update permissions');
            }
          }}
        />
      )}
    </div>
  );
}

// Auto-access Team Section: Add email+role -> Pending -> Active on sign-in
function TeamAutoAccessSection() {
  const { currentStore } = useTenant();
  const storeId = currentStore?.id || 'default'; // Fallback to 'default' if no store selected
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState<{ members: any[]; pendingUsers: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('team_member');

  const loadTeam = async () => {
    if (!storeId) {
      setTeam({ members: [], pendingUsers: [] });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log('[Team] Loading team for store:', storeId);
      const res = await fetch(`/api/teams/${storeId}`, { credentials: 'include' });
      
      if (!res.ok) {
        let errorData: any = { error: 'Failed to load team' };
        try {
          const text = await res.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (parseError) {
          console.error('[Team] Failed to parse error response:', parseError);
        }
        
        console.error('[Team] API error:', {
          status: res.status,
          statusText: res.statusText,
          error: errorData,
        });
        
        // Handle specific error cases
        if (res.status === 401) {
          throw new Error('Please sign in to access team management');
        } else if (res.status === 403) {
          throw new Error(errorData.message || errorData.error || 'You do not have permission to access team management for this store');
        } else {
          throw new Error(errorData.message || errorData.error || `Failed to load team: ${res.status} ${res.statusText}`);
        }
      }
      
      const data = await res.json();
      console.log('[Team] Team data loaded:', data);
      setTeam(data.team || { members: [], pendingUsers: [] });
      setError(null); // Clear any previous errors on success
    } catch (error) {
      console.error('[Team] load error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load team data';
      setError(errorMessage);
      toast.error(errorMessage);
      setTeam({ members: [], pendingUsers: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      loadTeam();
    }
  }, [storeId]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${storeId}/add-user`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to add user');
        return;
      }
      toast.success(data.message || 'User added. They’ll be activated on first sign in.');
      setEmail('');
      setRole('team_member');
      loadTeam();
    } catch (error) {
      console.error('[Team] add-user error:', error);
      toast.error('Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userEmail: string) => {
    if (!storeId) return;
    if (!confirm(`Remove ${userEmail} from this store?`)) return;
    try {
      const res = await fetch(`/api/teams/${storeId}/remove-user`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to remove user');
        return;
      }
      toast.success(data.message || 'User removed');
      loadTeam();
    } catch (error) {
      console.error('[Team] remove-user error:', error);
      toast.error('Failed to remove user');
    }
  };

  const members = team?.members || [];
  const pending = team?.pendingUsers || [];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-5 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Team Management</h2>
        <p className="text-sm text-gray-600 mt-1">
          Add users by email. They'll be activated automatically when they sign in.
        </p>
        {storeId === 'default' && (
          <p className="text-xs text-amber-600 mt-2">
            Using default store. Select a store from the dropdown to manage its specific team.
          </p>
        )}
      </div>

      <div className="px-6 py-6 space-y-8">

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={loadTeam}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Add Team Member Form - Enhanced */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Add Team Member</h3>
        <p className="text-sm text-gray-500 mb-6">
          User gains access automatically on first sign in.
        </p>

        <form onSubmit={handleAddUser} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <p className="mt-2 text-xs text-gray-500">
              No invitation email is sent. The user just signs in with this email.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="team_member">Team Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-base font-semibold rounded-lg shadow-lg shadow-orange-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </span>
            ) : (
              'Add User'
            )}
          </button>
        </form>
      </div>

      {/* Active Members Section - Enhanced */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Active Members
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Users who have signed in and are active for this store.
        </p>

        {loading && !team ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No active members yet.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m: any) => {
              const initials = m.email?.split('@')[0]?.substring(0, 2).toUpperCase() || '?';
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{initials}</span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {m.email}
                      </p>
                      <p className="text-sm text-gray-500">
                        Role: <span className="font-medium">{m.role}</span> • 
                        Active since <span className="font-medium">
                          {m.activatedAt ? new Date(m.activatedAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveUser(m.email)}
                    className="px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Users Section - Enhanced */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Pending Users
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          These users will activate when they sign in with the email below.
        </p>

        {loading && !team ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex items-center justify-center p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No pending users.</p>
              <p className="text-xs text-gray-500 mt-1">Add users above to get started</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((u: any) => {
              const initials = u.email?.split('@')[0]?.substring(0, 2).toUpperCase() || '?';
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg hover:border-amber-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{initials}</span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {u.email}
                      </p>
                      <p className="text-sm text-gray-600">
                        Role: <span className="font-medium">{u.role}</span> • 
                        Added <span className="font-medium">{new Date(u.addedAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveUser(u.email)}
                    className="px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  try {
    return (
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }>
        <ErrorBoundary>
          <SettingsContent />
        </ErrorBoundary>
      </Suspense>
    );
  } catch (error) {
    console.error('[Settings Page] Fatal error:', error);
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-900 mb-2">Settings Page Error</h2>
          <p className="text-sm text-red-700 mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Settings Page] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold text-red-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-red-700 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
