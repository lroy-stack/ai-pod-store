'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Trash2, Share2, ShoppingCart, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface WishlistActionsProps {
  wishlistId: string
  itemCount: number
  onRename: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onShare: (id: string) => Promise<void>
  onAddAllToCart: () => Promise<void>
}

export function WishlistActions({ wishlistId, itemCount, onRename, onDelete, onShare, onAddAllToCart }: WishlistActionsProps) {
  const t = useTranslations('wishlist')
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try { await onDelete(wishlistId) } finally { setDeleting(false) }
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRename(wishlistId)}>
        <Pencil className="size-3.5" />
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={deleting}>
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteWishlistTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteWishlistDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('deleteWishlistConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onShare(wishlistId)}>
        <Share2 className="size-3.5" />
      </Button>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAddAllToCart} disabled={itemCount === 0}>
        <ShoppingCart className="size-3.5" />
      </Button>
    </div>
  )
}
