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
  firstName: string;
  lastName: string;
  email?: string;
  tags: string[];
  source: 'SHOPIFY' | 'CSV' | 'MANUAL' | 'WHATSAPP';
  optInStatus: 'OPTED_IN' | 'OPTED_OUT' | 'PENDING';
  lastMessageAt?: string | null;
  createdAt: string;
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
          const displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown';
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
                  <div className="text-xs text-gray-500">{contact.phone}</div>
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
  );
}
