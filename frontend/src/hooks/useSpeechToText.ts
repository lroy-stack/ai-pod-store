'use client'

/**
 * useSpeechToText Hook
 *
 * Web Speech API integration for voice input in chat.
 * Supports locale-aware recognition (EN/ES/DE).
 *
 * Browser Support:
 * - Chrome/Edge: Full support
 * - Safari: Limited support
 * - Firefox: No support (as of 2026)
 *
 * Progressive enhancement: If not supported, hook returns { isSupported: false }
 */

import { useState, useEffect, useCallback, useRef } from 'react'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition
    }
    webkitSpeechRecognition: {
      new (): SpeechRecognition
    }
  }
}

export interface UseSpeechToTextOptions {
  locale?: string
  continuous?: boolean
  interimResults?: boolean
  onTranscript?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
}

// Map locale codes to Speech Recognition language codes
const getLanguageCode = (loc: string): string => {
  const localeMap: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
  }
  const lang = loc.split('-')[0].toLowerCase()
  return localeMap[lang] || 'en-US'
}

export function useSpeechToText({
  locale = 'en-US',
  continuous = false,
  interimResults = true,
  onTranscript,
  onError,
}: UseSpeechToTextOptions = {}) {
  const [isSupported, setIsSupported] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)

  // Keep callback refs current without re-creating recognition
  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onErrorRef.current = onError
  })

  // Create recognition instance once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognitionAPI)

    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = getLanguageCode(locale)

    recognition.onstart = () => {
      setIsRecording(true)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsRecording(false)

      // "not-allowed" and "no-speech" are expected user-facing conditions, not code errors
      if (event.error === 'not-allowed' || event.error === 'no-speech' || event.error === 'aborted') {
        console.warn('Speech recognition:', event.error)
      } else {
        console.error('Speech recognition error:', event.error)
      }

      let errorMessage = 'Voice input failed'
      if (event.error === 'not-allowed') {
        errorMessage = 'Microphone access denied. Please enable microphone permissions.'
      } else if (event.error === 'no-speech') {
        errorMessage = 'No speech detected. Please try again.'
      } else if (event.error === 'aborted') {
        // User or system aborted — no need to show error
        return
      } else if (event.error === 'network') {
        errorMessage = 'Network error. Please check your connection.'
      }

      onErrorRef.current?.(errorMessage)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimT = ''
      let finalT = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript

        if (result.isFinal) {
          finalT += text + ' '
        } else {
          interimT += text
        }
      }

      if (finalT) {
        setTranscript((prev) => prev + finalT)
        onTranscriptRef.current?.(finalT.trim(), true)
      } else if (interimT) {
        onTranscriptRef.current?.(interimT, false)
      }
    }

    recognitionRef.current = recognition

    return () => {
      recognition.abort()
      recognitionRef.current = null
    }
  }, [locale, continuous, interimResults])

  const startRecording = useCallback(async () => {
    if (!isSupported || !recognitionRef.current) {
      onErrorRef.current?.('Speech recognition not supported in this browser')
      return
    }

    // Request microphone permission before starting
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onErrorRef.current?.('Microphone access denied. Please enable microphone permissions.')
      return
    }

    try {
      setTranscript('')
      recognitionRef.current.start()
    } catch (error) {
      // InvalidStateError if already started — safe to ignore
      if (error instanceof DOMException && error.name === 'InvalidStateError') return
      console.error('Failed to start recording:', error)
      onErrorRef.current?.('Failed to start voice input')
    }
  }, [isSupported])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
    }
  }, [isRecording])

  const resetTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    isSupported,
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    resetTranscript,
  }
}
