"use client"

function Entry({ k, v }: { k: string, v: any }) {
  if (v == null) return (
    <div className="flex gap-2"><div className="w-56 text-muted-foreground">{k}</div><div className="flex-1">N/A</div></div>
  )
  if (Array.isArray(v)) return (
    <div className="mb-3">
      <div className="font-medium mb-1">{k} ({v.length})</div>
      <div className="space-y-2">
        {v.map((item, i) => (
          <div key={i} className="rounded border p-2 bg-gray-50">
            <DetailObject data={item} />
          </div>
        ))}
      </div>
    </div>
  )
  if (typeof v === 'object') return (
    <div className="mb-3">
      <div className="font-medium mb-1">{k}</div>
      <div className="rounded border p-2 bg-gray-50">
        <DetailObject data={v} />
      </div>
    </div>
  )
  return (
    <div className="flex gap-2"><div className="w-56 text-muted-foreground">{k}</div><div className="flex-1 break-all">{String(v)}</div></div>
  )
}

export function DetailObject({ data }: { data: any }) {
  if (!data || typeof data !== 'object') return <div>N/A</div>
  const entries = Object.entries(data)
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => <Entry key={k} k={k} v={v} />)}
    </div>
  )
}

export default function DetailView({ data, title }: { data: any, title?: string }) {
  return (
    <div className="space-y-3">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <DetailObject data={data} />
    </div>
  )
}
