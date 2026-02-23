'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, XCircle, Clock, Loader2, Eye } from 'lucide-react'
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
}

export default function DesignsPage() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchDesigns()
  }, [])

  const fetchDesigns = async () => {
    try {
      setLoading(true)
      const response = await adminFetch('/api/designs')
      if (!response.ok) throw new Error('Failed to fetch designs')
      const data = await response.json()
      setDesigns(data.designs || [])
    } catch (error) {
      console.error('Error fetching designs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (designId: string) => {
    try {
      setActionLoading(designId)
      const response = await adminFetch(`/api/designs/${designId}/moderate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      })
      if (!response.ok) throw new Error('Failed to approve design')

      // Update local state
      setDesigns(prev => prev.map(d =>
        d.id === designId ? { ...d, moderation_status: 'approved' } : d
      ))
    } catch (error) {
      console.error('Error approving design:', error)
      alert('Failed to approve design')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (designId: string) => {
    try {
      setActionLoading(designId)
      const notes = prompt('Rejection reason (optional):')

      const response = await adminFetch(`/api/designs/${designId}/moderate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          notes: notes || undefined
        })
      })
      if (!response.ok) throw new Error('Failed to reject design')

      // Update local state
      setDesigns(prev => prev.map(d =>
        d.id === designId ? { ...d, moderation_status: 'rejected', moderation_notes: notes || null } : d
      ))
    } catch (error) {
      console.error('Error rejecting design:', error)
      alert('Failed to reject design')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredDesigns = filter === 'all'
    ? designs
    : designs.filter(d => d.moderation_status === filter)

  const statusCounts = {
    all: designs.length,
    pending: designs.filter(d => d.moderation_status === 'pending').length,
    approved: designs.filter(d => d.moderation_status === 'approved').length,
    rejected: designs.filter(d => d.moderation_status === 'rejected').length,
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Designs Gallery</h1>
        <p className="text-muted-foreground mt-1">
          Moderate AI-generated designs from customers and the design agent
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({statusCounts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({statusCounts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({statusCounts.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDesigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No designs found for this filter
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredDesigns.map((design) => (
                <Card key={design.id} className="overflow-hidden">
                  <div className="relative aspect-square bg-muted">
                    {design.image_url ? (
                      <img
                        src={design.thumbnail_url || design.image_url}
                        alt={design.prompt}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Image
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
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
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium line-clamp-2">{design.prompt}</p>
                      {design.style && (
                        <p className="text-xs text-muted-foreground mt-1">Style: {design.style}</p>
                      )}
                      {design.moderation_notes && (
                        <p className="text-xs text-destructive mt-1">Notes: {design.moderation_notes}</p>
                      )}
                    </div>

                    {design.moderation_status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1"
                          onClick={() => handleApprove(design.id)}
                          disabled={actionLoading === design.id}
                        >
                          {actionLoading === design.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleReject(design.id)}
                          disabled={actionLoading === design.id}
                        >
                          {actionLoading === design.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {new Date(design.created_at).toLocaleDateString()}
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/designs/${design.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
