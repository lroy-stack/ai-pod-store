'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, Play, Square, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, Zap, Brain, Eye, Calendar, WifiOff } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

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

export default function AgentsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [agents, setAgents] = useState<BridgeAgent[]>([])
  const [soulMemory, setSoulMemory] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [showMemoryDialog, setShowMemoryDialog] = useState(false)
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setOffline(false)
    try {
      const [statusRes, agentsRes] = await Promise.all([
        fetch('/api/agent/status'),
        fetch('/api/agent/agents'),
      ])

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
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className="text-foreground">Admin</span>
          <span>&gt;</span>
          <span>Agent Monitor</span>
        </div>
        <h1 className="text-3xl font-bold">Agent Monitor</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
            <Badge variant="outline" className="bg-destructive/10 text-destructive mb-4">
              PodClaw Offline
            </Badge>
            <p className="text-lg font-medium">PodClaw bridge is not reachable</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start PodClaw with: <code className="text-xs bg-muted px-1 py-0.5 rounded">python3 -m podclaw.main --workspace ./pod_workspace</code>
            </p>
            <Button onClick={fetchAll} variant="outline" className="mt-4">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {agents.map((agent) => (
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
                  {/* Tools */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tools ({agent.tools.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.tools.map((tool) => (
                        <Badge key={tool} variant="secondary" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
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
            ))}
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
