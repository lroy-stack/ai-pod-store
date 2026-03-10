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
import { AuthWallModal } from '@/components/engagement/AuthWallModal'
import { UpgradeModal } from '@/components/engagement/UpgradeModal'

export function ChatArea() {
  const t = useTranslations('storefront')
  const tEngagement = useTranslations('engagement.chat')
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const { setSelectedProduct, addArtifact } = useStorefront()
  const { pendingChatMessage, setPendingChatMessage } = useChatMessage()
  const { addToCart } = useCart()
  const { toggleWishlist } = useWishlist()

  // User data for welcome screen
  const [userData, setUserData] = useState<{
    user: { name: string } | null
    activeOrders: Array<{ id: string; status: string; total: number }> | null
    recentFavorites: Array<{ id: string; name: string; price: number }> | null
  }>({ user: null, activeOrders: null, recentFavorites: null })

  useEffect(() => {
    async function fetchUserData() {
      try {
        // Check session first, then only fetch orders/wishlist if authenticated
        const sessionRes = await fetch('/api/auth/session')
        const session = await sessionRes.json()

        let orders = null
        let favorites = null

        if (session.user) {
          const [ordersRes, favoritesRes] = await Promise.all([
            fetch('/api/orders?limit=3&status=processing,pending'),
            fetch('/api/wishlist'),
          ])
          orders = ordersRes.ok ? await ordersRes.json() : null
          favorites = favoritesRes.ok ? await favoritesRes.json() : null
        }
        // Extract recent favorite items from wishlists response
        const recentItems = favorites?.wishlists
          ?.flatMap((w: any) => w.wishlist_items || [])
          ?.slice(0, 3)
          ?.map((item: any) => ({
            id: item.product_id,
            name: item.products?.title || '',
            price: (item.products?.base_price_cents || 0) / 100,
          })) || null
        setUserData({
          user: session.user || null,
          activeOrders: orders?.orders || null,
          recentFavorites: recentItems,
        })
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      }
    }
    fetchUserData()
  }, [])

  // Session persistence
  const { initialMessages, conversationIdRef, persistMessages, sessionExpired } = useChatSession(!!userData.user)

  // Chat transport (AI SDK, CSRF, engagement)
  const {
    messages, setMessages, sendMessage, status, error, isLoading,
    showAuthWall, setShowAuthWall, showUpgrade, setShowUpgrade, isLimitReached,
  } = useChatTransport({
    initialMessages,
    conversationIdRef,
    userName: userData.user?.name ?? null,
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
    async (productId: string, title?: string, price?: number) => {
      try {
        await addToCart(productId, 1, undefined, title, price)
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
    (text: string, imageData: string | null) => {
      if (imageData) {
        sendMessage({
          text: text || 'Analyze this image',
          files: [
            {
              type: 'file',
              filename: 'uploaded-image.png',
              mediaType: 'image/png',
              url: imageData,
            },
          ],
        })
      } else {
        sendMessage({ text })
      }
      image.setSelectedImage(null)
    },
    [sendMessage, image]
  )

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      onDragOver={image.handleDragOver}
      onDrop={image.handleDrop}
    >
      {/* Scrollable messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        onScroll={handleScroll}
      >
        <div className="px-3 py-4 sm:px-4 md:px-6 md:py-6">
          {messages.length === 0 ? (
            <ChatWelcome
              userName={userData.user?.name}
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
        isLoggedIn={!!userData.user}
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
