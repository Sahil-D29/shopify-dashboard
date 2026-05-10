"use client";

import { useMemo, useState } from "react";
import { Upload, UserMinus, Users, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TestUser } from "@/lib/types/test-mode";
import { cn } from "@/lib/utils";

interface TestUserPanelProps {
  open: boolean;
  onClose: () => void;
  testUsers: TestUser[];
  onAddUser: (user: Omit<TestUser, "id" | "addedAt">) => Promise<boolean>;
  onRemoveUser: (userId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onImportCsv?: () => void;
}

export function TestUserPanel({
  open,
  onClose,
  testUsers,
  onAddUser,
  onRemoveUser,
  onClearAll,
  onImportCsv,
}: TestUserPanelProps) {
  const [formState, setFormState] = useState({ phone: "", email: "", name: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testUserCount = testUsers.length;
  const sortedUsers = useMemo(
    () => [...testUsers].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()),
    [testUsers],
  );

  const handleSubmit = async () => {
    setError(null);
    if (!formState.phone && !formState.email) {
      setError("Provide at least a phone number or email.");
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await onAddUser({
        phone: formState.phone,
        email: formState.email || undefined,
        name: formState.name || undefined,
      });
      if (!success) {
        setError("Unable to add test user. Check details and try again.");
        return;
      }
      setFormState({ phone: "", email: "", name: "" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    await onRemoveUser(id);
  };

  const handleClearAll = async () => {
    if (testUsers.length === 0) return;
    if (typeof window !== "undefined" && !window.confirm("Remove all test users? This cannot be undone.")) {
      return;
    }
    await onClearAll();
  };

  return (
    <Sheet open={open} onOpenChange={value => (value ? undefined : onClose())}>
      <SheetContent className="flex w-full max-w-xl flex-col gap-4">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg text-[#0F172A]">
            <Users className="h-5 w-5 text-indigo-600" />
            Manage Test Users
          </SheetTitle>
          <p className="text-sm text-[#475569]">Add internal contacts to safely test the journey before activation.</p>
        </SheetHeader>

        <div className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Test users</p>
              <p className="text-xs text-[#64748B]">Only these users receive messages while Test Mode is active.</p>
            </div>
            <Badge className="ml-auto bg-indigo-100 text-indigo-700">{testUserCount}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Phone (E.164)</Label>
              <Input
                placeholder="+15555555555"
                value={formState.phone}
                onChange={event => setFormState(prev => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Email</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={formState.email}
                onChange={event => setFormState(prev => ({ ...prev, email: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Name (optional)</Label>
            <Input
              placeholder="Full name"
              value={formState.name}
              onChange={event => setFormState(prev => ({ ...prev, name: event.target.value }))}
            />
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-indigo-600 text-white hover:bg-indigo-500">
              Add test user
            </Button>
            <Button variant="outline" onClick={handleClearAll} disabled={testUsers.length === 0} className="gap-1 text-red-600">
              <XCircle className="h-4 w-4" />
              Clear all
            </Button>
            <Button variant="secondary" onClick={onImportCsv} className="gap-1">
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          <Table>
            <TableHeader className="sticky top-0 bg-[#F1F5F9] text-xs uppercase tracking-[0.2em] text-[#475569]">
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-[#64748B]">
                    No test users yet. Add at least one to send test messages.
                  </TableCell>
                </TableRow>
              ) : (
                sortedUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="text-sm text-[#1E293B]">
                      <div className="flex flex-col">
                        {user.phone ? <span>{user.phone}</span> : null}
                        {user.email ? <span className="text-xs text-[#64748B]">{user.email}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#1E293B]">{user.name || "—"}</TableCell>
                    <TableCell className="text-xs text-[#475569]">
                      {new Date(user.addedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(user.id)}
                        className="text-red-500 hover:text-red-600"
                        aria-label="Remove test user"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}



