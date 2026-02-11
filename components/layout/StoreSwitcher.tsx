'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/tenant/tenant-context';
import { Store, ChevronDown, Check, Loader2, Plus } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export function StoreSwitcher() {
  try {
    const { currentStore, stores, switchStore, isLoading } = useTenant();
    const [switching, setSwitching] = useState(false);

    const handleSwitchStore = async (storeId: string) => {
      if (storeId === currentStore?.id) return;

      setSwitching(true);
      try {
        await switchStore(storeId);
        toast.success('Store switched successfully');
      } catch (error) {
        console.error('Error switching store:', error);
        toast.error('Failed to switch store');
      } finally {
        setSwitching(false);
      }
    };

    // Show loading state
    if (isLoading) {
      return (
        <Button 
          variant="outline" 
          disabled 
          className="
            gap-2 
            w-full
            justify-between
            bg-gradient-to-r from-blue-600/10 to-purple-600/10
            border-blue-500/20
            text-white/70
            shadow-md
          "
        >
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Loading...</span>
          </div>
        </Button>
      );
    }

    // If no stores available, show message
    if (stores.length === 0) {
      return (
        <Button 
          variant="outline" 
          disabled 
          className="
            gap-2 
            w-full
            justify-between
            bg-gradient-to-r from-gray-700/20 to-gray-700/20
            border-gray-600/30
            text-white/60
            shadow-md
          "
        >
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span className="text-sm font-medium">No stores</span>
          </div>
        </Button>
      );
    }

    // If no current store but stores exist, use first one
    const activeStore = currentStore || stores.find(s => s.status === 'active') || stores[0];

    const activeStores = stores.filter(s => s.status === 'active');
    const inactiveStores = stores.filter(s => s.status !== 'active');

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="
              gap-2 
              min-w-[180px] 
              w-full
              justify-between
              bg-gradient-to-r from-blue-600/20 to-purple-600/20
              hover:from-blue-600/30 hover:to-purple-600/30
              border-blue-500/30 hover:border-blue-500/50
              text-white
              font-medium
              shadow-lg shadow-blue-500/10
              hover:shadow-xl hover:shadow-blue-500/20
              transition-all duration-200
              group
            "
            disabled={switching}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-1 bg-blue-500/20 rounded-md group-hover:bg-blue-500/30 transition-colors flex-shrink-0">
                <Store className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-xs text-blue-200 font-normal leading-none">Current Store</span>
                <span className="truncate font-semibold text-sm leading-tight">{activeStore?.name || 'Select Store'}</span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0 group-hover:translate-y-0.5 transition-transform" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuLabel>Switch Store</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {activeStores.length > 0 && (
            <>
              {activeStores.map((store) => (
                <DropdownMenuItem
                  key={store.id}
                  onClick={() => handleSwitchStore(store.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={cn(
                      "h-2 w-2 rounded-full flex-shrink-0",
                      store.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{store.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {store.shopDomain}
                      </div>
                    </div>
                  </div>
                  {store.id === activeStore?.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {inactiveStores.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Inactive Stores
              </DropdownMenuLabel>
              {inactiveStores.map((store) => (
                <DropdownMenuItem
                  key={store.id}
                  disabled
                  className="flex items-center gap-2 opacity-60"
                >
                  <div className="h-2 w-2 rounded-full bg-gray-400" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{store.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {store.shopDomain} ({store.status})
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/stores/new"
              className="flex items-center gap-2 cursor-pointer text-primary"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Store</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } catch (error) {
    // Fallback if TenantProvider is not available
    console.error('StoreSwitcher error:', error);
    return (
      <Button 
        variant="outline" 
        disabled 
        className="
          gap-2 
          w-full
          justify-between
          bg-gradient-to-r from-gray-700/20 to-gray-700/20
          border-gray-600/30
          text-white/60
          shadow-md
        "
      >
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4" />
          <span className="text-sm font-medium">Store</span>
        </div>
      </Button>
    );
  }
}

