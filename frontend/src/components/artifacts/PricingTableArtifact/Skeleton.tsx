import { Card, CardHeader, CardContent } from '@/components/ui/card'

export function PricingTableSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-6 w-56 animate-pulse rounded bg-muted" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"
            >
              <div className="flex flex-col gap-2 flex-1">
                <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
