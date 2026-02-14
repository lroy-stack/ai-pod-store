'use client'

/**
 * ChatArea - Center panel with message history + input
 *
 * Contains:
 * - Chat header with search, notifications, cart, avatar
 * - Welcome screen for new conversations
 * - Message history (scrollable)
 * - Input area with voice + image upload
 * - AI SDK 6 integration with streaming SSE
 */

import { useRef, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Bell, ShoppingCart, User, Send, Mic, Paperclip, Package, Heart } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import { getArtifact } from '@/components/artifacts/registry'

interface ChatAreaProps {
  onSelectProduct: (productId: string) => void
  externalInputValue?: string
  onExternalInputConsumed?: () => void
}

export function ChatArea({ onSelectProduct, externalInputValue, onExternalInputConsumed }: ChatAreaProps) {
  const t = useTranslations('storefront')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [userData, setUserData] = useState<{
    user: { name: string } | null
    activeOrders: Array<{ id: string; status: string; total: number }> | null
    recentFavorites: Array<{ id: string; name: string; price: number }> | null
  }>({ user: null, activeOrders: null, recentFavorites: null })

  // AI SDK 6 useChat hook with DefaultChatTransport
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Fetch user data on mount
  useEffect(() => {
    async function fetchUserData() {
      try {
        const [sessionRes, ordersRes, favoritesRes] = await Promise.all([
          fetch('/api/auth/session'),
          fetch('/api/orders?limit=3&status=processing,pending'),
          fetch('/api/wishlist/items?limit=3'),
        ])

        const session = await sessionRes.json()
        const orders = ordersRes.ok ? await ordersRes.json() : null
        const favorites = favoritesRes.ok ? await favoritesRes.json() : null

        setUserData({
          user: session.user || null,
          activeOrders: orders?.orders || null,
          recentFavorites: favorites?.items || null,
        })
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      }
    }
    fetchUserData()
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle external input value (from "Ask about this" button)
  useEffect(() => {
    if (externalInputValue) {
      setInputValue(externalInputValue)
      onExternalInputConsumed?.()
    }
  }, [externalInputValue, onExternalInputConsumed])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    sendMessage({ text: inputValue })
    setInputValue('')
  }

  const handlePromptClick = (prompt: string) => {
    // Send the message directly instead of just filling the input
    sendMessage({ text: prompt })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              className="pl-9 rounded-full bg-muted border-0"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
          </Button>

          {/* Cart */}
          <Button variant="ghost" size="icon" className="relative">
            <ShoppingCart className="h-5 w-5" />
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              2
            </Badge>
          </Button>

          {/* User Avatar */}
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="max-w-2xl mx-auto">
            <div className="text-center space-y-6 py-12">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60">
                <span className="text-3xl font-bold text-primary-foreground">P</span>
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                  {userData.user ? (
                    <>
                      {t('welcomeBackTitle', { name: userData.user.name.split(' ')[0] })}
                      <span className="inline-block ml-2 animate-pulse">✨</span>
                    </>
                  ) : (
                    <>
                      <span className="sparkle-text">{t('welcomeTitle')}</span>
                      <span className="inline-block ml-2 animate-pulse">✨</span>
                    </>
                  )}
                </h1>
                <p className="text-muted-foreground">
                  {userData.user ? t('welcomeBackSubtitle') : t('welcomeSubtitle')}
                </p>
              </div>

              {/* Active Orders and Favorites for returning users */}
              {userData.user && (userData.activeOrders || userData.recentFavorites) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {/* Active Orders */}
                  {userData.activeOrders && userData.activeOrders.length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Package className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">{t('activeOrders')}</h3>
                        </div>
                        <div className="space-y-2">
                          {userData.activeOrders.map((order) => (
                            <div key={order.id} className="text-xs text-left">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">#{order.id.slice(0, 8)}</span>
                                <span className="font-medium">${order.total.toFixed(2)}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs mt-1">
                                {order.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recent Favorites */}
                  {userData.recentFavorites && userData.recentFavorites.length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Heart className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">{t('recentFavorites')}</h3>
                        </div>
                        <div className="space-y-2">
                          {userData.recentFavorites.map((item) => (
                            <div key={item.id} className="text-xs text-left">
                              <div className="flex justify-between">
                                <span className="text-foreground truncate">{item.name}</span>
                                <span className="font-medium">${item.price.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Suggested Prompts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl mx-auto mt-8">
                <SuggestedPrompt
                  icon="✨"
                  text={t('promptDesign')}
                  onClick={() => handlePromptClick(t('promptDesign'))}
                />
                <SuggestedPrompt
                  icon="👕"
                  text={t('promptTshirt')}
                  onClick={() => handlePromptClick(t('promptTshirt'))}
                />
                <SuggestedPrompt
                  icon="🎨"
                  text={t('promptTrending')}
                  onClick={() => handlePromptClick(t('promptTrending'))}
                />
                <SuggestedPrompt
                  icon="🎁"
                  text={t('promptGift')}
                  onClick={() => handlePromptClick(t('promptGift'))}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Message History */
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      P
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground px-4 py-2 max-w-[80%]'
                      : 'bg-muted text-foreground max-w-full'
                  }`}
                >
                  {message.parts.map((part, index) => {
                    // Render text parts
                    if (part.type === 'text') {
                      // Render assistant messages with markdown, user messages as plain text
                      if (message.role === 'assistant') {
                        return (
                          <div key={index} className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 px-4 py-2">
                            <ReactMarkdown>{part.text}</ReactMarkdown>
                          </div>
                        )
                      }
                      return (
                        <p key={index} className="text-sm whitespace-pre-wrap">
                          {part.text}
                        </p>
                      )
                    }

                    // Render tool-result parts as artifacts
                    if (part.type === 'tool-result') {
                      // Type guard to access toolName safely
                      const toolPart = part as any
                      const toolName = toolPart.toolName as string | undefined

                      if (!toolName) {
                        return null
                      }

                      const artifact = getArtifact(toolName)

                      if (!artifact) {
                        // Unknown tool, skip rendering
                        return null
                      }

                      const { Component } = artifact

                      // Render result
                      if (toolPart.output) {
                        return (
                          <div key={index} className="p-4">
                            <Component
                              {...toolPart.output}
                              onSelectProduct={onSelectProduct}
                              variant="inline"
                            />
                          </div>
                        )
                      }

                      return null
                    }

                    return null
                  })}
                </div>
                {message.role === 'user' && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    P
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg px-4 py-3 bg-muted">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            {/* Voice Input */}
            <Button type="button" variant="ghost" size="icon" className="flex-shrink-0">
              <Mic className="h-5 w-5" />
              <span className="sr-only">Voice input</span>
            </Button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('inputPlaceholder')}
                className="pr-20 min-h-[44px] resize-none"
                disabled={isLoading}
              />
              {/* Image Upload */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-10 top-1/2 -translate-y-1/2"
              >
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach image</span>
              </Button>
            </div>

            {/* Send Button */}
            <Button
              type="submit"
              size="icon"
              className="flex-shrink-0"
              disabled={isLoading || !inputValue.trim()}
            >
              <Send className="h-5 w-5" />
              <span className="sr-only">Send message</span>
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-2">
            {t('aiDisclaimer')}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * SuggestedPrompt - Clickable prompt suggestion button
 */
function SuggestedPrompt({
  icon,
  text,
  onClick,
}: {
  icon: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-left"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm text-foreground">{text}</span>
    </button>
  )
}
