'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface AgentSession {
  id: string
  session_number: number
  session_type: string
  status: 'running' | 'completed' | 'error'
  started_at: string
  ended_at: string | null
  features_before: number
  features_after: number
  tool_calls: number
  tool_errors: number
}

interface AgentEvent {
  id: number
  session_id: string
  event_type: string
  data: Record<string, any>
  created_at: string
}

const statusIcons = {
  running: Clock,
  completed: CheckCircle,
  error: XCircle,
}

const statusColors = {
  running: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  completed: 'bg-success/10 text-success',
  error: 'bg-destructive/10 text-destructive',
}

const eventTypeColors: Record<string, string> = {
  session_start: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  session_end: 'bg-success/10 text-success',
  tool_call: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  tool_result: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  error: 'bg-destructive/10 text-destructive',
  feature_pass: 'bg-success/10 text-success',
  feature_fail: 'bg-destructive/10 text-destructive',
  commit: 'bg-green-500/10 text-green-700 dark:text-green-400',
}

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<AgentSession | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessionAndEvents()
  }, [sessionId])

  async function fetchSessionAndEvents() {
    setLoading(true)
    try {
      // For now, mock the session data
      // In production, this would fetch from /api/agent/sessions/[id]
      const mockSession: AgentSession = {
        id: sessionId,
        session_number: 90,
        session_type: 'coding',
        status: 'completed',
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        ended_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
        features_before: 223,
        features_after: 224,
        tool_calls: 178,
        tool_errors: 17,
      }
      setSession(mockSession)

      // Fetch events from API
      const res = await fetch(`/api/agent/sessions/${sessionId}/events`)
      if (res.ok) {
        const eventsData = await res.json()
        setEvents(eventsData)
      } else {
        // If no events in DB, show mock events
        const mockEvents: AgentEvent[] = [
          {
            id: 1,
            session_id: sessionId,
            event_type: 'session_start',
            data: { session_number: 90, type: 'coding' },
            created_at: mockSession.started_at,
          },
          {
            id: 2,
            session_id: sessionId,
            event_type: 'tool_call',
            data: { tool: 'Read', description: 'Read feature_list.json' },
            created_at: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 3,
            session_id: sessionId,
            event_type: 'tool_result',
            data: { tool: 'Read', success: true },
            created_at: new Date(Date.now() - 1.88 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 4,
            session_id: sessionId,
            event_type: 'feature_pass',
            data: { feature_id: 228, description: 'Agent status display + session history' },
            created_at: new Date(Date.now() - 1.7 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 5,
            session_id: sessionId,
            event_type: 'commit',
            data: { message: 'feat: implement agent status display — test #228 passing' },
            created_at: new Date(Date.now() - 1.6 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 6,
            session_id: sessionId,
            event_type: 'session_end',
            data: { features_implemented: 1, tool_calls: 178, errors: 17 },
            created_at: mockSession.ended_at!,
          },
        ]
        setEvents(mockEvents)
      }
    } catch (err) {
      console.error('Failed to fetch session details:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Session not found</p>
        <Button onClick={() => router.push('/agent')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agent Monitor
        </Button>
      </div>
    )
  }

  const Icon = statusIcons[session.status]
  const colorClass = statusColors[session.status]

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <button
          onClick={() => router.push('/agent')}
          className="hover:text-foreground transition-colors"
        >
          Agent Monitor
        </button>
        <span>&gt;</span>
        <span>Session #{session.session_number}</span>
      </div>

      {/* Back Button */}
      <Button
        onClick={() => router.push('/agent')}
        variant="outline"
        size="sm"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Agent Monitor
      </Button>

      {/* Session Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>Session #{session.session_number}</CardTitle>
                <Badge variant="outline" className={colorClass}>
                  {session.status}
                </Badge>
                <Badge variant="outline">{session.session_type}</Badge>
              </div>
              <CardDescription className="mt-2">
                Started {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
                {session.ended_at && (
                  <> • Ended {formatDistanceToNow(new Date(session.ended_at), { addSuffix: true })}</>
                )}
              </CardDescription>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${colorClass}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Features</p>
              <p className="text-lg font-medium">
                {session.features_before} → {session.features_after}
                <span className="ml-1 text-sm text-success">
                  (+{session.features_after - session.features_before})
                </span>
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Tool Calls</p>
              <p className="text-lg font-medium">{session.tool_calls}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Errors</p>
              <p className="text-lg font-medium">{session.tool_errors}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-lg font-medium">
                {session.ended_at
                  ? Math.round(
                      (new Date(session.ended_at).getTime() -
                        new Date(session.started_at).getTime()) /
                        60000
                    ) + 'm'
                  : 'Running...'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Event Timeline</CardTitle>
          <CardDescription>
            {events.length} event{events.length !== 1 ? 's' : ''} recorded during this session
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No events recorded</p>
              <p className="text-sm text-muted-foreground mt-1">
                Events will appear here as the session progresses
              </p>
            </div>
          ) : (
            <div className="relative space-y-4">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

              {events.map((event, index) => {
                const eventColor = eventTypeColors[event.event_type] || 'bg-muted'

                return (
                  <div key={event.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div
                      className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-background ${eventColor}`}
                    >
                      <div className="h-2 w-2 rounded-full bg-current" />
                    </div>

                    {/* Event content */}
                    <div className="flex-1 pb-8">
                      <div className="rounded-lg border border-border p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={eventColor}>
                                {event.event_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.created_at), 'HH:mm:ss')}
                              </span>
                            </div>

                            {/* Event data */}
                            {Object.keys(event.data).length > 0 && (
                              <div className="mt-2 rounded-md bg-muted/50 p-3">
                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                                  {JSON.stringify(event.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>

                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(event.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
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
