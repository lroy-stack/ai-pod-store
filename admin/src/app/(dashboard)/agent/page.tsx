'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WifiOff, Calendar, MessageCircle } from 'lucide-react'
import { adminFetch } from '@/lib/admin-api'
import { PodClawStatusCard } from '@/components/agent/PodClawStatusCard'
import { SystemHealthGrid } from '@/components/agent/SystemHealthGrid'
import { SessionTimeline } from '@/components/agent/SessionTimeline'
import { SubAgentCards } from '@/components/agent/SubAgentCards'
import { AgentMemoryDialog } from '@/components/agent/AgentMemoryDialog'
import { OfflineMetricsGrid } from '@/components/agent/OfflineMetricsGrid'
import type {
  BridgeAgent,
  BridgeStatus,
  AgentMetrics,
  AgentSession,
  HealthStatus,
} from '@/components/agent/types'

export default function AgentsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [agents, setAgents] = useState<BridgeAgent[]>([])
  const [metrics, setMetrics] = useState<AgentMetrics[]>([])
  const [sessions, setSessions] = useState<AgentSession[]>([])
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
      const [statusRes, agentsRes, metricsRes, healthRes, sessionsRes] = await Promise.all([
        adminFetch('/api/agent/status'),
        adminFetch('/api/agent/agents'),
        adminFetch('/api/agent/metrics'),
        adminFetch('/api/agent/api/health'),
        adminFetch('/api/agent/sessions?limit=10'),
      ])

      // Always try to get metrics and sessions (they come from database, not PodClaw bridge)
      if (metricsRes.ok) {
        setMetrics(await metricsRes.json())
      }
      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessions(data.sessions || [])
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
      await adminFetch('/api/agent/stop', { method: 'POST' })
      await fetchAll()
    } catch {
      console.error('Failed to stop agents')
    }
  }

  async function handleTriggerAgent(agentName: string) {
    setTriggeringAgent(agentName)
    try {
      await adminFetch(`/api/agent/agents/${agentName}/run`, { method: 'POST' })
      await fetchAll()
    } catch {
      console.error('Failed to trigger agent:', agentName)
    } finally {
      setTriggeringAgent(null)
    }
  }

  async function fetchSoulMemory() {
    try {
      const res = await adminFetch('/api/agent/memory/soul')
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
      await adminFetch('/api/agent/heartbeat/trigger', { method: 'POST' })
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

        {/* Recent Sessions (from database) */}
        <SessionTimeline sessions={sessions} />

        {/* Agent Metrics (from database) */}
        <OfflineMetricsGrid metrics={metrics} />
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
          <Button
            onClick={() => router.push('/agent/chat')}
            variant="outline"
            size="sm"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Chat
          </Button>
        </div>
      </div>

      <PodClawStatusCard status={status} onStop={handleStop} />

      {health && (
        <SystemHealthGrid
          health={health}
          triggeringHeartbeat={triggeringHeartbeat}
          onTriggerHeartbeat={handleTriggerHeartbeat}
        />
      )}

      <SessionTimeline sessions={sessions} />

      <SubAgentCards
        agents={agents}
        metrics={metrics}
        triggeringAgent={triggeringAgent}
        onRunAgent={handleTriggerAgent}
      />

      <AgentMemoryDialog
        content={soulMemory}
        open={showMemoryDialog}
        onOpenChange={setShowMemoryDialog}
        onFetchMemory={fetchSoulMemory}
      />
    </div>
  )
}
