'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, Play, Pause, WifiOff, BarChart3, List } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WaterfallTimeline } from '@/components/agent/WaterfallTimeline'
import { adminFetch } from '@/lib/admin-api'

interface BridgeAgent {
  agent: string
  running: boolean
  session_id: string | null
  model: string | null
  tools: string[]
}

interface AgentEvent {
  id: string
  agent_name: string
  event_type: string
  payload: Record<string, any>
  session_id: string | null
  created_at: string
}

interface AgentSession {
  id: string
  session_number: number | null
  session_type: string
  status: string
  started_at: string
  ended_at: string | null
  features_before: number | null
  features_after: number | null
  tool_calls: number
  tool_errors: number
  memory_snapshot: string | null
  error_log: string | null
}

const eventTypeColors: Record<string, string> = {
  session_start: 'bg-primary/10 text-primary',
  session_end: 'bg-success/10 text-success',
  tool_use: 'bg-accent text-accent-foreground',
  error: 'bg-destructive/10 text-destructive',
  rate_limit_exceeded: 'bg-warning/10 text-warning',
}

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const agentName = params.id as string

  const [agent, setAgent] = useState<BridgeAgent | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [replayingSession, setReplayingSession] = useState<string | null>(null)
  const [timelineView, setTimelineView] = useState<'list' | 'waterfall'>('waterfall')

  useEffect(() => {
    fetchAgentDetail()
  }, [agentName])

  async function fetchAgentDetail() {
    setLoading(true)
    setOffline(false)
    try {
      const [agentRes, eventsRes, sessionsRes] = await Promise.all([
        adminFetch(`/api/agent/agents/${agentName}`),
        adminFetch(`/api/agent/events?agent=${agentName}&limit=50`),
        adminFetch(`/api/agent/sessions?agent=${agentName}&limit=10`),
      ])

      // Sessions are from Supabase, not bridge - always fetch them
      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessions(data.sessions ?? [])
      }

      // Agent and events are from bridge - set offline if bridge is down
      if (agentRes.status === 503) {
        setOffline(true)
        return
      }

      if (agentRes.ok) {
        setAgent(await agentRes.json())
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setEvents(data.events ?? [])
      }
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleReplaySession(sessionId: string) {
    setReplayingSession(sessionId)
    setSelectedSessionId(sessionId)
    try {
      const res = await adminFetch(`/api/agent/sessions/${sessionId}/events`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events ?? [])
      }
    } catch (error) {
      console.error('Failed to replay session:', error)
    } finally {
      setReplayingSession(null)
    }
  }

  function handleClearReplay() {
    setSelectedSessionId(null)
    fetchAgentDetail() // Reload all recent events
  }

  async function handleRun() {
    try {
      await adminFetch(`/api/agent/agents/${agentName}/run`, { method: 'POST' })
      await fetchAgentDetail()
    } catch {
      console.error('Failed to run agent')
    }
  }

  async function handlePause() {
    try {
      await adminFetch(`/api/agent/agents/${agentName}/pause`, { method: 'POST' })
    } catch {
      console.error('Failed to pause agent')
    }
  }

  async function handleResume() {
    try {
      await adminFetch(`/api/agent/agents/${agentName}/resume`, { method: 'POST' })
    } catch {
      console.error('Failed to resume agent')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (offline) {
    return (
      <div className="space-y-6">
        <Button onClick={() => router.push('/agent')} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agent Monitor
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
            <Badge variant="outline" className="bg-destructive/10 text-destructive mb-4">
              PodClaw Offline
            </Badge>
            <p className="text-lg font-medium">Cannot reach PodClaw bridge</p>
            <p className="text-sm text-muted-foreground mt-2">
              Session history is still available below
            </p>
            <Button onClick={fetchAgentDetail} variant="outline" className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>

        {/* Session History - still available when bridge is offline */}
        {sessions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
              <CardDescription>
                {sessions.length} past session{sessions.length !== 1 ? 's' : ''} for {agentName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`rounded-lg border p-4 transition-colors ${
                      selectedSessionId === session.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={
                              session.status === 'completed'
                                ? 'bg-success/10 text-success'
                                : session.status === 'error'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-primary/10 text-primary'
                            }
                          >
                            {session.status}
                          </Badge>
                          {session.session_number && (
                            <span className="text-xs text-muted-foreground">
                              Session #{session.session_number}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(session.started_at), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Tool calls:</span>{' '}
                            <span className="font-medium">{session.tool_calls}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Errors:</span>{' '}
                            <span className="font-medium">{session.tool_errors}</span>
                          </div>
                          {session.features_before !== null && session.features_after !== null && (
                            <div>
                              <span className="text-muted-foreground">Features:</span>{' '}
                              <span className="font-medium">
                                {session.features_before} → {session.features_after}
                              </span>
                            </div>
                          )}
                          {session.ended_at && (
                            <div>
                              <span className="text-muted-foreground">Duration:</span>{' '}
                              <span className="font-medium">
                                {Math.round(
                                  (new Date(session.ended_at).getTime() -
                                    new Date(session.started_at).getTime()) /
                                    1000 /
                                    60
                                )}{' '}
                                min
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={selectedSessionId === session.id ? 'outline' : 'default'}
                        disabled={replayingSession === session.id}
                        onClick={() =>
                          selectedSessionId === session.id
                            ? handleClearReplay()
                            : handleReplaySession(session.id)
                        }
                      >
                        {replayingSession === session.id ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                            Loading...
                          </>
                        ) : selectedSessionId === session.id ? (
                          'Clear'
                        ) : (
                          'Replay'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events from replayed session */}
        {selectedSessionId && events.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Event Timeline</CardTitle>
                  <CardDescription>
                    Replaying session ({events.length} events in chronological order)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Tabs value={timelineView} onValueChange={(v) => setTimelineView(v as 'list' | 'waterfall')}>
                    <TabsList>
                      <TabsTrigger value="waterfall" className="text-xs">
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Waterfall
                      </TabsTrigger>
                      <TabsTrigger value="list" className="text-xs">
                        <List className="h-3 w-3 mr-1" />
                        List
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button size="sm" variant="outline" onClick={handleClearReplay}>
                    Clear Replay
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {timelineView === 'waterfall' ? (
                <WaterfallTimeline
                  events={events}
                  sessionStartTime={sessions.find(s => s.id === selectedSessionId)?.started_at}
                />
              ) : (
                <div className="relative space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

                  {events.map((event) => {
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

                                {Object.keys(event.payload || {}).length > 0 && (
                                  <div className="mt-2 rounded-md bg-muted/50 p-3">
                                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                                      {JSON.stringify(event.payload, null, 2)}
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
        )}
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Agent &quot;{agentName}&quot; not found</p>
        <Button onClick={() => router.push('/agent')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agent Monitor
        </Button>
      </div>
    )
  }

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
        <span>{agent.agent}</span>
      </div>

      {/* Back Button */}
      <Button onClick={() => router.push('/agent')} variant="outline" size="sm">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Agent Monitor
      </Button>

      {/* Agent Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">{agent.agent}</CardTitle>
                <Badge
                  variant="outline"
                  className={agent.running ? 'bg-success/10 text-success' : 'bg-muted'}
                >
                  {agent.running ? 'Running' : 'Idle'}
                </Badge>
              </div>
              <CardDescription className="mt-2">
                Model: {agent.model ?? 'unknown'} | Session: {agent.session_id ?? 'none'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tools */}
          <div>
            <p className="text-sm font-medium mb-2">Tools ({agent.tools.length})</p>
            <div className="flex flex-wrap gap-2">
              {agent.tools.map((tool) => (
                <Badge key={tool} variant="secondary">{tool}</Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button size="sm" disabled={agent.running} onClick={handleRun}>
              <Play className="mr-2 h-4 w-4" />
              Run Now
            </Button>
            <Button size="sm" variant="outline" onClick={handlePause}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
            <Button size="sm" variant="outline" onClick={handleResume}>
              Resume
            </Button>
            <Button size="sm" variant="ghost" onClick={fetchAgentDetail}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
          <CardDescription>
            {sessions.length} past session{sessions.length !== 1 ? 's' : ''} for this agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No sessions recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    selectedSessionId === session.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={
                            session.status === 'completed'
                              ? 'bg-success/10 text-success'
                              : session.status === 'error'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-primary/10 text-primary'
                          }
                        >
                          {session.status}
                        </Badge>
                        {session.session_number && (
                          <span className="text-xs text-muted-foreground">
                            Session #{session.session_number}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(session.started_at), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Tool calls:</span>{' '}
                          <span className="font-medium">{session.tool_calls}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Errors:</span>{' '}
                          <span className="font-medium">{session.tool_errors}</span>
                        </div>
                        {session.features_before !== null && session.features_after !== null && (
                          <div>
                            <span className="text-muted-foreground">Features:</span>{' '}
                            <span className="font-medium">
                              {session.features_before} → {session.features_after}
                            </span>
                          </div>
                        )}
                        {session.ended_at && (
                          <div>
                            <span className="text-muted-foreground">Duration:</span>{' '}
                            <span className="font-medium">
                              {Math.round(
                                (new Date(session.ended_at).getTime() -
                                  new Date(session.started_at).getTime()) /
                                  1000 /
                                  60
                              )}{' '}
                              min
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedSessionId === session.id ? 'outline' : 'default'}
                      disabled={replayingSession === session.id}
                      onClick={() =>
                        selectedSessionId === session.id
                          ? handleClearReplay()
                          : handleReplaySession(session.id)
                      }
                    >
                      {replayingSession === session.id ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                          Loading...
                        </>
                      ) : selectedSessionId === session.id ? (
                        'Show All Events'
                      ) : (
                        'Replay'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Timeline */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Event Timeline</CardTitle>
              <CardDescription>
                {selectedSessionId
                  ? `Replaying session (${events.length} events in chronological order)`
                  : `${events.length} recent event${events.length !== 1 ? 's' : ''} from bridge /events`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Tabs value={timelineView} onValueChange={(v) => setTimelineView(v as 'list' | 'waterfall')}>
                <TabsList>
                  <TabsTrigger value="waterfall" className="text-xs">
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Waterfall
                  </TabsTrigger>
                  <TabsTrigger value="list" className="text-xs">
                    <List className="h-3 w-3 mr-1" />
                    List
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {selectedSessionId && (
                <Button size="sm" variant="outline" onClick={handleClearReplay}>
                  Clear Replay
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No events yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Events will appear after the agent runs
              </p>
            </div>
          ) : timelineView === 'waterfall' ? (
            <WaterfallTimeline
              events={events}
              sessionStartTime={
                selectedSessionId
                  ? sessions.find(s => s.id === selectedSessionId)?.started_at
                  : undefined
              }
            />
          ) : (
            <div className="relative space-y-4">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

              {events.map((event) => {
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

                            {event.payload && Object.keys(event.payload).length > 0 && (
                              <div className="mt-2 rounded-md bg-muted/50 p-3">
                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                                  {JSON.stringify(event.payload, null, 2)}
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
