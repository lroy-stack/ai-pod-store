'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { adminFetch } from '@/lib/admin-api'
import { ImageIcon } from 'lucide-react'

interface MockupBadgeProps {
  productId: string
}

export function MockupBadge({ productId }: MockupBadgeProps) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await adminFetch(`/api/products/${productId}/mockup-status`)
        if (res.ok) {
          const data = await res.json()
          setCount(data.mockup_count ?? 0)
        }
      } catch {
        // silent
      }
    }
    fetch()
  }, [productId])

  if (count === null) return null

  return (
    <Badge
      variant={count > 0 ? 'default' : 'destructive'}
      className="gap-1 text-xs"
    >
      <ImageIcon className="h-3 w-3" />
      {count > 0 ? `${count} mockup${count !== 1 ? 's' : ''}` : 'No mockups'}
    </Badge>
  )
}
