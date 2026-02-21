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

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { User, Send, Paperclip, Package, Heart, X, Mic } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isToolUIPart, getToolName } from 'ai'
import ReactMarkdown from 'react-markdown'
import { getArtifact } from '@/components/artifacts/registry'
import { toast } from 'sonner'
import { useStorefront } from './StorefrontContext'
import { useCart } from '@/hooks/useCart'
import { useWishlist } from '@/hooks/useWishlist'
import { SignupBanner } from '@/components/engagement/SignupBanner'
import { AuthWallModal } from '@/components/engagement/AuthWallModal'
import { UpgradeModal } from '@/components/engagement/UpgradeModal'
import { useSpeechToText } from '@/hooks/useSpeechToText'
import { useParams } from 'next/navigation'

type SerializedMessage = {
  id: string
  role: 'user' | 'assistant'
  parts: Array<{ type: 'text'; text: string }>
  createdAt?: string
}

function serializeMessages(messages: Array<{ id: string; role: string; parts: Array<{ type: string; [key: string]: any }>; createdAt?: Date | string }>): string {
  const slim: SerializedMessage[] = messages.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    parts: m.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => ({ type: 'text' as const, text: p.text })),
    createdAt: m.createdAt ? String(m.createdAt) : undefined,
  }))
  return JSON.stringify(slim)
}

const CHAT_TTL_MS = 3 * 60 * 60 * 1000 // 3 hours

function clearChatSession() {
  sessionStorage.removeItem('pod-chat-messages')
  sessionStorage.removeItem('pod-chat-ts')
  sessionStorage.removeItem('pod-conversation-id')
}

function isChatExpired(): boolean {
  const ts = sessionStorage.getItem('pod-chat-ts')
  // No timestamp = legacy session from before TTL feature → expired
  if (!ts) return true
  // Parse as numeric timestamp first; fall back to Date.parse for ISO strings
  const epoch = Number(ts) || new Date(ts).getTime()
  if (isNaN(epoch)) return true // Unparseable → treat as expired
  return Date.now() - epoch > CHAT_TTL_MS
}

