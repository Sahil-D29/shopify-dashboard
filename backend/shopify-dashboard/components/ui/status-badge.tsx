import { Badge } from '@/components/ui/badge'

type StatusKind = 'financial' | 'fulfillment' | 'boolean' | 'info'

export function StatusBadge({ value, kind = 'info' }: { value?: string | boolean | null, kind?: StatusKind }) {
  if (kind === 'boolean') {
    const ok = Boolean(value)
    return (
      <Badge className={ok ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}>
        {ok ? 'Yes' : 'No'}
      </Badge>
    )
  }

  const v = String(value || '').toLowerCase()
  const map: Record<string, string> = {
    paid: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    refunded: 'bg-red-100 text-red-800 border-red-200',
    partially_refunded: 'bg-orange-100 text-orange-800 border-orange-200',
    fulfilled: 'bg-blue-100 text-blue-800 border-blue-200',
    partial: 'bg-orange-100 text-orange-800 border-orange-200',
    unfulfilled: 'bg-gray-100 text-gray-800 border-gray-200',
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    active: 'bg-green-100 text-green-800 border-green-200',
    archived: 'bg-gray-100 text-gray-800 border-gray-200',
  }
  const cls = map[v] || 'bg-gray-100 text-gray-800 border-gray-200'

  return <Badge className={cls}>{String(value || '—')}</Badge>
}
