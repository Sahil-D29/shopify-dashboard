"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

interface PreviewAndTestButtonProps {
  disabled?: boolean;
  onClick: () => void;
  sending?: boolean;
  helperText?: string;
  errorMessage?: string | null;
}

export function PreviewAndTestButton({
  disabled,
  onClick,
  sending,
  helperText,
  errorMessage,
}: PreviewAndTestButtonProps) {
  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={disabled || sending}
        onClick={onClick}
        className="w-full bg-[#D4A574] text-white hover:bg-[#B8835D]"
      >
        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Preview &amp; Test
      </Button>
      {helperText ? <p className="text-xs text-[#8B7F76]">{helperText}</p> : null}
      {errorMessage ? (
        <p className="flex items-center gap-1 text-xs text-[#C05621]">
          <AlertCircle className="h-3.5 w-3.5" />
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}


