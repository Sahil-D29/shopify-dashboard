"use client"

import { useMemo, useState } from 'react'

function isObject(v: any) { return typeof v === 'object' && v !== null && !Array.isArray(v) }
function isDateKey(k: string) { return k.endsWith('_at') || k.includes('date') }
function isCurrencyKey(k: string) { return /(price|total|amount|revenue|subtotal|tax|discount)/i.test(k) }

function formatValue(key: string, value: any) {
  if (value == null) return 'N/A'
  if (typeof value === 'boolean') return value ? '✓ Yes' : '✗ No'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string') {
    if (isDateKey(key)) {
      const d = new Date(value)
      return isNaN(d.getTime()) ? value : d.toLocaleDateString()
    }
    return value
  }
  if (Array.isArray(value)) return `${value.length} items`
  if (isObject(value)) return '[Object]'
  return String(value)
}

export function DataTable({ data, resource, onRowClick }: { data: any[], resource?: string, onRowClick?: (row: any) => void }) {
  const [query, setQuery] = useState('')
  const keys = useMemo(() => {
    const first = data[0] || {}
    return Object.keys(first)
  }, [data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter((row) => JSON.stringify(row).toLowerCase().includes(q))
  }, [data, query])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${resource || ''}...`} className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {keys.map((k) => (
                <th key={k} className="p-2 border text-left whitespace-nowrap">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 cursor-pointer" onClick={() => onRowClick?.(row)}>
                {keys.map((k) => (
                  <td key={k} className="p-2 border align-top max-w-[360px]">
                    {formatValue(k, row[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
