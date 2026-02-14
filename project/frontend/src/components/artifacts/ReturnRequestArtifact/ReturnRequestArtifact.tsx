'use client'

/**
 * ReturnRequestArtifact - Renders approval dialog for return request
 *
 * Used by request_return tool with needsApproval: true
 * Displays order summary and asks user to confirm return request
 */

import { useTranslations } from 'next-intl'
import { PackageX, AlertCircle, Calendar, DollarSign } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

export interface ReturnRequestArtifactProps {
  variant?: 'inline' | 'detail'
  orderId?: string
  status?: string
  totalCents?: number
  currency?: string
  createdAt?: string
  paidAt?: string
  shippedAt?: string
  reason?: string
  onApprove?: (reason: string) => void
  onDeny?: () => void
}

export function ReturnRequestArtifact({
  variant = 'inline',
  orderId = '',
  status = 'unknown',
  totalCents = 0,
  currency = 'EUR',
  createdAt = '',
  paidAt = '',
  shippedAt = '',
  reason: initialReason = '',
  onApprove,
  onDeny,
}: ReturnRequestArtifactProps) {
  const t = useTranslations('storefront')
  const [reason, setReason] = useState(initialReason)

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatCurrency = (cents: number, curr: string) => {
    const symbol = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : curr
    const amount = (cents / 100).toFixed(2)
    return curr === 'USD' ? `${symbol}${amount}` : `${symbol}${amount}`
  }

  const getStatusColor = (orderStatus: string) => {
    switch (orderStatus) {
      case 'paid':
        return 'bg-success/10 text-success'
      case 'submitted':
      case 'in_production':
        return 'bg-primary/10 text-primary'
      case 'shipped':
        return 'bg-blue-500/10 text-blue-500'
      case 'delivered':
        return 'bg-success/10 text-success'
      default:
        return 'bg-muted/50 text-muted-foreground'
    }
  }

  const handleApprove = () => {
    if (onApprove && reason.trim().length >= 10) {
      onApprove(reason.trim())
    }
  }

  return (
    <Card className={variant === 'inline' ? 'max-w-lg' : 'max-w-2xl mx-auto'}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <PackageX className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">
              {t('returnRequestTitle') || 'Request Return'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t('returnRequestSubtitle') || 'Confirm your return request'}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Order Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Order ID</p>
              <p className="text-sm font-mono text-foreground">#{orderId.slice(0, 8)}</p>
            </div>
            <Badge className={getStatusColor(status)} variant="secondary">
              {status}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Order Date</p>
              </div>
              <p className="text-sm text-foreground">{formatDate(createdAt)}</p>
            </div>

            {paidAt && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Paid Date</p>
                </div>
                <p className="text-sm text-foreground">{formatDate(paidAt)}</p>
              </div>
            )}

            {shippedAt && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <PackageX className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Shipped Date</p>
                </div>
                <p className="text-sm text-foreground">{formatDate(shippedAt)}</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Refund Amount</span>
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(totalCents, currency)}
            </span>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="return-reason" className="text-sm font-medium">
              Reason for Return <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="return-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you want to return this order (minimum 10 characters)"
              className="min-h-[80px] resize-none"
            />
            {reason.length > 0 && reason.length < 10 && (
              <p className="text-xs text-destructive">
                Reason must be at least 10 characters ({reason.length}/10)
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              {t('returnRequestNote') ||
                'Your return request will be reviewed by our team. You will receive a confirmation email once approved. Refunds typically process within 5-7 business days.'}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          onClick={onDeny}
          variant="outline"
          className="flex-1"
          disabled={!onDeny}
        >
          {t('returnRequestDeny') || 'Cancel'}
        </Button>
        <Button
          onClick={handleApprove}
          className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          disabled={!onApprove || reason.trim().length < 10}
        >
          {t('returnRequestApprove') || 'Submit Return Request'}
        </Button>
      </CardFooter>
    </Card>
  )
}
