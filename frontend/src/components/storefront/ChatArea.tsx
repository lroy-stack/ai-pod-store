'use client'

/**
 * ChatArea — Orchestrator for chat UI
 *
 * Composed from:
 * - useChatSession (persistence, TTL, conversation ID)
 * - useChatTransport (AI SDK, CSRF, engagement)
 * - useImageUpload (image selection, drag-drop)
 * - ChatWelcome (welcome screen)
 * - ChatMessages (message history + tool artifacts)
 * - ChatInputBar (input, voice, image preview)
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useStorefront } from './StorefrontContext'
import { useChatMessage } from './ChatMessageContext'
import { useCart } from '@/hooks/useCart'
import { useWishlist } from '@/hooks/useWishlist'
import { useChatSession } from '@/hooks/useChatSession'
import { useChatTransport } from '@/hooks/useChatTransport'
import { useImageUpload } from '@/hooks/useImageUpload'
import { ChatWelcome } from './ChatWelcome'
import { ChatMessages } from './ChatMessages'
import { ChatInputBar, type PromptSuggestion } from './ChatInputBar'
import { SignupBanner } from '@/components/engagement/SignupBanner'
import { useChatHistory } from '@/components/chat/ChatHistoryContext'
import { ChatHistoryList } from '@/components/chat/ChatHistoryList'
import { AuthWallModal } from '@/components/engagement/AuthWallModal'
import { UpgradeModal } from '@/components/engagement/UpgradeModal'
import { History, SquarePen } from 'lucide-react'
import { apiFetch } from '@/lib/api-fetch'

export function ChatArea() {
  const t = useTranslations('storefront')
  const tEngagement = useTranslations('engagement.chat')
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const { user, loading: authLoading } = useAuth()
  const { setSelectedProduct, addArtifact } = useStorefront()
  const { pendingChatMessage, setPendingChatMessage } = useChatMessage()
  const { addToCart } = useCart()
  const { toggleWishlist } = useWishlist()

  // User data for welcome screen (orders + favorites, loaded after auth resolves)
  const [userData, setUserData] = useState<{
    activeOrders: Array<{ id: string; status: string; total: number }> | null
    recentFavorites: Array<{ id: string; name: string; price: number }> | null
  }>({ activeOrders: null, recentFavorites: null })

  useEffect(() => {
    if (authLoading || !user) return
    async function fetchSideData() {
      try {
        const [ordersRes, favoritesRes] = await Promise.all([
          fetch('/api/orders?limit=3&status=processing,pending'),
          fetch('/api/wishlist'),
        ])
        const orders = ordersRes.ok ? await ordersRes.json() : null
        const favorites = favoritesRes.ok ? await favoritesRes.json() : null
        const recentItems = favorites?.wishlists
          ?.flatMap((w: any) => w.wishlist_items || [])
          ?.slice(0, 3)
          ?.map((item: any) => ({
            id: item.product_id,
            name: item.products?.title || '',
            price: item.products?.price || 0,
            image: item.products?.image || null,
          })) || null
        setUserData({ activeOrders: orders?.orders || null, recentFavorites: recentItems })
      } catch (_e) { /* welcome screen data is non-critical */ }
    }
    fetchSideData()
  }, [user, authLoading])

  // Session persistence
  const { initialMessages, conversationIdRef, persistMessages, persistConversationId, sessionExpired, dbLoading, loadConversation, startNewChat } = useChatSession(!!user, user?.id ?? null)

  // Chat transport (AI SDK, CSRF, engagement)
  const {
    messages, setMessages, sendMessage, status, error, isLoading,
    showAuthWall, setShowAuthWall, showUpgrade, setShowUpgrade, isLimitReached,
  } = useChatTransport({
    initialMessages,
    conversationIdRef,
    persistConversationId,
    userName: user?.name ?? null,
  })

  // Image upload
  const image = useImageUpload()

  // Auto-scroll — only on new messages, respects user scroll position
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const userScrolledUpRef = useRef(false)

  const handleScroll = useCallback(() => {
    const c = scrollContainerRef.current
    if (!c) return
    userScrolledUpRef.current = (c.scrollHeight - c.scrollTop - c.clientHeight) > 150
  }, [])

  useEffect(() => {
    if (userScrolledUpRef.current) return
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [messages.length])

  // Clear messages when session expires (one-shot — no loop risk)
  useEffect(() => {
    if (sessionExpired && messages.length > 0) {
      setMessages([])
    }
  }, [sessionExpired, messages.length, setMessages])

  // Persist messages to sessionStorage (debounced via useChatSession)
  useEffect(() => {
    if (!sessionExpired) {
      persistMessages(messages)
    }
  }, [messages, persistMessages, sessionExpired])

  // Pending message from DetailPanel
  useEffect(() => {
    if (pendingChatMessage) {
      sendMessage({ text: pendingChatMessage })
      setPendingChatMessage('')
    }
  }, [pendingChatMessage, setPendingChatMessage, sendMessage])

  // Handlers
  const handlePromptClick = useCallback(
    (prompt: string) => sendMessage({ text: prompt }),
    [sendMessage]
  )

  // Prompt suggestions for the input bar (shown when no messages)
  const suggestions: PromptSuggestion[] = messages.length === 0 ? [
    { icon: '✨', text: t('promptDesign'), prompt: t('promptDesign') },
    { icon: '👕', text: t('promptTshirt'), prompt: t('promptTshirt') },
    { icon: '🎨', text: t('promptTrending'), prompt: t('promptTrending') },
    { icon: '🎁', text: t('promptGift'), prompt: t('promptGift') },
  ] : []

  const handleAddToCart = useCallback(
    async (productId: string, title?: string, price?: number, variants?: { size?: string; color?: string }) => {
      try {
        await addToCart(productId, 1, variants, title, price)
      } catch (error: any) {
        if (error?.code === 'VARIANT_REQUIRED') {
          setSelectedProduct(productId)
        }
      }
    },
    [addToCart, setSelectedProduct]
  )

  const handleSelectProduct = useCallback(
    (productId: string, productData?: any) => {
      setSelectedProduct(productId)
      if (productData) {
        addArtifact({
          id: productId,
          type: 'product' as const,
          title: productData.title || `Product #${productId.slice(0, 8)}`,
          data: productData,
        })
      }
    },
    [setSelectedProduct, addArtifact]
  )

  const handleSubmit = useCallback(
    (text: string, file: { url: string; mimeType: string; filename: string } | null) => {
      // Reset scroll lock so auto-scroll works for the new message
      userScrolledUpRef.current = false

      if (file) {
        sendMessage({
          text: text || (file.mimeType.startsWith('audio/') ? '' : 'Analyze this image'),
          files: [
            {
              type: 'file',
              filename: file.filename,
              mediaType: file.mimeType,
              url: file.url,
            },
          ],
        })
      } else {
        sendMessage({ text })
      }
      image.setSelectedImage(null)

      // Scroll to bottom immediately
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    },
    [sendMessage, image]
  )

  // --- Chat history handlers (exposed to sidebar via StorefrontLayout) ---
  const handleLoadConversation = useCallback(async (convId: string) => {
    const msgs = await loadConversation(convId)
    if (msgs) setMessages(msgs as any)
  }, [loadConversation, setMessages])

  const handleStartNewChat = useCallback(() => {
    startNewChat()
    setMessages([])
  }, [startNewChat, setMessages])

  const handleDeleteConversation = useCallback(async (convId: string) => {
    try {
      await apiFetch(`/api/conversations/${convId}`, { method: 'DELETE', credentials: 'include' })
      if (conversationIdRef.current === convId) handleStartNewChat()
    } catch { /* non-critical */ }
  }, [conversationIdRef, handleStartNewChat])

  // Register handlers with ChatHistoryContext so sidebar can trigger them
  const { registerHandlers, setActiveConversationId, viewMode, setViewMode } = useChatHistory()
  useEffect(() => {
    registerHandlers({
      onLoad: handleLoadConversation,
      onNew: handleStartNewChat,
      onDelete: handleDeleteConversation,
    })
  }, [registerHandlers, handleLoadConversation, handleStartNewChat, handleDeleteConversation])

  // Sync active conversation ID to context
  useEffect(() => {
    setActiveConversationId(conversationIdRef.current)
  }, [messages.length, setActiveConversationId])

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      onDragOver={image.handleDragOver}
      onDrop={image.handleDrop}
    >
      {/* Quick actions — small pills, only for authenticated users with messages */}
      {user && messages.length > 0 && viewMode === 'chat' && (
        <div className="flex items-center gap-1.5 px-3 pt-2 sm:px-4 md:px-6">
          <button
            onClick={() => setViewMode('history')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <History className="h-3 w-3" />
            {t('chatHistory')}
          </button>
          <button
            onClick={handleStartNewChat}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <SquarePen className="h-3 w-3" />
            {t('newChat')}
          </button>
        </div>
      )}

      {/* Scrollable messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
        onScroll={handleScroll}
      >
        <div className="px-3 py-4 sm:px-4 md:px-6 md:py-6">
          {viewMode === 'history' && user ? (
            <ChatHistoryList
              activeConversationId={conversationIdRef.current}
              onSelectConversation={(id) => {
                handleLoadConversation(id)
                setViewMode('chat')
              }}
              onNewChat={() => {
                handleStartNewChat()
                setViewMode('chat')
              }}
              onDeleteConversation={handleDeleteConversation}
            />
          ) : messages.length === 0 ? (
            <ChatWelcome
              userName={user?.name}
              activeOrders={userData.activeOrders}
              recentFavorites={userData.recentFavorites}
            />
          ) : (
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              error={error}
              sendMessage={sendMessage}
              onSelectProduct={handleSelectProduct}
              onAddToCart={handleAddToCart}
              onAddToWishlist={toggleWishlist}
              locale={locale}
              messagesEndRef={messagesEndRef}
              conversationId={conversationIdRef.current}
            />
          )}
        </div>
      </div>

      <SignupBanner messageCount={messages.length} />

      {/* Input — OUTSIDE scroll container */}
      <ChatInputBar
        onSubmit={handleSubmit}
        isLoading={isLoading}
        isLimitReached={isLimitReached}
        isLoggedIn={!!user}
        locale={locale}
        selectedImage={image.selectedImage}
        fileInputRef={image.fileInputRef}
        onImageSelect={image.handleImageSelect}
        onAttachClick={image.handleAttachClick}
        onRemoveImage={image.handleRemoveImage}
        suggestions={suggestions}
        onSuggestionClick={handlePromptClick}
      />

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
