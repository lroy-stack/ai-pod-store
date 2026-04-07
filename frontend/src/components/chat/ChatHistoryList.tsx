'use client'

/**
 * ChatHistoryList — Conversation history as cards with temporal grouping
 *
 * Features:
 * - Cards with title, message count, relative date
 * - Grouped: Today, Yesterday, This week, Older
 * - Delete with double-click confirmation (3s timeout)
 * - Active conversation highlighted
 * - New Chat CTA at top
 */

import { useEffect, useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Plus, Loader2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-fetch'
import { ChatHistoryCard } from './ChatHistoryCard'

interface Conversation {
  id: string
  title: string
  messageCount: number
  updatedAt: string
}

interface ChatHistoryListProps {
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  onDeleteConversation: (id: string) => void
}

type TimeGroup = 'today' | 'yesterday' | 'thisWeek' | 'older'

function getTimeGroup(dateStr: string): TimeGroup {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0 && date.getDate() === now.getDate()) return 'today'
  if (diffDays <= 1) return 'yesterday'
  if (diffDays <= 7) return 'thisWeek'
  return 'older'
}

function formatRelativeDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return locale === 'de' ? 'gerade eben' : locale === 'es' ? 'ahora mismo' : 'just now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

const GROUP_LABELS: Record<string, Record<TimeGroup, string>> = {
  en: { today: 'Today', yesterday: 'Yesterday', thisWeek: 'This week', older: 'Older' },
  es: { today: 'Hoy', yesterday: 'Ayer', thisWeek: 'Esta semana', older: 'Anteriores' },
  de: { today: 'Heute', yesterday: 'Gestern', thisWeek: 'Diese Woche', older: 'Älter' },
}

export function ChatHistoryList({
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
}: ChatHistoryListProps) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiFetch('/api/conversations', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch { /* non-critical */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  useEffect(() => {
    if (activeConversationId) fetchConversations()
  }, [activeConversationId, fetchConversations])

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id))
        onDeleteConversation(id)
      }
    } catch { /* non-critical */ }
  }, [onDeleteConversation])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Group conversations by time
  const groups = new Map<TimeGroup, Conversation[]>()
  for (const conv of conversations) {
    const group = getTimeGroup(conv.updatedAt)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(conv)
  }

  const labels = GROUP_LABELS[locale] || GROUP_LABELS.en
  const groupOrder: TimeGroup[] = ['today', 'yesterday', 'thisWeek', 'older']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('chatHistory')}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('newChat')}
        </Button>
      </div>

      {/* Empty state */}
      {conversations.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('noHistory')}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={onNewChat}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('newChat')}
          </Button>
        </div>
      ) : (
        /* Grouped conversation cards */
        groupOrder.map(group => {
          const items = groups.get(group)
          if (!items || items.length === 0) return null
          return (
            <div key={group}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {labels[group]}
              </h3>
              <div className="space-y-1">
                {items.map(conv => (
                  <ChatHistoryCard
                    key={conv.id}
                    id={conv.id}
                    title={conv.title}
                    messageCount={conv.messageCount}
                    date={formatRelativeDate(conv.updatedAt, locale)}
                    isActive={activeConversationId === conv.id}
                    onSelect={() => onSelectConversation(conv.id)}
                    onDelete={() => handleDelete(conv.id)}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
