'use client'

/**
 * ChatArea - Center panel with message history + input
 *
 * Contains:
 * - Chat header with search, notifications, cart, avatar
 * - Welcome screen for new conversations
 * - Message history (scrollable)
 * - Input area with voice + image upload
 *
 * Future: AI SDK integration with useChat(), message streaming, artifact rendering
 */

import { useTranslations } from 'next-intl'
import { Search, Bell, ShoppingCart, User, Send, Mic, Paperclip } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface ChatAreaProps {
  onSelectProduct: (productId: string) => void
}

export function ChatArea({ onSelectProduct }: ChatAreaProps) {
  const t = useTranslations('storefront')

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
        {/* Welcome Screen */}
        <div className="max-w-2xl mx-auto">
          <div className="text-center space-y-6 py-12">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60">
              <span className="text-3xl font-bold text-primary-foreground">P</span>
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {t('welcomeTitle')}
              </h1>
              <p className="text-muted-foreground">
                {t('welcomeSubtitle')}
              </p>
            </div>

            {/* Suggested Prompts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl mx-auto mt-8">
              <SuggestedPrompt
                icon="✨"
                text={t('promptDesign')}
              />
              <SuggestedPrompt
                icon="👕"
                text={t('promptTshirt')}
              />
              <SuggestedPrompt
                icon="🎨"
                text={t('promptTrending')}
              />
              <SuggestedPrompt
                icon="🎁"
                text={t('promptGift')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            {/* Voice Input */}
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Mic className="h-5 w-5" />
              <span className="sr-only">Voice input</span>
            </Button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <Input
                placeholder={t('inputPlaceholder')}
                className="pr-20 min-h-[44px] resize-none"
              />
              {/* Image Upload */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-10 top-1/2 -translate-y-1/2"
              >
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach image</span>
              </Button>
            </div>

            {/* Send Button */}
            <Button size="icon" className="flex-shrink-0">
              <Send className="h-5 w-5" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>

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
function SuggestedPrompt({ icon, text }: { icon: string; text: string }) {
  return (
    <button className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-left">
      <span className="text-2xl">{icon}</span>
      <span className="text-sm text-foreground">{text}</span>
    </button>
  )
}
