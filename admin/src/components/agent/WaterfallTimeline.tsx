'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AgentEvent {
  id: string
  agent_name: string
  event_type: string
  payload: Record<string, any>
  session_id: string | null
  created_at: string
}

interface WaterfallSpan {
  id: string
  type: string
  label: string
  startTime: number
  duration: number
  color: string
  payload?: Record<string, any>
}

interface WaterfallTimelineProps {
  events: AgentEvent[]
  sessionStartTime?: string
}

// Event type colors
const EVENT_COLORS: Record<string, string> = {
  session_start: 'bg-primary',
  session_end: 'bg-success',
  tool_use: 'bg-primary',
  error: 'bg-destructive',
  rate_limit_exceeded: 'bg-warning',
  default: 'bg-muted',
}

export function WaterfallTimeline({ events, sessionStartTime }: WaterfallTimelineProps) {
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set())

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">No events to display</p>
        <p className="text-sm text-muted-foreground mt-1">
          Session events will appear in a waterfall timeline
        </p>
      </div>
    )
  }

  // Convert events to waterfall spans
  const baseTime = sessionStartTime
    ? new Date(sessionStartTime).getTime()
    : new Date(events[0].created_at).getTime()

  const spans: WaterfallSpan[] = events.map((event, index) => {
    const startTime = new Date(event.created_at).getTime() - baseTime
    const nextEventTime = index < events.length - 1
      ? new Date(events[index + 1].created_at).getTime() - baseTime
      : startTime + 1000 // Default 1s for last event

    // Extract duration from payload if available (in milliseconds)
    const payloadDuration = event.payload?.duration_ms || event.payload?.duration
    const duration = payloadDuration || (nextEventTime - startTime)

    const color = EVENT_COLORS[event.event_type] || EVENT_COLORS.default

    // Extract tool name from payload if available
    const toolName = event.payload?.tool || event.payload?.name
    const label = toolName || event.event_type

    return {
      id: event.id,
      type: event.event_type,
      label,
      startTime,
      duration: Math.max(duration, 100), // Minimum 100ms for visibility
      color,
      payload: event.payload,
    }
  })

  // Calculate total duration for scaling
  const totalDuration = Math.max(...spans.map(s => s.startTime + s.duration))

  const toggleSpan = (spanId: string) => {
    setExpandedSpans(prev => {
      const next = new Set(prev)
      if (next.has(spanId)) {
        next.delete(spanId)
      } else {
        next.add(spanId)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Timeline Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
        <span>Event Timeline</span>
        <span>Total: {(totalDuration / 1000).toFixed(2)}s</span>
      </div>

      {/* Waterfall Container - horizontal scroll on mobile */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px] space-y-2">
          {spans.map((span, index) => {
            const isExpanded = expandedSpans.has(span.id)
            const leftPercent = (span.startTime / totalDuration) * 100
            const widthPercent = (span.duration / totalDuration) * 100

            return (
              <div key={span.id} className="space-y-1">
                {/* Span Row */}
                <div className="flex items-center gap-2 group">
                  {/* Expand/Collapse Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => toggleSpan(span.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>

                  {/* Span Label */}
                  <div className="w-32 md:w-40 shrink-0 text-xs font-medium truncate">
                    {span.label}
                  </div>

                  {/* Waterfall Bar */}
                  <div className="flex-1 relative h-8 bg-muted/30 rounded">
                    {/* Timeline markers (every 25%) */}
                    {[25, 50, 75].map(percent => (
                      <div
                        key={percent}
                        className="absolute top-0 bottom-0 w-px bg-border opacity-30"
                        style={{ left: `${percent}%` }}
                      />
                    ))}

                    {/* Event Bar */}
                    <div
                      className={`absolute top-1 bottom-1 ${span.color} rounded px-2 flex items-center justify-between text-xs text-white font-medium cursor-pointer hover:opacity-90 transition-opacity`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${Math.max(widthPercent, 2)}%`, // Min 2% for visibility
                      }}
                      onClick={() => toggleSpan(span.id)}
                      title={`${span.label} - ${(span.duration / 1000).toFixed(3)}s`}
                    >
                      <span className="truncate">{span.label}</span>
                      <span className="ml-2 shrink-0">{(span.duration / 1000).toFixed(2)}s</span>
                    </div>
                  </div>

                  {/* Start Time */}
                  <div className="w-20 text-xs text-muted-foreground text-right shrink-0">
                    +{(span.startTime / 1000).toFixed(2)}s
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="ml-8 pl-4 border-l-2 border-border">
                    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                      {/* Metadata */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{span.type}</Badge>
                        <span className="text-muted-foreground">
                          Start: +{(span.startTime / 1000).toFixed(3)}s
                        </span>
                        <span className="text-muted-foreground">
                          Duration: {(span.duration / 1000).toFixed(3)}s
                        </span>
                      </div>

                      {/* Payload (Input/Output) */}
                      {span.payload && Object.keys(span.payload).length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">Event Payload:</p>
                          <div className="rounded-md bg-muted p-2 overflow-x-auto">
                            <pre className="text-xs text-muted-foreground">
                              {JSON.stringify(span.payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2 border-t text-xs">
        <div className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded ${EVENT_COLORS.tool_use}`} />
          <span>Tool Use</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded ${EVENT_COLORS.session_start}`} />
          <span>Session Start</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded ${EVENT_COLORS.session_end}`} />
          <span>Session End</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded ${EVENT_COLORS.error}`} />
          <span>Error</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded ${EVENT_COLORS.rate_limit_exceeded}`} />
          <span>Rate Limit</span>
        </div>
      </div>
    </div>
  )
}
