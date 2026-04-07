'use client'

import { useRef, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

interface ImageToolProps {
  onImageAdd: (url: string) => Promise<void>
  onSVGAdd?: (svgText: string) => Promise<void>
  onUploadSuccess?: () => void
}

export function ImageTool({ onImageAdd, onSVGAdd, onUploadSuccess }: ImageToolProps) {
  const t = useTranslations('designEditor')
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t('upload.unsupportedFormat'))
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('upload.tooLarge'))
      return
    }

    setIsLoading(true)
    try {
      // SVG: import as vector (not rasterized)
      if (file.type === 'image/svg+xml' && onSVGAdd) {
        const svgText = await file.text()
        await onSVGAdd(svgText)
        return
      }

      // Upload to Supabase Storage via API
      const formData = new FormData()
      formData.append('image', file)

      const res = await apiFetch('/api/designs/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.status === 401) {
        // Not authenticated — fallback to blob URL (guest mode)
        const url = URL.createObjectURL(file)
        await onImageAdd(url)
        toast.info(t('upload.signInToSave') || 'Sign in to save images to your library')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()
      await onImageAdd(data.storageUrl)
      toast.success(t('upload.savedToLibrary') || 'Image saved to your library')
      onUploadSuccess?.()
    } catch (err) {
      console.error('Image upload error:', err)
      // Fallback to blob URL if upload fails
      try {
        const url = URL.createObjectURL(file)
        await onImageAdd(url)
        toast.error(t('upload.fallbackUsed') || 'Image added locally (upload failed)')
      } catch {
        toast.error('Failed to add image')
      }
    } finally {
      setIsLoading(false)
    }
  }, [onImageAdd, onSVGAdd, onUploadSuccess, t])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  return (
    <div className="space-y-4 p-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          isLoading && 'pointer-events-none opacity-60'
        )}
      >
        {isLoading ? (
          <Loader2 className="size-8 animate-spin text-primary" />
        ) : (
          <>
            <div className="flex items-center justify-center size-12 rounded-full bg-muted">
              <Upload className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{t('upload.title')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('upload.hint')}</p>
              <p className="text-xs text-muted-foreground">{t('upload.formats')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
