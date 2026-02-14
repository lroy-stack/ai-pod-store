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
import { Search, Bell, ShoppingCart, User, Send, Mic, Paperclip } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useChat } from '@ai-sdk/react'

interface ChatAreaProps {
  onSelectProduct: (productId: string) => void
}

export function ChatArea({ onSelectProduct }: ChatAreaProps) {
  const t = useTranslations('storefront')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')

  // AI SDK 6 useChat hook with streaming
  const { messages, sendMessage, status } = useChat()

  const isLoading = status === 'streaming' || status === 'awaiting-message'

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    sendMessage(inputValue)
    setInputValue('')
  }

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt)
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
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
