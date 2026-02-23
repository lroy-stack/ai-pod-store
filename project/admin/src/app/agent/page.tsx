'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, Play, Square, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, Zap, Brain, Eye, Calendar, WifiOff, TrendingUp, Activity, Database, Heart, CalendarClock, Inbox } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sparkline } from '@/components/ui/sparkline'

interface BridgeAgent {
  agent: string
  running: boolean
  session_id: string | null
  model: string | null
  tools: string[]
}

interface BridgeStatus {
  running: boolean
  active_sessions: Record<string, string>
  agent_count: number
  agents: string[]
}

interface AgentMetrics {
  agent_name: string
  last_run_at: string | null
  today_cost: number
  success_rate: number
  cost_history: Array<{ date: string; cost: number }>
  total_runs: number
  running: boolean
}

interface HealthCheck {
  ok: boolean
  [key: string]: any
}

interface HealthStatus {
  status: 'ok' | 'degraded'
  checks: {
    orchestrator: HealthCheck
    heartbeat: HealthCheck
    supabase: HealthCheck
    scheduler: HealthCheck
    event_queue: HealthCheck
  }
}

export default function AgentsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [agents, setAgents] = useState<BridgeAgent[]>([])
  const [metrics, setMetrics] = useState<AgentMetrics[]>([])
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [soulMemory, setSoulMemory] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [showMemoryDialog, setShowMemoryDialog] = useState(false)
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null)
  const [triggeringHeartbeat, setTriggeringHeartbeat] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setOffline(false)
    try {
      const [statusRes, agentsRes, metricsRes, healthRes] = await Promise.all([
        fetch('/api/agent/status'),
        fetch('/api/agent/agents'),
        fetch('/api/agent/metrics'),
        fetch('/api/agent/api/health'),
      ])

      // Always try to get metrics (they come from database, not PodClaw bridge)
      if (metricsRes.ok) {
        setMetrics(await metricsRes.json())
      }

      // Check if PodClaw bridge is offline
      if (statusRes.status === 503 || agentsRes.status === 503) {
        setOffline(true)
        return
      }

      if (statusRes.ok) {
        setStatus(await statusRes.json())
      }
      if (agentsRes.ok) {
        setAgents(await agentsRes.json())
      }
      if (healthRes.ok) {
        setHealth(await healthRes.json())
      }
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    try {
      await fetch('/api/agent/stop', { method: 'POST' })
      await fetchAll()
    } catch {
      console.error('Failed to stop agents')
    }
  }

  async function handleTriggerAgent(agentName: string) {
    setTriggeringAgent(agentName)
    try {
      await fetch(`/api/agent/agents/${agentName}/run`, { method: 'POST' })
      await fetchAll()
    } catch {
      console.error('Failed to trigger agent:', agentName)
    } finally {
      setTriggeringAgent(null)
    }
  }

  async function handlePause(agentName: string) {
    try {
      await fetch(`/api/agent/agents/${agentName}/pause`, { method: 'POST' })
    } catch {
      console.error('Failed to pause agent:', agentName)
    }
  }

  async function handleResume(agentName: string) {
    try {
      await fetch(`/api/agent/agents/${agentName}/resume`, { method: 'POST' })
    } catch {
      console.error('Failed to resume agent:', agentName)
    }
  }

  async function fetchSoulMemory() {
    try {
      const res = await fetch('/api/agent/memory/soul')
      if (res.ok) {
        const data = await res.json()
        setSoulMemory(data.content || 'No SOUL.md found')
        setShowMemoryDialog(true)
      }
    } catch {
      setSoulMemory('Failed to load SOUL.md — PodClaw bridge may be offline')
      setShowMemoryDialog(true)
    }
  }

  async function handleTriggerHeartbeat() {
    setTriggeringHeartbeat(true)
    try {
      await fetch('/api/agent/heartbeat/trigger', { method: 'POST' })
      // Refresh health status after triggering
      await fetchAll()
    } catch {
      console.error('Failed to trigger heartbeat')
    } finally {
      setTriggeringHeartbeat(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className="text-foreground">Admin</span>
          <span>&gt;</span>
          <span>Agent Monitor</span>
        </div>
        <h1 className="text-3xl font-bold">Agent Monitor</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (offline) {
    // Show metrics even when PodClaw is offline (metrics come from Supabase, not PodClaw bridge)
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className="text-foreground">Admin</span>
          <span>&gt;</span>
          <span>Agent Monitor</span>
        </div>
        <h1 className="text-3xl font-bold">Agent Monitor</h1>

        {/* PodClaw Offline Warning */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground mb-3" />
            <Badge variant="outline" className="bg-destructive/10 text-destructive mb-2">
              PodClaw Offline
            </Badge>
            <p className="text-sm text-muted-foreground">
              Bridge is not reachable. Historical metrics shown below.
            </p>
            <Button onClick={fetchAll} variant="outline" size="sm" className="mt-3">
              Retry Connection
            </Button>
          </CardContent>
        </Card>

        {/* Agent Metrics (from database) */}
        {metrics.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Agent Metrics (Historical)</h2>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {metrics.filter(m => m.total_runs > 0 || m.today_cost > 0).map((agentMetrics) => {
                const lastRun = agentMetrics.last_run_at
                  ? new Date(agentMetrics.last_run_at).toLocaleString()
                  : 'Never'
                const costData = agentMetrics.cost_history.map(c => c.cost)

                return (
                  <Card key={agentMetrics.agent_name} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{agentMetrics.agent_name}</CardTitle>
                        <Badge variant="outline" className="bg-muted">
                          Idle
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {agentMetrics.total_runs} total runs
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Metrics */}
                      <div className="space-y-2 pb-3 border-b border-border">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last run
                          </span>
                          <span className="font-medium truncate ml-2" title={lastRun}>
                            {lastRun === 'Never' ? lastRun : new Date(agentMetrics.last_run_at!).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Today's cost</span>
                          <span className="font-medium">${agentMetrics.today_cost.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Success rate
                          </span>
                          <span className="font-medium">{agentMetrics.success_rate}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            7-day cost
                          </span>
                          <Sparkline
                            data={costData}
                            width={60}
                            height={20}
                            color="hsl(var(--primary))"
                          />
                        </div>
                      </div>

                      {/* View Details */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push(`/agent/${agentMetrics.agent_name}`)}
                      >
                        <ChevronRight className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Monitor PodClaw autonomous agent status and controls
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAll} variant="outline" size="sm">
            Refresh
          </Button>
          <Button
            onClick={() => router.push('/agent/schedule')}
            variant="outline"
            size="sm"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>

      {/* PodClaw Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            PodClaw Status
          </CardTitle>
          <CardDescription>
            {status?.agent_count ?? 0} sub-agents configured
            {status?.running ? ' — orchestrator running' : ' — orchestrator stopped'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                status?.running ? 'bg-success/20' : 'bg-muted'
              }`}>
                {status?.running ? (
                  <Play className="h-6 w-6 text-success" />
                ) : (
                  <Square className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {status?.running ? 'Running' : 'Stopped'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(status?.active_sessions ?? {}).length} active session(s)
                </p>
              </div>
            </div>

            <Badge
              variant="outline"
              className={status?.running ? 'bg-success/10 text-success' : 'bg-muted'}
            >
              {status?.running ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          {status?.running && (
            <Button onClick={handleStop} variant="outline" size="sm">
              <Square className="mr-2 h-4 w-4" />
              Emergency Stop
            </Button>
          )}
        </CardContent>
      </Card>

      {/* System Health Dashboard */}
      {health && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">System Health</h2>
            <Button
              onClick={handleTriggerHeartbeat}
              disabled={triggeringHeartbeat}
              variant="outline"
              size="sm"
            >
              {triggeringHeartbeat ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
              ) : (
                <Heart className="h-4 w-4 mr-2" />
              )}
              Trigger Heartbeat
            </Button>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
            {/* Orchestrator */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Orchestrator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant="outline"
                  className={health.checks.orchestrator.ok
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                  }
                >
                  {health.checks.orchestrator.ok ? 'Healthy' : 'Down'}
                </Badge>
              </CardContent>
            </Card>

            {/* Heartbeat */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Heartbeat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge
                  variant="outline"
                  className={health.checks.heartbeat.ok
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                  }
                >
                  {health.checks.heartbeat.ok ? 'Healthy' : 'Degraded'}
                </Badge>
                {health.checks.heartbeat.last_run && (
                  <p className="text-xs text-muted-foreground">
                    Last: {new Date(health.checks.heartbeat.last_run).toLocaleTimeString()}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Supabase */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Supabase
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant="outline"
                  className={health.checks.supabase.ok
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                  }
                >
                  {health.checks.supabase.ok ? 'Healthy' : 'Down'}
                </Badge>
                {health.checks.supabase.error && (
                  <p className="text-xs text-destructive mt-2">
                    {health.checks.supabase.error}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Scheduler */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Scheduler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge
                  variant="outline"
                  className={health.checks.scheduler.ok
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                  }
                >
                  {health.checks.scheduler.ok ? 'Healthy' : 'Down'}
                </Badge>
                {health.checks.scheduler.job_count !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {health.checks.scheduler.job_count} jobs
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Event Queue */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Inbox className="h-4 w-4" />
                  Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge
                  variant="outline"
                  className={health.checks.event_queue.ok
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                  }
                >
                  {health.checks.event_queue.ok ? 'Healthy' : 'Down'}
                </Badge>
                {health.checks.event_queue.size !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {health.checks.event_queue.size} events
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Sub-Agent Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Sub-Agents ({agents.length})</h2>
        {agents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No agents loaded</p>
              <p className="text-sm text-muted-foreground mt-1">
                Agents will appear when PodClaw is running
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {agents.map((agent) => {
              const agentMetrics = metrics.find(m => m.agent_name === agent.agent)
              const lastRun = agentMetrics?.last_run_at
                ? new Date(agentMetrics.last_run_at).toLocaleString()
                : 'Never'
              const costData = agentMetrics?.cost_history.map(c => c.cost) ?? []

              return (
                <Card key={agent.agent} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{agent.agent}</CardTitle>
                      <Badge
                        variant="outline"
                        className={agent.running ? 'bg-success/10 text-success' : 'bg-muted'}
                      >
                        {agent.running ? 'Running' : 'Idle'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {agent.model ?? 'unknown model'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Metrics */}
                    {agentMetrics && (
                      <div className="space-y-2 pb-3 border-b border-border">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last run
                          </span>
                          <span className="font-medium truncate ml-2" title={lastRun}>
                            {lastRun === 'Never' ? lastRun : new Date(agentMetrics.last_run_at!).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Today's cost</span>
                          <span className="font-medium">${agentMetrics.today_cost.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Success rate
                          </span>
                          <span className="font-medium">{agentMetrics.success_rate}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            7-day cost
                          </span>
                          <Sparkline
                            data={costData}
                            width={60}
                            height={20}
                            color="hsl(var(--primary))"
                          />
                        </div>
                      </div>
                    )}

                    {/* Tools */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tools ({agent.tools.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {agent.tools.slice(0, 3).map((tool) => (
                          <Badge key={tool} variant="secondary" className="text-xs">
                            {tool}
                          </Badge>
                        ))}
                        {agent.tools.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{agent.tools.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={agent.running || triggeringAgent === agent.agent}
                        onClick={() => handleTriggerAgent(agent.agent)}
                      >
                        {triggeringAgent === agent.agent ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent mr-1" />
                        ) : (
                          <Play className="h-3 w-3 mr-1" />
                        )}
                        Run
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/agent/${agent.agent}`)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Memory */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Agent Memory
          </CardTitle>
          <CardDescription>
            View PodClaw&apos;s SOUL.md identity and long-term memory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchSoulMemory} variant="outline" size="sm">
            <Eye className="mr-2 h-4 w-4" />
            View SOUL.md
          </Button>
        </CardContent>
      </Card>

      {/* Memory Dialog */}
      <Dialog open={showMemoryDialog} onOpenChange={setShowMemoryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agent Identity (SOUL.md)</DialogTitle>
            <DialogDescription>
              PodClaw&apos;s core identity and behavioral guidelines
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-4 mt-4">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {soulMemory || 'Loading...'}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
