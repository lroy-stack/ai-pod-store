'use client'

/**
 * ChatMessages — Renders message history with tool artifacts
 *
 * Extracted from ChatArea.tsx (Commit 5).
 * Fixes applied:
 * - CF-12: output.success === false shows error message instead of returning null
 * - CF-10: Checkout handler uses locale prop
 */

import { useEffect } from 'react'
import { User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BRAND } from '@/lib/store-config'
import { isToolUIPart, getToolName } from 'ai'
import { SafeMarkdown } from '@/components/common/SafeMarkdown'
import { getArtifact } from '@/components/artifacts/registry'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MessageActions } from '@/components/chat/MessageActions'
import { useAuth } from '@/hooks/useAuth'
import { apiFetch } from '@/lib/api-fetch'

interface ChatMessagesProps {
  messages: any[]
  isLoading: boolean
  error: Error | undefined
  sendMessage: (opts: { text: string }) => void
  onSelectProduct: (productId: string, productData?: any) => void
  onAddToCart: (productId: string, title?: string, price?: number, variants?: { size?: string; color?: string }) => void
  onAddToWishlist: (productId: string) => void
  locale: string
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  conversationId?: string | null
}

export function ChatMessages({
  messages,
  isLoading,
  error,
  sendMessage,
  onSelectProduct,
  onAddToCart,
  onAddToWishlist,
  locale,
  messagesEndRef,
  conversationId,
}: ChatMessagesProps) {
  const t = useTranslations('storefront')
  const { authenticated } = useAuth()

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {messages.map((message, msgIdx) => {
        const messageText = message.parts
          ?.filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n') || ''

        const isLastAssistant = message.role === 'assistant' &&
          msgIdx === messages.length - 1

        return (
        <div
          key={message.id}
          className={`group flex gap-3 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {message.role === 'assistant' && (
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={BRAND.logoLight} alt={BRAND.name} className="dark:hidden p-1" />
              <AvatarImage src={BRAND.logoDark} alt={BRAND.name} className="hidden dark:block p-1" />
              <AvatarFallback className="bg-muted text-muted-foreground text-sm">{BRAND.name[0]}</AvatarFallback>
            </Avatar>
          )}
          <div
            className={
              message.role === 'user'
                ? 'rounded-2xl bg-primary text-primary-foreground px-4 py-2 max-w-[80%]'
                : 'flex-1 min-w-0 space-y-2'
            }
          >
            {message.parts.map((part: any, index: number) => {
              if (part.type === 'text') {
                if (message.role === 'assistant') {
                  return (
                    <div key={index} className="bg-muted rounded-2xl w-fit max-w-full prose prose-sm dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 px-4 py-2.5">
                      <SafeMarkdown>{part.text}</SafeMarkdown>
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
                return (
                  <ToolArtifact
                    key={index}
                    part={part}
                    sendMessage={sendMessage}
                    onSelectProduct={onSelectProduct}
                    onAddToCart={onAddToCart}
                    onAddToWishlist={onAddToWishlist}
                    locale={locale}
                    t={t}
                  />
                )
              }

              return null
            })}

            {/* Message Actions — hover toolbar */}
            {messageText && !isLoading && (
              <MessageActions
                messageId={message.id}
                conversationId={conversationId || null}
                role={message.role}
                text={messageText}
                onRetry={isLastAssistant ? () => {
                  // Find the last user message and resend it
                  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
                  if (lastUserMsg) {
                    const userText = lastUserMsg.parts?.find((p: any) => p.type === 'text')?.text
                    if (userText) sendMessage({ text: userText })
                  }
                } : undefined}
                isAuthenticated={authenticated}
              />
            )}
          </div>
          {message.role === 'user' && (
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-muted text-muted-foreground">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        )
      })}

      {/* Typing Indicator */}
      {isLoading && (
        <div className="flex gap-3 justify-start">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={BRAND.logoLight} alt={BRAND.name} className="dark:hidden p-1" />
            <AvatarImage src={BRAND.logoDark} alt={BRAND.name} className="hidden dark:block p-1" />
            <AvatarFallback className="bg-muted text-muted-foreground text-sm">{BRAND.name[0]}</AvatarFallback>
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
  )
}

// --- Internal: Tool artifact renderer ---

function ToolArtifact({
  part,
  sendMessage,
  onSelectProduct,
  onAddToCart,
  onAddToWishlist,
  locale,
  t,
}: {
  part: any
  sendMessage: (opts: { text: string }) => void
  onSelectProduct: (productId: string, productData?: any) => void
  onAddToCart: (productId: string, title?: string, price?: number, variants?: { size?: string; color?: string }) => void
  onAddToWishlist: (productId: string) => void
  locale: string
  t: ReturnType<typeof useTranslations>
}) {
  const toolName = getToolName(part)
  const artifact = getArtifact(toolName)
  if (!artifact) return null

  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return <artifact.Skeleton />
  }

  if (part.state === 'output-available' && part.output) {
    const output = part.output as any

    // Checkout approval workflow
    if (output.needsApproval && toolName === 'create_checkout') {
      const handleApprove = async () => {
        try {
          const response = await apiFetch('/api/checkout/create-session', {
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
              locale,
              currency: 'eur',
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
        } catch (err) {
          console.error('Checkout error:', err)
          sendMessage({ text: 'There was an error creating the checkout session. Please try again.' })
        }
      }

      return (
        <div className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <artifact.Component
            {...output}
            onApprove={handleApprove}
            onDeny={() => sendMessage({ text: 'Checkout cancelled.' })}
            variant="inline"
          />
        </div>
      )
    }

    // Return request approval workflow
    if (output.needsApproval && toolName === 'request_return') {
      const handleApprove = async (reason: string) => {
        try {
          const response = await apiFetch(`/api/orders/${output.orderId}/returns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          })

          if (response.ok) {
            const data = await response.json()
            sendMessage({ text: `Return request submitted successfully! Your request ID is ${data.return_request?.id?.slice(0, 8)}. You'll receive an email confirmation shortly.` })
          } else {
            try {
              const errData = await response.json()
              sendMessage({ text: `Failed to submit return request: ${errData.error || 'Unknown error'}` })
            } catch {
              sendMessage({ text: `Failed to submit return request: HTTP ${response.status}` })
            }
          }
        } catch (err) {
          console.error('Return request error:', err)
          sendMessage({ text: 'There was an error submitting your return request. Please try again.' })
        }
      }

      return (
        <div className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <artifact.Component
            {...output}
            onApprove={handleApprove}
            onDeny={() => sendMessage({ text: 'Return request cancelled.' })}
            variant="inline"
          />
        </div>
      )
    }

    // Direct checkout redirect — render a redirect component to avoid side effects in render
    if (output.checkoutUrl && toolName === 'confirm_checkout') {
      return <CheckoutRedirect url={output.checkoutUrl} />
    }

    // Upgrade upsell for design/mockup limit reached
    if (output.success === false && output.requiresUpgrade) {
      return <UpgradeUpsellCard error={output.error} />
    }

    // CF-12 fix: Show error message for failed tool executions
    if (output.success === false) {
      return (
        <div className="text-destructive text-sm px-4 py-2">
          {output.error || t('errorLoadingResults')}
        </div>
      )
    }

    return (
      <div className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <artifact.Component
          {...output}
          onSelectProduct={onSelectProduct}
          onAddToCart={(id: string, title?: string, price?: number, variants?: { size?: string; color?: string }) => onAddToCart(id, title, price, variants)}
          onAddToWishlist={onAddToWishlist}
          onSendMessage={(text: string) => sendMessage({ text })}
          variant="inline"
        />
      </div>
    )
  }

  if (part.state === 'output-error') {
    return <div className="p-4 text-sm text-destructive">{t('errorLoadingResults')}</div>
  }

  return null
}

// --- Internal: Upgrade upsell card for design/mockup limit ---

function UpgradeUpsellCard({ error }: { error?: string }) {
  const t = useTranslations('pricing')
  const params = useParams()
  const locale = (params.locale as string) || 'en'

  return (
    <div className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="max-w-sm border-primary/30">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Crown className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {error || t('creditPacksDesc')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href={`/${locale}/pricing`}>
                {t('upgradeNow')}
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/${locale}/pricing#credits`}>
                {t('buyCredits')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Internal: Safe redirect via useEffect (not side effect in render) ---

function CheckoutRedirect({ url }: { url: string }) {
  useEffect(() => {
    window.location.href = url
  }, [url])
  return (
    <div className="p-4 text-sm text-muted-foreground">
      Redirecting to checkout...
    </div>
  )
}
