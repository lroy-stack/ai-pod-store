'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, Clock, Loader2, DollarSign, Package, Truck } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface ReturnRequest {
  id: string
  order_id: string
  user_id: string | null
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'
  refund_amount_cents: number | null
  refund_currency: string | null
  stripe_refund_id: string | null
  admin_notes: string | null
  approved_by: string | null
  approved_at: string | null
  completed_at: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  customer_shipped_at: string | null
  item_received_at: string | null
  created_at: string
  updated_at: string
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'completed'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showNotesDialog, setShowNotesDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [rejectionNotes, setRejectionNotes] = useState('')

  useEffect(() => {
    fetchReturns()
  }, [])

  const fetchReturns = async () => {
    try {
      setLoading(true)
      const response = await adminFetch('/api/returns')
      if (!response.ok) throw new Error('Failed to fetch returns')
      const data = await response.json()
      setReturns(data.returns || [])
    } catch (error) {
      console.error('Error fetching returns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (returnRequest: ReturnRequest) => {
    setSelectedReturn(returnRequest)
    setAdminNotes('')
    setShowNotesDialog(true)
  }

  const handleConfirmApprove = async () => {
    if (!selectedReturn) return

    try {
      setActionLoading(selectedReturn.id)

      const response = await adminFetch(`/api/returns/${selectedReturn.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: adminNotes || undefined })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve return')
      }

      const { returnRequest: updated } = await response.json()

      // Update local state
      setReturns(prev => prev.map(r =>
        r.id === selectedReturn.id ? updated : r
      ))

      toast.success('Return approved and refund processed successfully!')
      setShowNotesDialog(false)
      setSelectedReturn(null)
    } catch (error) {
      console.error('Error approving return:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to approve return')
    } finally {
      setActionLoading(null)
    }
  }

  const openRejectDialog = (returnRequest: ReturnRequest) => {
    setSelectedReturn(returnRequest)
    setRejectionNotes('')
    setShowRejectDialog(true)
  }

  const handleReject = async () => {
    if (!selectedReturn) return

    if (!rejectionNotes.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    try {
      setActionLoading(selectedReturn.id)

      const response = await adminFetch(`/api/returns/${selectedReturn.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: rejectionNotes })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reject return')
      }

      const { returnRequest: updated } = await response.json()

      // Update local state
      setReturns(prev => prev.map(r =>
        r.id === selectedReturn.id ? updated : r
      ))

      toast.success('Return rejected')
      setShowRejectDialog(false)
      setSelectedReturn(null)
      setRejectionNotes('')
    } catch (error) {
      console.error('Error rejecting return:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reject return')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReceive = async (returnRequest: ReturnRequest) => {
    setActionLoading(returnRequest.id)
    try {
      const response = await adminFetch(`/api/returns/${returnRequest.id}/receive`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to mark as received')
      }
      toast.success('Item received — refund processed and return completed!')
      await fetchReturns()
    } catch (error) {
      console.error('Error marking item as received:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to mark as received')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredReturns = filter === 'all'
    ? returns
    : returns.filter(r => r.status === filter)

  const statusCounts = {
    all: returns.length,
    pending: returns.filter(r => r.status === 'pending').length,
    approved: returns.filter(r => r.status === 'approved' || r.status === 'processing').length,
    rejected: returns.filter(r => r.status === 'rejected').length,
    completed: returns.filter(r => r.status === 'completed').length,
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{status}</Badge>
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{status}</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Returns & Refunds</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer return requests and process refunds
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({statusCounts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({statusCounts.approved})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({statusCounts.completed})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({statusCounts.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No return requests found for this filter
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReturns.map((returnRequest) => (
                <Card key={returnRequest.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          Return Request #{returnRequest.id.substring(0, 8)}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Package className="h-4 w-4" />
                          <Link
                            href={`/orders/${returnRequest.order_id}`}
                            className="hover:underline"
                          >
                            Order #{returnRequest.order_id.substring(0, 8)}
                          </Link>
                        </div>
                      </div>
                      {getStatusBadge(returnRequest.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Customer Reason</Label>
                      <p className="mt-1 text-sm">{returnRequest.reason}</p>
                    </div>

                    {returnRequest.admin_notes && (
                      <div>
                        <Label className="text-sm font-medium">Admin Notes</Label>
                        <p className="mt-1 text-sm text-muted-foreground">{returnRequest.admin_notes}</p>
                      </div>
                    )}

                    {returnRequest.refund_amount_cents && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Refund: {(returnRequest.refund_amount_cents / 100).toFixed(2)} {returnRequest.refund_currency?.toUpperCase()}
                        </span>
                        {returnRequest.stripe_refund_id && (
                          <Badge variant="outline" className="text-xs">
                            Stripe: {returnRequest.stripe_refund_id}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Tracking info (customer shipped) */}
                    {returnRequest.tracking_number && (
                      <div className="flex items-center gap-2 text-sm border border-border/60 rounded-md p-2 bg-muted/30">
                        <Truck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <span className="font-medium">{returnRequest.tracking_carrier}: </span>
                          <span className="font-mono">{returnRequest.tracking_number}</span>
                          {returnRequest.customer_shipped_at && (
                            <span className="text-xs text-muted-foreground ml-2">
                              Shipped {new Date(returnRequest.customer_shipped_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Requested: {new Date(returnRequest.created_at).toLocaleString()}</span>
                      {returnRequest.approved_at && (
                        <span>Approved: {new Date(returnRequest.approved_at).toLocaleString()}</span>
                      )}
                    </div>

                    {returnRequest.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(returnRequest)}
                          disabled={actionLoading === returnRequest.id}
                        >
                          {actionLoading === returnRequest.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Approve & Refund
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openRejectDialog(returnRequest)}
                          disabled={actionLoading === returnRequest.id}
                        >
                          {actionLoading === returnRequest.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Reject
                        </Button>
                      </div>
                    )}

                    {/* Mark item as received — triggers auto-refund if not yet issued */}
                    {(returnRequest.status === 'approved' || returnRequest.status === 'processing') && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleReceive(returnRequest)}
                          disabled={actionLoading === returnRequest.id}
                        >
                          {actionLoading === returnRequest.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Truck className="h-4 w-4 mr-2" />
                          )}
                          Mark Item Received &amp; Complete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Approval Confirmation Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Return & Process Refund</DialogTitle>
            <DialogDescription>
              This will approve the return request and trigger a refund via Stripe.
              The customer will be notified automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
              <Textarea
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any internal notes about this approval..."
                rows={3}
              />
            </div>

            {selectedReturn && (
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <p><strong>Order ID:</strong> {selectedReturn.order_id.substring(0, 8)}</p>
                <p><strong>Reason:</strong> {selectedReturn.reason}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotesDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmApprove} disabled={actionLoading !== null}>
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Return Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this return request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rejectionNotes">Rejection Reason (Required)</Label>
              <Textarea
                id="rejectionNotes"
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Explain why this return is being rejected..."
                rows={4}
              />
            </div>

            {selectedReturn && (
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <p><strong>Order ID:</strong> {selectedReturn.order_id.substring(0, 8)}</p>
                <p><strong>Reason:</strong> {selectedReturn.reason}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading !== null || !rejectionNotes.trim()}>
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
