'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ChevronDown, Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { ToolCall } from '@/hooks/usePodClawChat'

const TOOL_COLORS: Record<string, string> = {
  supabase: 'bg-primary/10 text-primary border-primary/20',
  stripe: 'bg-success/10 text-success border-success/20',
  printful: 'bg-warning/10 text-warning border-warning/20',
  fal: 'bg-accent text-accent-foreground border-accent',
  gemini: 'bg-secondary text-secondary-foreground border-border',
  resend: 'bg-destructive/10 text-destructive border-destructive/20',
  crawl4ai: 'bg-muted text-muted-foreground border-border',
  telegram: 'bg-primary/10 text-primary border-primary/20',
  whatsapp: 'bg-success/10 text-success border-success/20',
}

function getToolColor(toolName: string): string {
  const prefix = toolName.replace(/^mcp__/, '').split('__')[0]
  return TOOL_COLORS[prefix] || 'bg-muted text-muted-foreground border-border'
}

function getDisplayName(toolName: string): string {
  // mcp__supabase__supabase_query → supabase_query
  const parts = toolName.split('__')
  return parts[parts.length - 1]
}

export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const displayName = getDisplayName(toolCall.tool)
  const colorClass = getToolColor(toolCall.tool)

  return (
    <div className="border border-border rounded-lg my-2 overflow-hidden text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}

        <Badge
          variant="outline"
          className={`text-[11px] font-mono px-1.5 py-0 ${colorClass}`}
        >
          {displayName}
        </Badge>

        <span className="flex-1" />

        {toolCall.status === 'running' && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {toolCall.status === 'completed' && (
          <CheckCircle className="h-3.5 w-3.5 text-success" />
        )}
        {toolCall.status === 'error' && (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2 bg-muted/30">
          {toolCall.input && Object.keys(toolCall.input).length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Input
              </span>
              <pre className="text-xs font-mono bg-background rounded p-2 mt-1 overflow-x-auto max-h-40 overflow-y-auto text-foreground">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}

          {toolCall.result && (
            <div>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Result
              </span>
              <pre className="text-xs font-mono bg-background rounded p-2 mt-1 overflow-x-auto max-h-40 overflow-y-auto text-foreground whitespace-pre-wrap">
                {toolCall.result}
              </pre>
            </div>
          )}

          {toolCall.status === 'running' && !toolCall.result && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
