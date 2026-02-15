'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { CheckCircle, XCircle, Clock, Loader2, PackagePlus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Design {
  id: string
  prompt: string
  style: string | null
  model: string | null
  image_url: string | null
  thumbnail_url: string | null
  width: number | null
  height: number | null
  moderation_status: 'pending' | 'approved' | 'rejected'
  moderation_notes: string | null
  created_at: string
  user_id: string | null
  product_id: string | null
}

export default function DesignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const designId = params?.id as string

  const [design, setDesign] = useState<Design | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)

  // Product creation form state
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [category, setCategory] = useState('t-shirts')
  const [basePrice, setBasePrice] = useState('29.99')

  useEffect(() => {
    if (designId) {
      fetchDesign()
    }
  }, [designId])

  useEffect(() => {
    if (design) {
      // Pre-fill product name and description from design
      setProductName(`Custom Design: ${design.prompt.substring(0, 50)}${design.prompt.length > 50 ? '...' : ''}`)
      setProductDescription(`AI-generated design featuring: ${design.prompt}${design.style ? ` (${design.style} style)` : ''}`)
    }
  }, [design])

  const fetchDesign = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/designs/${designId}`)
      if (!response.ok) throw new Error('Failed to fetch design')
      const data = await response.json()
      setDesign(data.design)
    } catch (error) {
      console.error('Error fetching design:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProduct = async () => {
    if (!design) return

    try {
      setCreating(true)

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productName,
          description: productDescription,
          category,
          base_price_cents: Math.round(parseFloat(basePrice) * 100),
          currency: 'EUR',
          design_id: design.id,
          image_url: design.image_url,
          status: 'active'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create product')
      }

      const { product } = await response.json()

      // Update design with product_id
      await fetch(`/api/designs/${design.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id })
      })

      alert('Product created successfully!')
      setShowCreateDialog(false)
      router.push(`/products/${product.id}`)
    } catch (error) {
      console.error('Error creating product:', error)
      alert(error instanceof Error ? error.message : 'Failed to create product')
    } finally {
      setCreating(false)
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
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Design not found</p>
          <Button asChild className="mt-4">
            <Link href="/designs">Back to Designs</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/designs">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Designs
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Design Details</h1>
            <p className="text-muted-foreground mt-1">
              Created {new Date(design.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <Badge variant={
          design.moderation_status === 'approved' ? 'default' :
          design.moderation_status === 'rejected' ? 'destructive' :
          'secondary'
        }>
          {design.moderation_status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
          {design.moderation_status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
          {design.moderation_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
          {design.moderation_status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Design Image */}
        <Card>
          <CardHeader>
            <CardTitle>Design Image</CardTitle>
          </CardHeader>
          <CardContent>
            {design.image_url ? (
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={design.image_url}
                  alt={design.prompt}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">No image available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Design Information */}
        <Card>
          <CardHeader>
            <CardTitle>Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Prompt</Label>
              <p className="mt-1 text-sm">{design.prompt}</p>
            </div>

            {design.style && (
              <div>
                <Label className="text-sm font-medium">Style</Label>
                <p className="mt-1 text-sm">{design.style}</p>
              </div>
            )}

            {design.model && (
              <div>
                <Label className="text-sm font-medium">Model</Label>
                <p className="mt-1 text-sm">{design.model}</p>
              </div>
            )}

            {design.width && design.height && (
              <div>
                <Label className="text-sm font-medium">Dimensions</Label>
                <p className="mt-1 text-sm">{design.width} × {design.height}px</p>
              </div>
            )}

            {design.moderation_notes && (
              <div>
                <Label className="text-sm font-medium">Moderation Notes</Label>
                <p className="mt-1 text-sm text-destructive">{design.moderation_notes}</p>
              </div>
            )}

            {design.product_id && (
              <div>
                <Label className="text-sm font-medium">Linked Product</Label>
                <Button asChild variant="link" className="p-0 h-auto mt-1">
                  <Link href={`/products/${design.product_id}`}>
                    View Product
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {design.moderation_status === 'approved' && !design.product_id && (
            <div>
              <Button onClick={() => setShowCreateDialog(true)} size="lg">
                <PackagePlus className="h-5 w-5 mr-2" />
                Create Product from Design
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Convert this approved design into a sellable product
              </p>
            </div>
          )}

          {design.product_id && (
            <div className="text-sm text-muted-foreground">
              This design has already been converted to a product
            </div>
          )}

          {design.moderation_status !== 'approved' && (
            <div className="text-sm text-muted-foreground">
              Design must be approved before creating a product
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Product Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Product from Design</DialogTitle>
            <DialogDescription>
              Configure the product details. The design will be attached to the product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter product name"
              />
            </div>

            <div>
              <Label htmlFor="productDescription">Description</Label>
              <Textarea
                id="productDescription"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Enter product description"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="t-shirts">T-Shirts</SelectItem>
                  <SelectItem value="hoodies">Hoodies</SelectItem>
                  <SelectItem value="mugs">Mugs</SelectItem>
                  <SelectItem value="posters">Posters</SelectItem>
                  <SelectItem value="phone-cases">Phone Cases</SelectItem>
                  <SelectItem value="tote-bags">Tote Bags</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="basePrice">Base Price (EUR)</Label>
              <Input
                id="basePrice"
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="29.99"
              />
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Pipeline Preview:</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Design</span>
                <span>→</span>
                <span>Product ({category})</span>
                <span>→</span>
                <span>Printify Template</span>
                <span>→</span>
                <span>Ready to Sell</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} disabled={creating || !productName || !productDescription}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <PackagePlus className="h-4 w-4 mr-2" />
                  Create Product
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
