"use client"

import { useMemo, useState } from 'react'

export type Column<T> = {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  searchKeys,
  placeholder = 'Search...'
}: {
  columns: Column<T>[]
  rows: T[]
  searchKeys?: (keyof T | string)[]
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let r = rows
    if (q) {
      r = rows.filter((row) => {
        const keys = searchKeys && searchKeys.length > 0 ? searchKeys : Object.keys(row)
        return keys.some((k) => String(row[k as keyof T] ?? '').toLowerCase().includes(q))
      })
    }
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey as keyof T]
        const bv = b[sortKey as keyof T]
        const an = typeof av === 'number' ? av : Number(av) || 0
        const bn = typeof bv === 'number' ? bv : Number(bv) || 0
        return sortDir === 'asc' ? an - bn : bn - an
      })
    }
    return r
  }, [rows, query, sortKey, sortDir, searchKeys])

  const onSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded px-3 py-2 text-sm"
      />
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {columns.map((c) => (
                <th key={String(c.key)} className="p-2 border text-left">
                  <button className="font-medium" onClick={() => onSort(String(c.key))}>{c.label}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={String(c.key)} className="p-2 border">
                    {c.render ? c.render(row) : String(row[c.key as keyof T] ?? '')}
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
