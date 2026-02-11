"use client";

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { JourneyUserSummary } from '@/lib/types/analytics';
import { formatDate } from './utils';

interface UserExplorerTabProps {
  users: JourneyUserSummary[];
}

export function UserExplorerTab({ users }: UserExplorerTabProps) {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return users;
    const term = search.trim().toLowerCase();
    return users.filter(user => {
      return (
        user.customerId.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.enrollmentId.toLowerCase().includes(term)
      );
    });
  }, [users, search]);

  const selected = filtered.find(user => user.enrollmentId === selectedUserId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Journey Users</h3>
          <p className="text-sm text-slate-500">Search and inspect individual journeys</p>
        </div>
        <Input
          placeholder="Search by customer ID, email, or enrollment ID"
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="w-full max-w-sm rounded-full border-slate-200"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Entered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(user => (
                  <TableRow
                    key={user.enrollmentId}
                    className={user.enrollmentId === selectedUserId ? 'bg-slate-50' : undefined}
                    onClick={() => setSelectedUserId(user.enrollmentId)}
                  >
                    <TableCell className="font-medium text-slate-900">{user.customerId}</TableCell>
                    <TableCell className="text-slate-600">{user.email ?? '—'}</TableCell>
                    <TableCell className="capitalize text-slate-600">{user.status}</TableCell>
                    <TableCell className="text-slate-600">{user.goalAchieved ? 'Achieved' : 'Pending'}</TableCell>
                    <TableCell className="text-slate-600">{formatDate(user.enteredAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-base font-semibold text-slate-900">User Details</h4>
          {!selected ? (
            <p className="text-sm text-slate-500">Select a user from the table to view enrollment details.</p>
          ) : (
            <div className="space-y-3 text-sm text-slate-600">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Customer</p>
                <p className="font-semibold text-slate-900">{selected.customerId}</p>
                <p>{selected.email || 'No email on record'}</p>
                {selected.phone ? <p>{selected.phone}</p> : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Enrollment</p>
                <p className="font-semibold text-slate-900">{selected.enrollmentId}</p>
                <p>Status: <span className="capitalize">{selected.status}</span></p>
                <p>Goal achieved: {selected.goalAchieved ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Timeline</p>
                <p>Entered: {formatDate(selected.enteredAt)}</p>
                <p>Last activity: {formatDate(selected.lastActivityAt)}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}


