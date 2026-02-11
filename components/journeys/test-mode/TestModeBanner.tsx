"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TestModeBannerProps {
  onManageTestUsers?: () => void;
  onExitTestMode?: () => void;
  className?: string;
}

export function TestModeBanner({ onManageTestUsers, onExitTestMode, className }: TestModeBannerProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-700 px-4 py-3 text-white shadow-md",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className="text-lg">🧪</span>
        <div>
          <p className="font-semibold">Test Mode Active</p>
          <p className="text-xs text-indigo-100">Messages will only send to test users. Use this mode to validate your flow.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onManageTestUsers} className="bg-indigo-600 text-white hover:bg-indigo-500">
          Manage Test Users
        </Button>
        <Button variant="outline" size="sm" onClick={onExitTestMode} className="border-indigo-200 text-white hover:bg-indigo-600/30">
          Exit Test Mode
        </Button>
      </div>
    </div>
  );
}



