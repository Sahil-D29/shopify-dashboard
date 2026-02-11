"use client"

import { useState } from 'react'

export function ExpandableRow({
  summary,
  details,
}: {
  summary: React.ReactNode
  details: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className={open ? 'bg-gray-50' : ''} onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
        {summary}
      </tr>
      {open && (
        <tr>
          <td colSpan={999}>
            <div className="p-4 border-t bg-white">{details}</div>
          </td>
        </tr>
      )}
    </>
  )
}