function deserializeMessages(isLoggedIn: boolean): SerializedMessage[] | undefined {
  try {
    const raw = sessionStorage.getItem('pod-chat-messages')
    if (!raw) return undefined

    // Anonymous users: expire after 3 hours (or if no timestamp exists)
    if (!isLoggedIn && isChatExpired()) {
      clearChatSession()
      return undefined
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined
    return parsed
  } catch {
    return undefined
  }
}

export function ChatArea() {
  const t = useTranslations('storefront')
  const tEngagement = useTranslations('engagement.chat')
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const { setSelectedProduct, pendingChatMessage, setPendingChatMessage, addArtifact } = useStorefront()
  const { addToCart } = useCart()
  const { toggleWishlist } = useWishlist()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [userData, setUserData] = useState<{
    user: { name: string } | null
    activeOrders: Array<{ id: string; status: string; total: number }> | null
    recentFavorites: Array<{ id: string; name: string; price: number }> | null
  }>({ user: null, activeOrders: null, recentFavorites: null })

  // Restore messages from sessionStorage (read once on mount)
  // Check auth synchronously via cookie presence (userData is async)
  const [initialMessages] = useState(() => {
    const hasAuthCookie = typeof document !== 'undefined' && document.cookie.includes('sb-access-token')
    return deserializeMessages(hasAuthCookie)
  })

  // Engagement state
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [isLimitReached, setIsLimitReached] = useState(false)

  // Conversation ID tracking — persists across navigation via sessionStorage
  const conversationIdRef = useRef<string | null>(
    typeof window !== 'undefined' ? sessionStorage.getItem('pod-conversation-id') : null
  )
  const userRef = useRef<{ name: string } | null>(null)

  // Keep userRef in sync with userData
  useEffect(() => {
    userRef.current = userData.user
  }, [userData.user])

  // Custom fetch wrapper to intercept conversation ID header and engagement errors
  const customFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Inject conversation ID header if available
    const headers = new Headers(init?.headers)
    if (conversationIdRef.current) {
      headers.set('x-conversation-id', conversationIdRef.current)
    }

    const response = await fetch(input, { ...init, headers })

    // Extract conversation ID from response
    const newConvId = response.headers.get('x-conversation-id')
    if (newConvId && newConvId !== conversationIdRef.current) {
      conversationIdRef.current = newConvId
      try { sessionStorage.setItem('pod-conversation-id', newConvId) } catch {}
    }

    // Intercept engagement limit errors — show modal instead of raw error
    if (response.status === 429 || response.status === 403) {
      try {
        const cloned = response.clone()
        const body = await cloned.json()
        if (body.code === 'LIMIT_REACHED') {
          setIsLimitReached(true)
          if (!userRef.current) {
            setShowAuthWall(true)
          } else {
            setShowUpgrade(true)
          }
          // Return a fake empty SSE stream so useChat doesn't show the raw error
          return new Response('', {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          })
        }
      } catch {
        // Failed to parse body — ignore
      }
    }

    return response
  }, [])

  // AI SDK 6 useChat hook with DefaultChatTransport + custom fetch
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', fetch: customFetch }),
    [customFetch]
  )
  const { messages, setMessages, sendMessage, status, addToolApprovalResponse, error } = useChat({
    transport,
    // Restore text-only snapshots from sessionStorage; cast needed because
    // SerializedMessage is a subset of UIMessage (tool parts are omitted).
    messages: initialMessages as any,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Voice input with Web Speech API (locale-aware)
  const {
    isSupported: isSpeechSupported,
    isRecording,
    startRecording,
    stopRecording,
  } = useSpeechToText({
    locale,
    continuous: false,
    interimResults: true,
    onTranscript: (transcript, isFinal) => {
      if (isFinal) {
        // Auto-insert final transcript into input
        setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript))
      }
    },
    onError: (error) => {
      toast.error(error)
    },
  })

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

  // Check usage limits on mount to pre-block input for anonymous users
  useEffect(() => {
    async function checkUsageOnMount() {
      const hasAuth = document.cookie.includes('sb-access-token')
      if (hasAuth) return
      try {
        const res = await fetch('/api/usage/status')
        if (!res.ok) return
        const data = await res.json()
        const chatUsage = data.usage?.chat
        if (chatUsage && chatUsage.limit > 0 && chatUsage.remaining <= 0) {
          setIsLimitReached(true)
        }
      } catch {
        // Silent — fail-open for UI check (real enforcement is server-side)
      }
    }
    checkUsageOnMount()
  }, [])

  // Expire chat for anonymous users after 3h.
  // Checks on: mount, tab regain focus, window focus, and periodic interval.
  useEffect(() => {
    function checkExpiry() {
      const hasAuth = document.cookie.includes('sb-access-token')
      if (hasAuth) return
      if (isChatExpired()) {
        clearChatSession()
        setMessages([])
        conversationIdRef.current = null
      }
    }

    // Run immediately on mount to clear expired sessions before user sees them
    checkExpiry()

    function onVisibility() {
      if (document.visibilityState === 'visible') checkExpiry()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', checkExpiry)
    // Also check every 10 minutes in case tab stays in foreground
    const interval = setInterval(checkExpiry, 10 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', checkExpiry)
      clearInterval(interval)
    }
  }, [setMessages])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Persist messages to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem('pod-chat-messages', serializeMessages(messages))
        // Set timestamp on first message only (don't overwrite)
        if (!sessionStorage.getItem('pod-chat-ts')) {
          sessionStorage.setItem('pod-chat-ts', String(Date.now()))
        }
      } catch { /* quota exceeded — ignore */ }
    }
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
    if (!inputValue.trim() && !selectedImage) return

    // For AI SDK 6, we send files as FileUIPart array
    if (selectedImage) {
      sendMessage({
        text: inputValue.trim() || 'Analyze this image',
        files: [
          {
            type: 'file',
            filename: 'uploaded-image.png',
            mediaType: 'image/png',
            url: selectedImage,
          },
        ],
      })
    } else {
      sendMessage({ text: inputValue })
    }

    setInputValue('')
    setSelectedImage(null)
  }

  const handlePromptClick = (prompt: string) => {
    sendMessage({ text: prompt })
  }

  const handleAddToCart = async (productId: string, title?: string, price?: number) => {
    await addToCart(productId, 1, undefined, title, price)
  }

  const handleAddToWishlist = (productId: string) => {
    toggleWishlist(productId)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB')
      return
    }

    // Convert to base64 data URL
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result
      if (typeof result === 'string') {
        setSelectedImage(result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveImage = () => {
    setSelectedImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please drop an image file')
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be smaller than 5MB')
        return
      }

      // Convert to base64 data URL
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result
        if (typeof result === 'string') {
          setSelectedImage(result)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0 overflow-y-auto"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Messages + Input (all scrollable, input sticky at bottom) */}
      <div className="flex-1 px-3 py-4 sm:px-4 md:px-6 md:py-6">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-6 w-full max-w-2xl mx-auto">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60">
                <span className="text-3xl font-bold text-primary-foreground">P</span>
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-2">
                  {userData.user
                    ? t('welcomeBackTitle', { name: userData.user.name?.split(' ')[0] || 'there' })
                    : t('welcomeTitle')}
                </h1>
                <p className="text-muted-foreground">
                  {userData.user ? t('welcomeBackSubtitle') : t('welcomeSubtitle')}
                </p>
              </div>

              {/* Active Orders and Favorites for returning users */}
              {userData.user && (userData.activeOrders || userData.recentFavorites) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  {userData.activeOrders && userData.activeOrders.length > 0 && (
                    <div className="rounded-2xl border border-border/60 bg-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold tracking-tight">{t('activeOrders')}</h3>
                      </div>
                      <div className="space-y-2">
                        {userData.activeOrders.map((order) => (
                          <div key={order.id} className="text-xs text-left">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">#{order.id.slice(0, 8)}</span>
                              <span className="font-medium">€{order.total.toFixed(2)}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs mt-1">
                              {order.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {userData.recentFavorites && userData.recentFavorites.length > 0 && (
                    <div className="rounded-2xl border border-border/60 bg-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Heart className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold tracking-tight">{t('recentFavorites')}</h3>
                      </div>
                      <div className="space-y-2">
                        {userData.recentFavorites.map((item) => (
                          <div key={item.id} className="text-xs text-left">
                            <div className="flex justify-between">
                              <span className="text-foreground truncate">{item.name}</span>
                              <span className="font-medium">€{item.price.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Suggested Prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto mt-8">
                <SuggestedPrompt
                  icon="&#10024;"
                  text={t('promptDesign')}
                  description={t('promptDesignDesc')}
                  onClick={() => handlePromptClick(t('promptDesign'))}
                />
                <SuggestedPrompt
                  icon="&#128085;"
                  text={t('promptTshirt')}
                  description={t('promptTshirtDesc')}
                  onClick={() => handlePromptClick(t('promptTshirt'))}
                />
                <SuggestedPrompt
                  icon="&#127912;"
                  text={t('promptTrending')}
                  description={t('promptTrendingDesc')}
                  onClick={() => handlePromptClick(t('promptTrending'))}
                />
                <SuggestedPrompt
                  icon="&#127873;"
                  text={t('promptGift')}
                  description={t('promptGiftDesc')}
                  onClick={() => handlePromptClick(t('promptGift'))}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Message History */
          <div className="max-w-4xl mx-auto space-y-4">
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
                  className={
                    message.role === 'user'
                      ? 'rounded-2xl bg-primary text-primary-foreground px-4 py-2 max-w-[80%]'
                      : 'flex-1 min-w-0 space-y-2'
                  }
                >
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      if (message.role === 'assistant') {
                        return (
                          <div key={index} className="bg-muted rounded-2xl w-fit max-w-full prose prose-sm dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 px-4 py-2.5">
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

                    if (part.type === 'file' && message.role === 'user') {
                      return (
                        <img
                          key={index}
                          src={part.url}
                          alt="Uploaded image"
                          className="max-w-xs rounded-lg border border-border mt-2"
                        />
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

                        // Create a handler to add artifacts to the detail panel when clicked
                        const handleSelectProduct = (productId: string, productData?: any) => {
                          // For backward compatibility, also set selectedProduct
                          setSelectedProduct(productId)

                          // Add to artifact system with full product data when available
                          const newArtifact = {
                            id: productId,
                            type: 'product' as const,
                            title: productData?.title || `Product #${productId.slice(0, 8)}`,
                            data: productData || { id: productId },
                          }
                          addArtifact(newArtifact)
                        }

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
                            <div key={index} className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                            <div key={index} className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                          <div key={index} className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <artifact.Component
                              {...output}
                              onSelectProduct={handleSelectProduct}
                              onAddToCart={(id: string) => handleAddToCart(id)}
                              onAddToWishlist={handleAddToWishlist}
                              variant="inline"
                            />
                          </div>
                        )
                      }

                      if (part.state === 'output-error') {
                        return <div key={index} className="p-4 text-sm text-destructive">{t('errorLoadingResults')}</div>
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

            {/* Error Display */}
            {error && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-destructive text-destructive-foreground text-sm">
                    !
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg px-4 py-3 bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    {t('chatError')}
                  </p>
                  <p className="text-xs text-destructive/80 mt-1">
                    {error.message || t('chatErrorGeneric')}
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Signup Banner for guests */}
      <SignupBanner messageCount={messages.length} />

      {/* Floating Input Bar — sticky at bottom */}
      <div className="sticky bottom-0 z-10 px-3 pb-3 pt-2 sm:px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl shadow-lg px-3 py-3 sm:px-4 sm:py-3">
            {/* Image Preview */}
            {selectedImage && (
              <div className="mb-3 relative inline-block">
                <img
                  src={selectedImage}
                  alt="Selected image"
                  className="h-16 w-16 object-cover rounded-xl border border-border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only">Remove image</span>
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                aria-label="Upload image"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleAttachClick}
                className="flex-shrink-0 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Attach image</span>
              </Button>

              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isLimitReached
                    ? (userData.user ? tEngagement('limitReachedFree') : tEngagement('limitReached'))
                    : t('inputPlaceholder')
                }
                aria-label="Chat with AI assistant"
                className={`flex-1 min-h-[40px] border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 text-sm ${isLimitReached ? 'opacity-50' : ''}`}
                disabled={isLoading || isLimitReached}
              />

              {isSpeechSupported && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (isRecording) {
                      stopRecording()
                    } else {
                      startRecording()
                    }
                  }}
                  className={`flex-shrink-0 h-9 w-9 rounded-full ${
                    isRecording
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  disabled={isLoading}
                  aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                >
                  <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} aria-hidden="true" />
                  <span className="sr-only">{isRecording ? 'Stop recording' : 'Voice input'}</span>
                </Button>
              )}

              <Button
                type="submit"
                size="icon"
                className="flex-shrink-0 h-9 w-9 rounded-full"
                disabled={isLoading || isLimitReached || (!inputValue.trim() && !selectedImage)}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Send message</span>
              </Button>
            </form>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-2 px-2">
            {t('aiDisclaimer')}
          </p>
        </div>
      </div>

      {/* Engagement modals */}
      <AuthWallModal
        open={showAuthWall}
        onOpenChange={setShowAuthWall}
        reason={tEngagement('limitReached')}
        variant="wall"
      />
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        reason={tEngagement('limitReachedFree')}
      />
    </div>
  )
}

function SuggestedPrompt({
  icon,
  text,
  description,
  onClick,
}: {
  icon: string
  text: string
  description?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3.5 p-4 rounded-2xl border border-border/60 bg-card hover:bg-muted/50 hover:border-border transition-all duration-200 text-left"
    >
      <span className="text-2xl mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">{text}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
    </button>
  )
}
