'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { adminFetch } from '@/lib/admin-api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const PREDEFINED_TAGS = ['animals', 'easter', 'feminist', 'groovy', 'meme', 'branded', 'minimalist', 'tech']
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
const MAX_SIZE_MB = 10

interface DesignUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DesignUploadDialog({ open, onOpenChange, onSuccess }: DesignUploadDialogProps) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error('Unsupported file type. Use PNG, JPG, or SVG.')
      return
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Max ${MAX_SIZE_MB}MB.`)
      return
    }
    setFile(f)
    if (f.type !== 'image/svg+xml') {
      const url = URL.createObjectURL(f)
      setFilePreview(url)
    } else {
      setFilePreview(null)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Please select a file')
      return
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (prompt) formData.append('prompt', prompt)
      if (model) formData.append('model', model)
      if (selectedTags.length > 0) formData.append('tags', JSON.stringify(selectedTags))

      const res = await adminFetch('/api/designs/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        onSuccess?.()
        handleClose()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setFilePreview(null)
    setPrompt('')
    setSelectedTags([])
    setModel('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Design</DialogTitle>
          <DialogDescription>
            Upload a PNG, JPG, or SVG design file (max {MAX_SIZE_MB}MB). It will be stored in Supabase Storage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.svg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            {file ? (
              <div className="space-y-2">
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="mx-auto max-h-32 max-w-full object-contain rounded"
                  />
                ) : (
                  <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    setFilePreview(null)
                  }}
                  className="h-auto py-1 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, SVG — max {MAX_SIZE_MB}MB</p>
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="upload-prompt">Prompt (optional)</Label>
            <Textarea
              id="upload-prompt"
              placeholder="Describe the design or its intended use…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label htmlFor="upload-model">Model (optional)</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="upload-model">
                <SelectValue placeholder="Select model…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fal">FAL</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="sourced">Sourced</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {PREDEFINED_TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer select-none text-xs"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!file || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
