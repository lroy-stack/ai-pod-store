'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Send,
  Bot,
  ArrowLeft,
  Menu,
  Plus,
  MessageSquare,
  Square,
  Trash2,
  DollarSign,
  Loader2,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ChatMessage } from '@/components/agent/ChatMessage'
import { usePodClawChat } from '@/hooks/usePodClawChat'
import { adminFetch } from '@/lib/admin-api'

interface Conversation {
  id: string
  title: string
  created_at: string
}

export default function AgentChatPage() {
  const router = useRouter()
  const {
    messages,
    isStreaming,
    activeTools,
    send,
    stop,
    conversationId,
    totalCost,
    loadConversation,
    newConversation,
  } = usePodClawChat()

  const [input, setInput] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTools])

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await adminFetch('/api/agent/chat/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Refresh conversation list when a new conversation is created
  useEffect(() => {
    if (conversationId) {
      fetchConversations()
    }
  }, [conversationId, fetchConversations])

  function handleSend() {
    if (!input.trim() || isStreaming) return
    send(input.trim())
    setInput('')
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    // Auto-resize
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }

  async function handleDeleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await adminFetch(`/api/agent/chat/conversations/${id}`, { method: 'DELETE' })
      setConversations(prev => prev.filter(c => c.id !== id))
      if (conversationId === id) {
        newConversation()
      }
    } catch {
      // Silently fail
    }
  }

  // Sidebar content (shared between desktop and mobile)
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => newConversation()}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loadingConversations ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No conversations yet
          </p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`group flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                conversationId === conv.id
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1 text-xs">
                {conv.title || 'Untitled'}
              </span>
              <button
                onClick={(e) => handleDeleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/10 rounded"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </button>
          ))
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => router.push('/agent')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Mobile sidebar trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetHeader className="p-4 pb-0">
                <SheetTitle>Conversations</SheetTitle>
              </SheetHeader>
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">PodClaw Chat</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {activeTools.length > 0 && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {activeTools.length} tool{activeTools.length !== 1 ? 's' : ''} running
            </Badge>
          )}
          {totalCost > 0 && (
            <span className="flex items-center gap-0.5">
              <DollarSign className="h-3 w-3" />
              {totalCost.toFixed(4)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 border-r border-border bg-muted/30 flex-col">
          <SidebarContent />
        </aside>

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-foreground">
                    Chat with PodClaw
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Ask about your store, products, orders, finances, or anything else.
                    PodClaw has direct access to Supabase, Stripe, and Printful.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 max-w-lg justify-center">
                  {[
                    'How many products do we have?',
                    'Revenue this month?',
                    'Show me recent orders',
                    'Products with low margin',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion)
                        send(suggestion)
                      }}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={
                  isStreaming &&
                  message.role === 'assistant' &&
                  message.id === messages[messages.length - 1]?.id
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-border bg-background p-3">
            <div className="flex items-end gap-2 max-w-4xl mx-auto">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Message PodClaw..."
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-h-40"
              />
              {isStreaming ? (
                <Button
                  onClick={stop}
                  size="icon"
                  variant="outline"
                  className="shrink-0 rounded-xl h-10 w-10"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  size="icon"
                  className="shrink-0 rounded-xl h-10 w-10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
