'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot, Clock, CheckCircle, XCircle, AlertCircle, Zap } from 'lucide-react'
import type { AgentSession } from './types'

interface SessionTimelineProps {
  sessions: AgentSession[]
}

export function SessionTimeline({ sessions }: SessionTimelineProps) {
  if (sessions.length === 0) return null

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {sessions.map((session) => {
              const duration = session.ended_at
                ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60)
                : null
              const statusIcon = session.status === 'completed'
                ? <CheckCircle className="h-4 w-4 text-success" />
                : session.status === 'error'
                ? <XCircle className="h-4 w-4 text-destructive" />
                : <Clock className="h-4 w-4 text-warning" />

              return (
                <div key={session.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Agent info and status */}
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{session.session_type}</span>
                          <Badge
                            variant="outline"
                            className={
                              session.status === 'completed'
                                ? 'bg-success/10 text-success'
                                : session.status === 'error'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-warning/10 text-warning'
                            }
                          >
                            <span className="flex items-center gap-1">
                              {statusIcon}
                              {session.status}
                            </span>
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(session.started_at).toLocaleString()}
                          </span>
                          {duration !== null && (
                            <span>{duration}m duration</span>
                          )}
                          {session.tool_calls > 0 && (
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {session.tool_calls} tool calls
                            </span>
                          )}
                          {session.tool_errors > 0 && (
                            <span className="flex items-center gap-1 text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              {session.tool_errors} errors
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Features completed */}
                    {session.features_before !== null && session.features_after !== null && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Features</p>
                        <p className="text-sm font-medium">
                          {session.features_before} → {session.features_after}
                          {session.features_after > session.features_before && (
                            <span className="ml-1 text-success">
                              (+{session.features_after - session.features_before})
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
