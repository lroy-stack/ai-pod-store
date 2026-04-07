'use client'

import { Badge } from '@/components/ui/badge'
import { ProductCard } from '@/components/products/ProductCard'
import { WishlistActions } from './WishlistActions'
import type { WishlistItem } from './types'

interface WishlistSectionProps {
  id: string
  name: string
  isPublic: boolean
  items: WishlistItem[]
  onRename: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onShare: (id: string) => Promise<void>
  onAddAllToCart: (items: WishlistItem[]) => Promise<void>
  /** Hide actions for shared/read-only views */
  readOnly?: boolean
  emptyMessage?: string
}

export function WishlistSection({
  id, name, isPublic, items,
  onRename, onDelete, onShare, onAddAllToCart,
  readOnly = false,
  emptyMessage = 'No items yet',
}: WishlistSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">{name}</h2>
          {isPublic && <Badge variant="outline" className="text-[10px] shrink-0">Public</Badge>}
          <span className="text-xs text-muted-foreground shrink-0">{items.length}</span>
        </div>
        {!readOnly && (
          <WishlistActions
            wishlistId={id}
            itemCount={items.length}
            onRename={onRename}
            onDelete={onDelete}
            onShare={onShare}
            onAddAllToCart={() => onAddAllToCart(items)}
          />
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <ProductCard key={item.id} product={item.products} />
          ))}
        </div>
      )}
    </section>
  )
}
