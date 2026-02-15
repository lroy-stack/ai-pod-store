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

  // Check browser support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      setIsSupported(!!SpeechRecognitionAPI)

      if (SpeechRecognitionAPI && !recognitionRef.current) {
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
          console.error('Speech recognition error:', event.error)
          setIsRecording(false)

          let errorMessage = 'Voice input failed'
          if (event.error === 'not-allowed') {
            errorMessage = 'Microphone access denied. Please enable microphone permissions.'
          } else if (event.error === 'no-speech') {
            errorMessage = 'No speech detected. Please try again.'
          } else if (event.error === 'network') {
            errorMessage = 'Network error. Please check your connection.'
          }

          onError?.(errorMessage)
        }

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = ''
          let finalTranscript = ''

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            const transcriptText = result[0].transcript

            if (result.isFinal) {
              finalTranscript += transcriptText + ' '
            } else {
              interimTranscript += transcriptText
            }
          }

          // Update transcript state
          if (finalTranscript) {
            setTranscript((prev) => prev + finalTranscript)
            onTranscript?.(finalTranscript.trim(), true)
          } else if (interimTranscript) {
            onTranscript?.(interimTranscript, false)
          }
        }

        recognitionRef.current = recognition
      }
    }

    return () => {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.abort()
      }
    }
  }, [locale, continuous, interimResults, onTranscript, onError, isRecording])

  const startRecording = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      onError?.('Speech recognition not supported in this browser')
      return
    }

    try {
      // Reset transcript before starting
      setTranscript('')
      recognitionRef.current.start()
    } catch (error) {
      console.error('Failed to start recording:', error)
      onError?.('Failed to start voice input')
    }
  }, [isSupported, onError])

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
