'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollText, User, Bot, Settings, Webhook } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { adminFetch } from '@/lib/admin-api'

interface AuditLog {
  id: string
  actor_type: 'admin' | 'ai_agent' | 'system' | 'webhook'
  actor_id: string
  action: string
  resource_type: string
  resource_id: string | null
  changes: Record<string, any>
  metadata: Record<string, any>
  created_at: string
}

const actorIcons = {
  admin: User,
  ai_agent: Bot,
  system: Settings,
  webhook: Webhook,
}

const actorColors = {
  admin: 'bg-primary/10 text-primary',
  ai_agent: 'bg-primary/10 text-primary dark:text-primary',
  system: 'bg-muted text-muted-foreground',
  webhook: 'bg-success/10 text-success',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actorFilter, setActorFilter] = useState<string>('all')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchLogs()
  }, [actorFilter])

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        actor_type: actorFilter,
        limit: '100',
      })
      const res = await adminFetch(`/api/audit?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotal(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <span>Audit Log</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            {total} {total === 1 ? 'entry' : 'entries'} recorded
          </p>
        </div>

        {/* Filter */}
        <Select value={actorFilter} onValueChange={setActorFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by actor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actors</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="ai_agent">AI Agent</SelectItem>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit Log Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {actorFilter !== 'all'
                  ? 'Try changing the filter'
                  : 'Activity will appear here when actions are performed'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const Icon = actorIcons[log.actor_type]
                const colorClass = actorColors[log.actor_type]

                return (
                  <div
                    key={log.id}
                    className="flex gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    {/* Icon */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      {/* Header */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={colorClass}>
                              {log.actor_type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {log.actor_id}
                            </span>
                          </div>
                          <p className="font-medium">{log.action}</p>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>

                      {/* Resource */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Resource:
                        </span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {log.resource_type}
                        </code>
                        {log.resource_id && (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {log.resource_id.substring(0, 8)}...
                          </code>
                        )}
                      </div>

                      {/* Changes (if any) */}
                      {log.changes &&
                        Object.keys(log.changes).length > 0 &&
                        (log.changes.before || log.changes.after) && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View changes
                            </summary>
                            <div className="mt-2 grid gap-2 rounded border border-border p-3 md:grid-cols-2">
                              {log.changes.before && (
                                <div>
                                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                                    Before:
                                  </p>
                                  <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                                    {JSON.stringify(
                                      log.changes.before,
                                      null,
                                      2
                                    )}
                                  </pre>
                                </div>
                              )}
                              {log.changes.after && (
                                <div>
                                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                                    After:
                                  </p>
                                  <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                                    {JSON.stringify(log.changes.after, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
                        )}

                      {/* Metadata (if any) */}
                      {log.metadata &&
                        Object.keys(log.metadata).length > 0 && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View metadata
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded border border-border bg-muted p-3 text-xs">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
