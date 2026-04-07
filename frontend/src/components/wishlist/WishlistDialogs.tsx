'use client'

import { useTranslations } from 'next-intl'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// --- Create Dialog ---

interface CreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => Promise<void>
}

export function CreateWishlistDialog({ open, onOpenChange, onCreate }: CreateDialogProps) {
  const t = useTranslations('wishlist')
  const [name, setName] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    await onCreate(name.trim())
    setName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createDescription')}</DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
          className="mt-2"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>{t('create')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Rename Dialog ---

interface RenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onRename: (name: string) => Promise<void>
}

export function RenameWishlistDialog({ open, onOpenChange, currentName, onRename }: RenameDialogProps) {
  const t = useTranslations('wishlist')
  const [name, setName] = useState(currentName)

  // Sync when dialog opens with new name
  const handleOpenChange = (o: boolean) => {
    if (o) setName(currentName)
    onOpenChange(o)
  }

  const handleRename = async () => {
    if (!name.trim()) return
    await onRename(name.trim())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('renameTitle')}</DialogTitle>
          <DialogDescription>{t('renameDescription')}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label htmlFor="wl-rename">{t('name')}</Label>
          <Input
            id="wl-rename"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('renamePlaceholder')}
            className="mt-1"
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={handleRename} disabled={!name.trim()}>{t('rename')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Share Dialog ---

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shareUrl: string
}

export function ShareWishlistDialog({ open, onOpenChange, shareUrl }: ShareDialogProps) {
  const t = useTranslations('wishlist')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shareTitle')}</DialogTitle>
          <DialogDescription>{t('shareDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 mt-2">
          <Input value={shareUrl} readOnly className="flex-1" onClick={(e) => e.currentTarget.select()} />
          <Button onClick={copy} variant="outline">
            {copied ? <><Check className="h-4 w-4 mr-1" />{t('copied')}</> : <><Copy className="h-4 w-4 mr-1" />{t('copy')}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
