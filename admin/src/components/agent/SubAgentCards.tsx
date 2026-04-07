'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, Play, Clock, CheckCircle, ChevronRight, TrendingUp } from 'lucide-react'
import { Sparkline } from '@/components/ui/sparkline'
import type { BridgeAgent, AgentMetrics } from './types'

interface SubAgentCardsProps {
  agents: BridgeAgent[]
  metrics: AgentMetrics[]
  triggeringAgent: string | null
  onRunAgent: (agentName: string) => void
}

export function SubAgentCards({ agents, metrics, triggeringAgent, onRunAgent }: SubAgentCardsProps) {
  const router = useRouter()

  return (
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
                      onClick={() => onRunAgent(agent.agent)}
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
  )
}
