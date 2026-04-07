'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, Heart, Database, CalendarClock, Inbox } from 'lucide-react'
import type { HealthStatus } from './types'

interface SystemHealthGridProps {
  health: HealthStatus
  triggeringHeartbeat: boolean
  onTriggerHeartbeat: () => void
}

export function SystemHealthGrid({ health, triggeringHeartbeat, onTriggerHeartbeat }: SystemHealthGridProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">System Health</h2>
        <Button
          onClick={onTriggerHeartbeat}
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
  )
}
