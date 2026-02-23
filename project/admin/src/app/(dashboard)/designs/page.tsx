'use client'

import { useState } from 'react'
import { adminFetch } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, XCircle, Clock, Loader2, Eye } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useDesigns } from '@/hooks/queries/useDesigns'

export default function DesignsPage() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingDesignId, setRejectingDesignId] = useState<string | null>(null)
  const [rejectionNotes, setRejectionNotes] = useState('')

  // React Query hook for data fetching
  const { data, isLoading, refetch } = useDesigns({
    page,
    limit: 20,
    status: filter === 'all' ? undefined : filter,
  })

  const designs = data?.designs || []
  const loading = isLoading
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1

  const handleApprove = async (designId: string) => {
    try {
      setActionLoading(designId)
      const response = await adminFetch(`/api/designs/${designId}/moderate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      })
      if (!response.ok) throw new Error('Failed to approve design')

      // Refetch data
      await refetch()
      toast.success('Design approved successfully')
    } catch (error) {
      console.error('Error approving design:', error)
      toast.error('Failed to approve design')
    } finally {
      setActionLoading(null)
    }
  }

  const openRejectDialog = (designId: string) => {
    setRejectingDesignId(designId)
    setRejectionNotes('')
    setRejectDialogOpen(true)
  }

  const handleReject = async () => {
    if (!rejectingDesignId) return

    try {
      setActionLoading(rejectingDesignId)
      const response = await adminFetch(`/api/designs/${rejectingDesignId}/moderate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          notes: rejectionNotes || undefined
        })
      })
      if (!response.ok) throw new Error('Failed to reject design')

      // Refetch data
      await refetch()
      toast.success('Design rejected')

      setRejectDialogOpen(false)
      setRejectingDesignId(null)
      setRejectionNotes('')
    } catch (error) {
      console.error('Error rejecting design:', error)
      toast.error('Failed to reject design')
    } finally {
      setActionLoading(null)
    }
  }

  const handleFilterChange = (newFilter: 'all' | 'pending' | 'approved' | 'rejected') => {
    setFilter(newFilter)
    setPage(1) // Reset to first page on filter change
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Designs Gallery</h1>
        <p className="text-muted-foreground mt-1">
          Moderate AI-generated designs from customers and the design agent
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => handleFilterChange(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : designs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No designs found for this filter
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {designs.map((design) => (
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
                          onClick={() => openRejectDialog(design.id)}
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {designs.length} of {total} designs
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="px-4 py-2 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Design</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejecting this design.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Rejection reason (optional)..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject Design
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
