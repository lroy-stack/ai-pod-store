'use client'

/**
 * ChatHistoryCard — Single conversation card in history view
 *
 * Features:
 * - Title + message count + relative date
 * - Active state with primary border
 * - Delete with confirmation
 * - Touch-friendly (min 44px height)
 */

import { useState } from 'react'
import { Trash2, Loader2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChatHistoryCardProps {
  id: string
  title: string
  messageCount: number
  date: string
  isActive: boolean
  onSelect: () => void
  onDelete: () => Promise<void>
}

export function ChatHistoryCard({
  id,
  title,
  messageCount,
  date,
  isActive,
  onSelect,
  onDelete,
}: ChatHistoryCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirmDelete) {
      setConfirmDelete(true)
      // Auto-reset after 3s if not confirmed
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    // Confirmed — execute delete
    setDeleting(true)
    onDelete().finally(() => {
      setDeleting(false)
      setConfirmDelete(false)
    })
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all',
        'border border-transparent',
        isActive
          ? 'bg-primary/8 border-primary/20'
          : 'hover:bg-muted/50'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5',
        isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
      )}>
        <MessageCircle className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-sm font-medium truncate',
            isActive ? 'text-primary' : 'text-foreground'
          )}>
            {title || 'Untitled'}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {date}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {messageCount} message{messageCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7 shrink-0 mt-0.5 transition-all',
          confirmDelete
            ? 'opacity-100 text-destructive hover:bg-destructive/10'
            : 'opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-destructive'
        )}
        onClick={handleDeleteClick}
        aria-label={confirmDelete ? 'Confirm delete' : 'Delete'}
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </button>
  )
}
