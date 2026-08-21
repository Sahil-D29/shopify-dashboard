'use client';

import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface Contact {
  id: string;
  phone: string;
  name?: string | null;
  firstName: string;
  lastName: string;
  email?: string;
  tags: string[];
  source: string;
  optInStatus: 'OPTED_IN' | 'OPTED_OUT' | 'PENDING';
  lastMessageAt?: string | null;
  createdAt: string;
}

/** Hide synthetic alias keys (email:/nitro:) from the Phone column. */
function realPhone(phone?: string | null): string | null {
  if (!phone || phone.startsWith('email:') || phone.startsWith('nitro:')) return null;
  return phone;
}

interface ContactsTableProps {
  contacts: Contact[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onSort?: (field: string) => void;
}

const sourceColors: Record<string, string> = {
  SHOPIFY: 'bg-green-50 text-green-700 border-green-200',
  CSV: 'bg-purple-50 text-purple-700 border-purple-200',
  MANUAL: 'bg-gray-50 text-gray-700 border-gray-200',
  WHATSAPP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const optInColors: Record<string, string> = {
  OPTED_IN: 'bg-green-50 text-green-700 border-green-200',
  OPTED_OUT: 'bg-red-50 text-red-700 border-red-200',
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const optInLabels: Record<string, string> = {
  OPTED_IN: 'Opted In',
  OPTED_OUT: 'Opted Out',
  PENDING: 'Pending',
};

export default function ContactsTable({
  contacts,
  selectedIds,
  onSelect,
  onSelectAll,
  onSort,
}: ContactsTableProps) {
  const router = useRouter();

  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < contacts.length;

  const handleRowClick = (id: string) => {
    router.push(`/contacts/${id}`);
  };

  return (
    <>
      <div className="space-y-3 p-3 md:hidden">
        <button
          type="button"
          onClick={onSelectAll}
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-700"
        >
          <span>{allSelected ? 'Clear page selection' : 'Select all on this page'}</span>
          <Checkbox checked={allSelected} />
        </button>
        {contacts.map(contact => {
          const displayName =
            [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Unknown';
          const phoneDisplay = realPhone(contact.phone);
          const isSelected = selectedIds.has(contact.id);

          return (
            <div
              key={contact.id}
              role="button"
              tabIndex={0}
              onClick={() => handleRowClick(contact.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') handleRowClick(contact.id);
              }}
              className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div onClick={event => event.stopPropagation()} className="pt-0.5">
                  <Checkbox checked={isSelected} onCheckedChange={() => onSelect(contact.id)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-gray-900">{displayName}</p>
                      <p className="break-anywhere mt-0.5 text-xs text-gray-500">
                        {phoneDisplay || contact.email || '—'}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 text-xs', optInColors[contact.optInStatus])}>
                      {optInLabels[contact.optInStatus]}
                    </Badge>
                  </div>
                  {contact.email && phoneDisplay ? (
                    <p className="break-anywhere mt-2 text-xs text-gray-600">{contact.email}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={cn('text-xs', sourceColors[contact.source])}>
                      {contact.source}
                    </Badge>
                    {contact.tags.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="outline" className="max-w-full truncate bg-blue-50 text-xs text-blue-700">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-400">
                    Added {format(new Date(contact.createdAt), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  (el as unknown as HTMLInputElement).indeterminate = someSelected;
                }
              }}
              onCheckedChange={() => onSelectAll()}
            />
          </TableHead>
          <TableHead
            className="cursor-pointer hover:text-gray-900"
            onClick={() => onSort?.('name')}
          >
            Name / Phone
          </TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead
            className="cursor-pointer hover:text-gray-900"
            onClick={() => onSort?.('source')}
          >
            Source
          </TableHead>
          <TableHead>Opt-in</TableHead>
          <TableHead
            className="cursor-pointer hover:text-gray-900"
            onClick={() => onSort?.('lastMessageAt')}
          >
            Last Message
          </TableHead>
          <TableHead
            className="cursor-pointer hover:text-gray-900"
            onClick={() => onSort?.('createdAt')}
          >
            Created
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map(contact => {
          const displayName =
            [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Unknown';
          const phoneDisplay = realPhone(contact.phone);
          const isSelected = selectedIds.has(contact.id);

          return (
            <TableRow
              key={contact.id}
              data-state={isSelected ? 'selected' : undefined}
              className="cursor-pointer"
            >
              <TableCell onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect(contact.id)}
                />
              </TableCell>
              <TableCell
                className="font-medium"
                onClick={() => handleRowClick(contact.id)}
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">{displayName}</div>
                  <div className="text-xs text-gray-500">{phoneDisplay || contact.email || '—'}</div>
                </div>
              </TableCell>
              <TableCell
                className="text-sm text-gray-600"
                onClick={() => handleRowClick(contact.id)}
              >
                {contact.email || '--'}
              </TableCell>
              <TableCell onClick={() => handleRowClick(contact.id)}>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {contact.tags.slice(0, 3).map(tag => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {contact.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{contact.tags.length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell onClick={() => handleRowClick(contact.id)}>
                <Badge
                  variant="outline"
                  className={cn('text-xs', sourceColors[contact.source])}
                >
                  {contact.source}
                </Badge>
              </TableCell>
              <TableCell onClick={() => handleRowClick(contact.id)}>
                <Badge
                  variant="outline"
                  className={cn('text-xs', optInColors[contact.optInStatus])}
                >
                  {optInLabels[contact.optInStatus]}
                </Badge>
              </TableCell>
              <TableCell
                className="text-sm text-gray-500"
                onClick={() => handleRowClick(contact.id)}
              >
                {contact.lastMessageAt
                  ? format(new Date(contact.lastMessageAt), 'MMM dd, HH:mm')
                  : '--'}
              </TableCell>
              <TableCell
                className="text-sm text-gray-500"
                onClick={() => handleRowClick(contact.id)}
              >
                {format(new Date(contact.createdAt), 'MMM dd, yyyy')}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
      </Table>
      </div>
    </>
  );
}
