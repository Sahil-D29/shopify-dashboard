import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function compute(data: any[], metric: string, operation: 'sum'|'count'|'avg') {
  if (operation === 'count') return data.length
  const nums = data.map((d) => Number(d[metric] || 0))
  if (operation === 'sum') return nums.reduce((a, b) => a + b, 0)
  if (operation === 'avg') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  return 0
}

export default function StatCard({ data, metric, operation, label, format }: {
  data: any[]
  metric: string
  operation: 'sum'|'count'|'avg'
  label: string
  format?: 'currency'|'number'
}) {
  let value = compute(data, metric, operation)
  let display = String(value)
  if (format === 'currency') display = `₹${Math.round(value).toLocaleString('en-IN')}`
  else if (format === 'number') display = value.toLocaleString('en-IN')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{display}</div>
      </CardContent>
    </Card>
  )
}
