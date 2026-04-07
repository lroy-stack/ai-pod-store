'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, XCircle, Clock, Loader2, ArrowLeft, ExternalLink, Package, Tag, X } from 'lucide-react'
import { toast } from 'sonner'

const PREDEFINED_TAGS = ['animals', 'easter', 'feminist', 'groovy', 'meme', 'branded', 'minimalist', 'tech']

interface LinkedProduct {
  id: string
  title: string
  slug: string
}

interface Design {
  id: string
  prompt: string
  style: string | null
  model: string | null
  image_url: string | null
  thumbnail_url: string | null
  bg_removed_url: string | null
  width: number | null
  height: number | null
  moderation_status: 'pending' | 'approved' | 'rejected'
  moderation_notes: string | null
  created_at: string
  user_id: string | null
  product_id: string | null
  source_type: string | null
  source_url: string | null
  provider_upload_id: string | null
  quality_score: number | null
  tags: string[]
  linked_products: LinkedProduct[]
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  approved: 'default',
  pending: 'secondary',
  rejected: 'destructive',
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="text-sm">{value}</div>
    </div>
  )
}

function UrlField({ label, url }: { label: string; url: string | null }) {
  if (!url) return null
  const short = url.length > 60 ? url.slice(0, 60) + '…' : url
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-muted px-2 py-1 rounded truncate flex-1 block">{short}</code>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 flex-shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}

export default function DesignDetailPage() {
  const params = useParams()
  const designId = params?.id as string

  const [design, setDesign] = useState<Design | null>(null)
  const [loading, setLoading] = useState(true)
  const [moderating, setModerating] = useState(false)
  const [savingTags, setSavingTags] = useState(false)

  useEffect(() => {
    if (designId) fetchDesign()
  }, [designId])

  const fetchDesign = async () => {
    try {
      setLoading(true)
      const response = await adminFetch(`/api/designs/${designId}`)
      if (!response.ok) throw new Error('Failed to fetch design')
      const data = await response.json()
      setDesign(data.design)
    } catch (error) {
      console.error('Error fetching design:', error)
      toast.error('Failed to load design')
    } finally {
      setLoading(false)
    }
  }

  const handleModerate = async (status: 'approved' | 'rejected') => {
    if (!design) return
    try {
      setModerating(true)
      const response = await adminFetch(`/api/designs/${design.id}/moderate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Failed to moderate design')
      toast.success(`Design ${status}`)
      await fetchDesign()
    } catch (error) {
      console.error('Error moderating design:', error)
      toast.error('Failed to moderate design')
    } finally {
      setModerating(false)
    }
  }

  const handleTagToggle = async (tag: string) => {
    if (!design) return
    const currentTags = design.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag]
    try {
      setSavingTags(true)
      const res = await adminFetch(`/api/designs/${design.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      })
      if (!res.ok) throw new Error('Failed to update tags')
      setDesign({ ...design, tags: newTags })
    } catch {
      toast.error('Failed to update tags')
    } finally {
      setSavingTags(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!design) {
    return (
      <div className="p-6 text-center py-12">
        <p className="text-muted-foreground mb-4">Design not found</p>
        <Button asChild variant="outline">
          <Link href="/designs">Back to Designs</Link>
        </Button>
      </div>
    )
  }

  const statusVariant = STATUS_VARIANTS[design.moderation_status] || 'secondary'

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/designs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Designs
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Design Details</h1>
          <p className="text-sm text-muted-foreground">
            Created {new Date(design.created_at).toLocaleString('en-GB')}
          </p>
        </div>
        <Badge variant={statusVariant} className="capitalize flex-shrink-0">
          {design.moderation_status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
          {design.moderation_status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
          {design.moderation_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
          {design.moderation_status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Full-size Image Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Image Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {design.image_url ? (
              <div className="flex justify-center">
                <div className="relative rounded-lg overflow-hidden bg-muted" style={{ maxWidth: 600, width: '100%' }}>
                  <Image
                    src={design.image_url}
                    alt={design.prompt}
                    width={600}
                    height={600}
                    quality={90}
                    className="w-full h-auto object-contain"
                    unoptimized
                  />
                </div>
              </div>
            ) : (
              <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                <p className="text-muted-foreground text-sm">No image available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetaRow label="Prompt" value={<p className="text-sm">{design.prompt}</p>} />
              {design.style && <MetaRow label="Style" value={design.style} />}
              {design.model && (
                <MetaRow
                  label="Model"
                  value={<Badge variant="outline" className="text-xs">{design.model}</Badge>}
                />
              )}
              {design.source_type && (
                <MetaRow
                  label="Source Type"
                  value={<Badge variant="outline" className="text-xs capitalize">{design.source_type}</Badge>}
                />
              )}
              {(design.width && design.height) ? (
                <MetaRow label="Dimensions" value={`${design.width} × ${design.height} px`} />
              ) : null}
              {design.quality_score != null && (
                <MetaRow label="Quality Score" value={`${design.quality_score}/10`} />
              )}
              {design.provider_upload_id && (
                <MetaRow
                  label="Provider Upload ID"
                  value={<code className="text-xs bg-muted px-2 py-1 rounded">{design.provider_upload_id}</code>}
                />
              )}
              {design.moderation_notes && (
                <MetaRow
                  label="Moderation Notes"
                  value={<p className="text-sm text-destructive">{design.moderation_notes}</p>}
                />
              )}
            </CardContent>
          </Card>

          {/* Storage URLs */}
          <Card>
            <CardHeader>
              <CardTitle>Storage URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <UrlField label="Image URL" url={design.image_url} />
              <UrlField label="Thumbnail URL" url={design.thumbnail_url} />
              <UrlField label="Background Removed URL" url={design.bg_removed_url} />
              <UrlField label="Source URL" url={design.source_url} />
              {!design.image_url && !design.thumbnail_url && !design.bg_removed_url && (
                <p className="text-sm text-muted-foreground">No storage URLs available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tags
            {savingTags && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active tags */}
          <div className="flex flex-wrap gap-2">
            {(design.tags || []).length === 0 && (
              <span className="text-sm text-muted-foreground">No tags assigned</span>
            )}
            {(design.tags || []).map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  onClick={() => handleTagToggle(tag)}
                  className="ml-1 hover:text-destructive rounded-full"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {/* Predefined tag suggestions */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Add tag:</p>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_TAGS.filter((t) => !(design.tags || []).includes(t)).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-secondary transition-colors"
                  onClick={() => handleTagToggle(tag)}
                >
                  + {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Linked Products
            <Badge variant="outline" className="ml-auto">
              {design.linked_products?.length || 0}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {design.linked_products && design.linked_products.length > 0 ? (
            <div className="space-y-2">
              {design.linked_products.map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{product.title}</p>
                    <p className="text-xs text-muted-foreground">{product.id}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/products/${product.id}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      View
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">Orphaned</Badge>
              <span className="text-sm text-muted-foreground">
                This design is not referenced by any product
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Moderation Actions */}
      {design.moderation_status === 'pending' && (
        <Card>
          <CardHeader>
            <CardTitle>Moderation</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              onClick={() => handleModerate('approved')}
              disabled={moderating}
              className="flex-1"
            >
              {moderating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleModerate('rejected')}
              disabled={moderating}
              className="flex-1"
            >
              {moderating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />
      <div className="text-xs text-muted-foreground">
        ID: {design.id}
        {design.user_id && <span className="ml-4">User: {design.user_id}</span>}
      </div>
    </div>
  )
}
