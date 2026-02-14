'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, Play, Square, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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

export default function AgentsPage() {
  const [agentStatus, setAgentStatus] = useState<'running' | 'stopped'>('stopped')
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAgentStatus()
    fetchSessions()
  }, [])

  async function fetchAgentStatus() {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))
      setAgentStatus('stopped')
    } catch (err) {
      console.error('Failed to fetch agent status:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchSessions() {
    try {
      // Mock data for now
      const mockSessions: AgentSession[] = [
        {
          id: '1',
          session_number: 90,
          session_type: 'coding',
          status: 'completed',
          started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          ended_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
          features_before: 223,
          features_after: 224,
          tool_calls: 178,
          tool_errors: 17,
        },
        {
          id: '2',
          session_number: 89,
          session_type: 'coding',
          status: 'completed',
          started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          ended_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          features_before: 221,
          features_after: 223,
          tool_calls: 87,
          tool_errors: 3,
        },
      ]
      setSessions(mockSessions)
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
    }
  }

  async function handleStart() {
    setAgentStatus('running')
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  async function handleStop() {
    setAgentStatus('stopped')
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <span>Agent Monitor</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Agent Monitor</h1>
        <p className="text-muted-foreground mt-1">
          Monitor PodClaw autonomous agent status and session history
        </p>
      </div>

      {/* Agent Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            PodClaw Status
          </CardTitle>
          <CardDescription>Current agent execution status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${
                      agentStatus === 'running'
                        ? 'bg-success/20'
                        : 'bg-muted'
                    }`}
                  >
                    {agentStatus === 'running' ? (
                      <Play className="h-6 w-6 text-success" />
                    ) : (
                      <Square className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {agentStatus === 'running' ? 'Running' : 'Stopped'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {agentStatus === 'running'
                        ? 'Agent is currently executing tasks'
                        : 'Agent is not running'}
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={
                    agentStatus === 'running'
                      ? 'bg-success/10 text-success'
                      : 'bg-muted'
                  }
                >
                  {agentStatus === 'running' ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleStart}
                  disabled={agentStatus === 'running'}
                  size="sm"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Agent
                </Button>
                <Button
                  onClick={handleStop}
                  disabled={agentStatus === 'stopped'}
                  variant="outline"
                  size="sm"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Agent
                </Button>
              </div>

              {agentStatus === 'stopped' && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    💡 <strong>Tip:</strong> PodClaw runs autonomously on a scheduled cycle.
                    Manual control is for testing and emergency stop only.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
          <CardDescription>Recent agent execution sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No sessions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Agent sessions will appear here once PodClaw starts running
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const Icon = statusIcons[session.status]
                const colorClass = statusColors[session.status]

                return (
                  <div
                    key={session.id}
                    className="flex items-start gap-4 rounded-lg border border-border p-4"
                  >
                    {/* Status Icon */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Session Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              Session #{session.session_number}
                            </p>
                            <Badge variant="outline" className={colorClass}>
                              {session.status}
                            </Badge>
                            <Badge variant="outline">
                              {session.session_type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Started{' '}
                            {formatDistanceToNow(new Date(session.started_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-3 md:grid-cols-4">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Features
                          </p>
                          <p className="text-sm font-medium">
                            {session.features_before} → {session.features_after}
                            <span className="ml-1 text-success">
                              (+{session.features_after - session.features_before})
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Tool Calls
                          </p>
                          <p className="text-sm font-medium">
                            {session.tool_calls}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Errors
                          </p>
                          <p className="text-sm font-medium">
                            {session.tool_errors}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Duration
                          </p>
                          <p className="text-sm font-medium">
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
