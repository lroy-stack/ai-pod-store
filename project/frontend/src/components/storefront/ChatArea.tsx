'use client'

/**
 * ChatArea - Center panel with message history + input
 *
 * Contains:
 * - Welcome screen for new conversations
 * - Message history (scrollable)
 * - Input area with voice + image upload
 * - AI SDK 6 integration with streaming SSE
 */

import { useRef, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { User, Send, Mic, Paperclip, Package, Heart } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isToolUIPart, getToolName } from 'ai'
import ReactMarkdown from 'react-markdown'
import { getArtifact } from '@/components/artifacts/registry'
import { useStorefront } from './StorefrontContext'

export function ChatArea() {
  const t = useTranslations('storefront')
  const { setSelectedProduct, pendingChatMessage, setPendingChatMessage } = useStorefront()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [userData, setUserData] = useState<{
    user: { name: string } | null
    activeOrders: Array<{ id: string; status: string; total: number }> | null
    recentFavorites: Array<{ id: string; name: string; price: number }> | null
  }>({ user: null, activeOrders: null, recentFavorites: null })

  // AI SDK 6 useChat hook with DefaultChatTransport
  const { messages, sendMessage, status, addToolApprovalResponse } = useChat({
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

  // Handle pending chat message from DetailPanel "Ask about" button
  useEffect(() => {
    if (pendingChatMessage) {
      setInputValue(pendingChatMessage)
      setPendingChatMessage('')
    }
  }, [pendingChatMessage, setPendingChatMessage])

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
    sendMessage({ text: prompt })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
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
                      <span className="inline-block ml-2 animate-pulse">&#10024;</span>
                    </>
                  ) : (
                    <>
                      <span className="sparkle-text">{t('welcomeTitle')}</span>
                      <span className="inline-block ml-2 animate-pulse">&#10024;</span>
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
                  icon="&#10024;"
                  text={t('promptDesign')}
                  onClick={() => handlePromptClick(t('promptDesign'))}
                />
                <SuggestedPrompt
                  icon="&#128085;"
                  text={t('promptTshirt')}
                  onClick={() => handlePromptClick(t('promptTshirt'))}
                />
                <SuggestedPrompt
                  icon="&#127912;"
                  text={t('promptTrending')}
                  onClick={() => handlePromptClick(t('promptTrending'))}
                />
                <SuggestedPrompt
                  icon="&#127873;"
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
                    if (part.type === 'text') {
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

                    if (isToolUIPart(part)) {
                      const toolName = getToolName(part)
                      const artifact = getArtifact(toolName)
                      if (!artifact) return null

                      if (part.state === 'input-streaming' || part.state === 'input-available') {
                        return <artifact.Skeleton key={index} />
                      }

                      if (part.state === 'output-available' && part.output) {
                        const output = part.output as any

                        // Handle approval workflow for checkout (tool returned needsApproval: true)
                        if (output.needsApproval && toolName === 'create_checkout') {
                          const handleApprove = async () => {
                            try {
                              // Call the checkout API directly
                              const response = await fetch('/api/checkout/create-session', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  cartItems: output.cartItems?.map((item: any) => ({
                                    product_id: item.productId,
                                    product_name: item.productName,
                                    product_price: item.productPrice,
                                    product_image: null,
                                    quantity: item.quantity,
                                  })),
                                  locale: 'en',
                                  currency: 'usd',
                                }),
                              })

                              if (response.ok) {
                                const data = await response.json()
                                if (data.url) {
                                  window.location.href = data.url
                                }
                              } else {
                                sendMessage({ text: 'There was an error creating the checkout session. Please try again.' })
                              }
                            } catch (error) {
                              console.error('Checkout error:', error)
                              sendMessage({ text: 'There was an error creating the checkout session. Please try again.' })
                            }
                          }
                          const handleDeny = () => {
                            sendMessage({ text: 'Checkout cancelled.' })
                          }

                          return (
                            <div key={index} className="p-4">
                              <artifact.Component
                                {...output}
                                onApprove={handleApprove}
                                onDeny={handleDeny}
                                variant="inline"
                              />
                            </div>
                          )
                        }

                        // Handle approval workflow for return request
                        if (output.needsApproval && toolName === 'request_return') {
                          const handleApprove = async (reason: string) => {
                            try {
                              // Call the return request API directly
                              const response = await fetch(`/api/orders/${output.orderId}/returns`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  reason,
                                }),
                              })

                              if (response.ok) {
                                const data = await response.json()
                                sendMessage({ text: `Return request submitted successfully! Your request ID is ${data.return_request?.id?.slice(0, 8)}. You'll receive an email confirmation shortly.` })
                              } else {
                                const error = await response.json()
                                sendMessage({ text: `Failed to submit return request: ${error.error || 'Unknown error'}` })
                              }
                            } catch (error) {
                              console.error('Return request error:', error)
                              sendMessage({ text: 'There was an error submitting your return request. Please try again.' })
                            }
                          }
                          const handleDeny = () => {
                            sendMessage({ text: 'Return request cancelled.' })
                          }

                          return (
                            <div key={index} className="p-4">
                              <artifact.Component
                                {...output}
                                onApprove={handleApprove}
                                onDeny={handleDeny}
                                variant="inline"
                              />
                            </div>
                          )
                        }

                        // Handle successful checkout redirect (not needed anymore since we redirect directly)
                        if (output.checkoutUrl && toolName === 'confirm_checkout') {
                          // Redirect to Stripe checkout
                          window.location.href = output.checkoutUrl
                          return null
                        }

                        // Don't render artifact if tool execution failed
                        if (output.success === false) {
                          return null
                        }

                        return (
                          <div key={index} className="p-4">
                            <artifact.Component
                              {...output}
                              onSelectProduct={setSelectedProduct}
                              variant="inline"
                            />
                          </div>
                        )
                      }

                      if (part.state === 'output-error') {
                        return <div key={index} className="p-4 text-sm text-destructive">Error loading results</div>
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
            <Button type="button" variant="ghost" size="icon" className="flex-shrink-0">
              <Mic className="h-5 w-5" />
              <span className="sr-only">Voice input</span>
            </Button>

            <div className="flex-1 relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('inputPlaceholder')}
                className="pr-20 min-h-[44px] resize-none"
                disabled={isLoading}
              />
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
