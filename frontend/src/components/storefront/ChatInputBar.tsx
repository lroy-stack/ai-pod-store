'use client'

/**
 * ChatInputBar — Chat input with voice, image upload, submit, and prompt chips
 *
 * Mobile-first layout like ChatGPT/Claude:
 * - Horizontal scrollable prompt chips above input (when no messages)
 * - Compact input bar with attach, voice, send
 * - flex-shrink-0 pinned by flexbox (NOT sticky)
 */

import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, X, Mic } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { toast } from 'sonner'

export interface PromptSuggestion {
  icon: string
  text: string
  prompt: string
}

export interface FileAttachment {
  url: string
  mimeType: string
  filename: string
}

interface ChatInputBarProps {
  onSubmit: (text: string, file: FileAttachment | null) => void
  isLoading: boolean
  isLimitReached: boolean
  isLoggedIn: boolean
  locale: string
  selectedImage: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAttachClick: () => void
  onRemoveImage: () => void
  suggestions?: PromptSuggestion[]
  onSuggestionClick?: (prompt: string) => void
}

export function ChatInputBar({
  onSubmit,
  isLoading,
  isLimitReached,
  isLoggedIn,
  locale: _locale,
  selectedImage,
  fileInputRef,
  onImageSelect,
  onAttachClick,
  onRemoveImage,
  suggestions,
  onSuggestionClick,
}: ChatInputBarProps) {
  const t = useTranslations('storefront')
  const tEngagement = useTranslations('engagement.chat')
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-focus input after loading completes
  useEffect(() => {
    if (!isLoading && !isLimitReached) {
      inputRef.current?.focus()
    }
  }, [isLoading, isLimitReached])

  // Voice input via MediaRecorder → Gemini
  const {
    isSupported: isVoiceSupported,
    isRecording,
    startRecording,
    stopRecording,
  } = useVoiceInput({
    onAudioReady: (dataUrl, mimeType) => {
      onSubmit('', {
        url: dataUrl,
        mimeType,
        filename: `voice-message.${mimeType.split('/')[1] || 'ogg'}`,
      })
    },
    onError: (error) => {
      toast.error(error)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() && !selectedImage) return
    if (selectedImage) {
      onSubmit(inputValue.trim(), {
        url: selectedImage,
        mimeType: 'image/png',
        filename: 'uploaded-image.png',
      })
    } else {
      onSubmit(inputValue.trim(), null)
    }
    setInputValue('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex-shrink-0 z-10 px-3 pb-2 pt-1 sm:px-4 md:px-6 md:pb-3 md:pt-2">
      <div className="max-w-4xl mx-auto">
        {/* Prompt chips */}
        {suggestions && suggestions.length > 0 && onSuggestionClick && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
            {suggestions.map((s) => (
              <button
                key={s.prompt}
                onClick={() => onSuggestionClick(s.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-card/80 hover:bg-muted/60 hover:border-border text-xs font-medium text-foreground whitespace-nowrap transition-colors shrink-0 active:scale-95"
              >
                <span className="text-sm">{s.icon}</span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        )}

        <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl shadow-lg px-2.5 py-2 sm:px-4 sm:py-3">
          {/* Image Preview */}
          {selectedImage && (
            <div className="mb-2 relative inline-block">
              <img
                src={selectedImage}
                alt="Selected"
                className="h-14 w-14 object-cover rounded-lg border border-border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={onRemoveImage}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-1 sm:gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onImageSelect}
              className="hidden"
              aria-label="Upload image"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onAttachClick}
              className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Attach</span>
            </Button>

            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording
                  ? t('recording')
                  : isLimitReached
                    ? (isLoggedIn ? tEngagement('limitReachedFree') : tEngagement('limitReached'))
                    : t('inputPlaceholder')
              }
              aria-label="Chat with AI assistant"
              className={`flex-1 min-h-[36px] sm:min-h-[40px] border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 text-base sm:text-sm ${isLimitReached ? 'opacity-50' : ''}`}
              disabled={isLoading || isLimitReached || isRecording}
            />

            {isVoiceSupported && (
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
                className={`flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full ${
                  isRecording
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                disabled={isLoading}
                aria-label={isRecording ? t('stopRecording') : t('startRecording')}
              >
                <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} aria-hidden="true" />
              </Button>
            )}

            <Button
              type="submit"
              size="icon"
              className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full"
              disabled={isLoading || isLimitReached || isRecording || (!inputValue.trim() && !selectedImage)}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>

        <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-1.5 px-2">
          {t('aiDisclaimer')}
        </p>
      </div>
    </div>
  )
}
