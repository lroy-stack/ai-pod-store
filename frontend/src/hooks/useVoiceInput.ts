'use client'

/**
 * useVoiceInput — Record audio via MediaRecorder for Gemini transcription
 *
 * Replaces useSpeechToText (Web Speech API) which doesn't work in production
 * due to CSP/Cloudflare blocking Google's speech servers.
 *
 * Flow: MediaRecorder → audio blob → base64 data URL → sent as file to Gemini
 * Gemini transcribes + responds in a single API call.
 *
 * Audio format priority (must be supported by both browser AND Gemini):
 *   1. audio/ogg;codecs=opus — Chrome, Firefox (Gemini: OGG Vorbis ✓)
 *   2. audio/mp4             — Safari (Gemini: AAC ✓)
 *   3. audio/webm            — Chrome fallback (Gemini: NOT supported, but
 *                              AI SDK may handle conversion)
 */

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVoiceInputOptions {
  onAudioReady: (dataUrl: string, mimeType: string) => void
  onError?: (message: string) => void
}

/** Select the best mimeType supported by both browser and Gemini */
function selectMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null

  const preferred = [
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
  ]

  for (const type of preferred) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }

  return null
}

export function useVoiceInput({ onAudioReady, onError }: UseVoiceInputOptions) {
  const [isSupported, setIsSupported] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef<string>('')
  const onAudioReadyRef = useRef(onAudioReady)
  const onErrorRef = useRef(onError)

  // Keep callback refs current
  useEffect(() => {
    onAudioReadyRef.current = onAudioReady
    onErrorRef.current = onError
  })

  // Check support on mount
  useEffect(() => {
    const supported = typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined' &&
      !!selectMimeType()
    setIsSupported(supported)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const mimeType = selectMimeType()
      if (!mimeType) {
        onErrorRef.current?.('Voice input not supported in this browser.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mimeTypeRef.current = mimeType

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop())

        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size === 0) {
          onErrorRef.current?.('No audio recorded.')
          return
        }

        // Convert blob to base64 data URL
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          // Normalize mimeType for the file attachment
          const simpleMime = mimeType.split(';')[0] // "audio/ogg" from "audio/ogg;codecs=opus"
          onAudioReadyRef.current(dataUrl, simpleMime)
        }
        reader.readAsDataURL(blob)
      }

      recorder.onerror = () => {
        setIsRecording(false)
        stream.getTracks().forEach(track => track.stop())
        onErrorRef.current?.('Recording failed.')
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (err) {
      setIsRecording(false)
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        onErrorRef.current?.('Microphone access denied. Please enable microphone permissions.')
      } else {
        onErrorRef.current?.('Failed to start recording.')
      }
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  return { isSupported, isRecording, startRecording, stopRecording }
}
