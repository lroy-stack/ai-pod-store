'use client'

/**
 * useImageUpload — Image selection, validation, and drag-and-drop for chat
 *
 * Extracted from ChatArea.tsx (Commit 5).
 * Fixes applied:
 * - CF-16: Validation deduplicated into validateAndReadImage()
 * - CF-22: alert() replaced by toast.error() from sonner
 * - SVG rejection (XSS prevention)
 * - FileReader.onerror handler
 * - Abort FileReader on unmount to prevent memory leaks
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function useImageUpload() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const readerRef = useRef<FileReader | null>(null)

  // Abort any in-flight FileReader on unmount
  useEffect(() => {
    return () => {
      if (readerRef.current) {
        readerRef.current.abort()
        readerRef.current = null
      }
    }
  }, [])

  // Shared validation + FileReader logic
  const validateAndReadImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    // Reject SVG — can contain embedded JavaScript (XSS risk)
    if (file.type === 'image/svg+xml' || file.name?.endsWith('.svg')) {
      toast.error('SVG files are not supported')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be smaller than 5MB')
      return
    }

    // Abort previous read if still in progress
    if (readerRef.current) readerRef.current.abort()

    const reader = new FileReader()
    readerRef.current = reader
    reader.onload = (event) => {
      const result = event.target?.result
      if (typeof result === 'string') {
        setSelectedImage(result)
      }
      readerRef.current = null
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
      readerRef.current = null
    }
    reader.readAsDataURL(file)
  }, [])

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) validateAndReadImage(file)
    },
    [validateAndReadImage]
  )

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRemoveImage = useCallback(() => {
    setSelectedImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        validateAndReadImage(files[0])
      }
    },
    [validateAndReadImage]
  )

  return {
    selectedImage,
    setSelectedImage,
    fileInputRef,
    handleImageSelect,
    handleAttachClick,
    handleRemoveImage,
    handleDragOver,
    handleDrop,
  }
}
