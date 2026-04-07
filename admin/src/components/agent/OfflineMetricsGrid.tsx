'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, CheckCircle, ChevronRight, TrendingUp } from 'lucide-react'
import { Sparkline } from '@/components/ui/sparkline'
import type { AgentMetrics } from './types'

interface OfflineMetricsGridProps {
  metrics: AgentMetrics[]
}

/** Historical metrics grid shown when PodClaw bridge is offline */
export function OfflineMetricsGrid({ metrics }: OfflineMetricsGridProps) {
  const router = useRouter()
  const filtered = metrics.filter(m => m.total_runs > 0 || m.today_cost > 0)

  if (filtered.length === 0) return null

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Agent Metrics (Historical)</h2>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {filtered.map((agentMetrics) => {
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
                    <span className="text-muted-foreground">Today&apos;s cost</span>
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
  )
}
