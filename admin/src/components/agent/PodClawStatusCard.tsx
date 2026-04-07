'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, Play, Square } from 'lucide-react'
import type { BridgeStatus } from './types'

interface PodClawStatusCardProps {
  status: BridgeStatus | null
  onStop: () => void
}

export function PodClawStatusCard({ status, onStop }: PodClawStatusCardProps) {
  return (
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
          <Button onClick={onStop} variant="outline" size="sm">
            <Square className="mr-2 h-4 w-4" />
            Emergency Stop
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
