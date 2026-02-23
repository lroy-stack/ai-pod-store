'use client'

import { useState } from 'react'
import { Bot, User, ChevronDown, ChevronRight, DollarSign, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SafeMarkdown } from '@/components/ui/safe-markdown'
import remarkGfm from 'remark-gfm'
import { ToolCallCard } from './ToolCallCard'
import type { ChatMessage as ChatMessageType } from '@/hooks/usePodClawChat'

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming?: boolean
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const [showThinking, setShowThinking] = useState(false)
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      <div className={`max-w-[85%] md:max-w-[75%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Thinking indicator */}
        {!isUser && message.thinking && (
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showThinking ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Thinking...
          </button>
        )}
        {showThinking && message.thinking && (
          <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground italic max-h-40 overflow-y-auto">
            {message.thinking}
          </div>
        )}

        {/* Main message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-card border border-border text-card-foreground'
          }`}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_pre]:text-xs [&_code]:text-xs">
              <SafeMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2 -mx-2">
                      <table className="w-full border-collapse text-xs">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border bg-muted px-2 py-1 text-left font-semibold text-xs">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-2 py-1 text-xs">{children}</td>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-muted rounded-lg p-3 overflow-x-auto my-2 text-xs">
                      {children}
                    </pre>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className
                    return isInline ? (
                      <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                        {children}
                      </code>
                    ) : (
                      <code className={`${className || ''} text-xs font-mono`}>{children}</code>
                    )
                  },
                }}
              >
                {message.content || ''}
              </SafeMarkdown>
              {isStreaming && !message.content && (
                <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse rounded-sm" />
              )}
              {isStreaming && message.content && (
                <span className="inline-block w-1.5 h-3.5 bg-foreground/50 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* Tool calls */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-0">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Meta info (cost, tool count, timestamp) */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
          <span>{message.timestamp.toLocaleTimeString()}</span>
          {!isUser && message.costUsd !== undefined && message.costUsd > 0 && (
            <span className="flex items-center gap-0.5">
              <DollarSign className="h-2.5 w-2.5" />
              {message.costUsd.toFixed(4)}
            </span>
          )}
          {!isUser && message.toolCallsCount !== undefined && message.toolCallsCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Wrench className="h-2.5 w-2.5" />
              {message.toolCallsCount} tools
            </span>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}
