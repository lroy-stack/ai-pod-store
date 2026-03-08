'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/currency';
import { Package, AlertCircle, ArrowLeft, RotateCcw, CreditCard, Coins, Download } from 'lucide-react';
import { OrderTimelineArtifact } from '@/components/artifacts/OrderTimelineArtifact/OrderTimelineArtifact';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

interface OrderItem {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  price_cents: number;
  product_title: string;
  variant_title: string;
}

interface Order {
  id: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  customer_email: string | null;
  payment_method: string | null;
  shipping_address: {
    full_name?: string;
    street_line1?: string;
    street_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country_code?: string;
  } | null;
}

interface ReturnRequest {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  refund_amount_cents: number;
  refund_currency: string;
}

export default function OrderDetailView({
  locale,
  orderId,
}: {
  locale: string;
  orderId: string;
}) {
  const t = useTranslations('Orders');
  const { user, authenticated, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  useEffect(() => {
    if (!authLoading && authenticated) {
      fetchOrder();
      fetchReturnRequests();
    } else if (!authLoading && !authenticated) {
      setLoading(false);
    }
  }, [authenticated, authLoading, orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
        setOrderItems(data.items || []);
      } else if (response.status === 404) {
        setError('notFound');
      } else if (response.status === 401) {
        setError('unauthorized');
      } else {
        setError('failed');
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchReturnRequests = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/returns`);
      if (response.ok) {
        const data = await response.json();
        setReturnRequests(data.return_requests || []);
      }
    } catch (err) {
      console.error('Error fetching return requests:', err);
    }
  };

  const handleReturnRequest = async () => {
    if (returnReason.trim().length < 10) {
      toast.error(t('returnReasonTooShort'));
      return;
    }

    setSubmittingReturn(true);
    try {
      const response = await apiFetch(`/api/orders/${orderId}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: returnReason, user_id: user?.id }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t('returnRequestSuccess'));
        setReturnDialogOpen(false);
        setReturnReason('');
        fetchReturnRequests();
      } else {
        toast.error(data.error || t('returnRequestFailed'));
      }
    } catch (err) {
      console.error('Error submitting return request:', err);
      toast.error(t('returnRequestFailed'));
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setDownloadingInvoice(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/invoice`);

      if (response.ok) {
        const invoiceData = await response.json();

        // Create a simple invoice HTML page and trigger download
        // In production, you might want to open Stripe's hosted invoice URL
        // or generate a proper PDF
        const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceData.order_number}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
    .invoice-details { margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; }
    .total { font-size: 1.2em; font-weight: bold; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Invoice</h1>
    <p>Order #${invoiceData.order_number}</p>
    <p>Date: ${new Date(invoiceData.date).toLocaleDateString()}</p>
  </div>
  <div class="invoice-details">
    <p><strong>Customer:</strong> ${invoiceData.customer_email}</p>
    <p><strong>Status:</strong> ${invoiceData.status}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Quantity</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${invoiceData.line_items.map((item: any) => `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>${(item.unit_price_cents / 100).toFixed(2)} ${invoiceData.currency}</td>
          <td>${(item.total_cents / 100).toFixed(2)} ${invoiceData.currency}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="total">
    Total: ${(invoiceData.total_cents / 100).toFixed(2)} ${invoiceData.currency}
  </div>
</body>
</html>
        `;

        // Generate PDF from HTML template using iframe to isolate from oklch theme styles
        const html2pdf = (await import('html2pdf.js')).default;
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:1200px;border:none;';
        document.body.appendChild(iframe);
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error('Cannot create iframe for invoice');
        iframeDoc.open();
        iframeDoc.write(invoiceHTML);
        iframeDoc.close();
        await html2pdf()
          .set({
            margin: 10,
            filename: `invoice-${invoiceData.order_number}.pdf`,
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(iframeDoc.body)
          .save();
        document.body.removeChild(iframe);

        toast.success(t('invoiceDownloaded'));
      } else {
        toast.error(t('invoiceDownloadFailed'));
      }
    } catch (err) {
      console.error('Error downloading invoice:', err);
      toast.error(t('invoiceDownloadFailed'));
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusVariant = (
    status: string
  ): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'paid':
      case 'submitted':
        return 'default';
      case 'in_production':
      case 'shipped':
      case 'delivered':
        return 'secondary';
      case 'cancelled':
      case 'refunded':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getReturnStatusVariant = (
    status: string
  ): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'approved':
      case 'processing':
      case 'completed':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const canRequestReturn = (order: Order) => {
    if (returnRequests.length > 0) return false;
    return ['paid', 'submitted', 'in_production', 'shipped', 'delivered'].includes(
      order.status
    );
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <div className="size-20 md:size-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <AlertCircle className="size-10 md:size-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t('loginRequired')}
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('loginRequiredDescription')}
          </p>
          <Button asChild size="lg">
            <Link href={`/${locale}/auth/login`}>{t('loginButton')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error === 'notFound') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link href={`/${locale}/orders`}>
              <ArrowLeft className="size-4 mr-2" />
              {t('backToOrders')}
            </Link>
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <div className="size-20 md:size-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <AlertCircle className="size-10 md:size-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t('orderNotFound')}
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('orderNotFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link href={`/${locale}/orders`}>
              <ArrowLeft className="size-4 mr-2" />
              {t('backToOrders')}
            </Link>
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <div className="size-20 md:size-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <AlertCircle className="size-10 md:size-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t('error')}
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('errorDescription')}
          </p>
          <Button onClick={fetchOrder} size="lg">
            {t('retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Button */}
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href={`/${locale}/orders`}>
            <ArrowLeft className="size-4 mr-2" />
            {t('backToOrders')}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            {t('orderNumber', { number: order.id.substring(0, 8).toUpperCase() })}
          </h1>
          <p className="text-muted-foreground">{formatDate(order.created_at)}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Badge variant={getStatusVariant(order.status)} className="self-start">
            {t(`status.${order.status}`)}
          </Badge>
          <Button
            variant="outline"
            onClick={handleDownloadInvoice}
            disabled={downloadingInvoice}
          >
            <Download className="size-4 mr-2" />
            {downloadingInvoice ? t('downloading') : t('downloadInvoice')}
          </Button>
          {canRequestReturn(order) && (
            <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <RotateCcw className="size-4 mr-2" />
                  {t('requestReturn')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('requestReturnTitle')}</DialogTitle>
                  <DialogDescription>
                    {t('requestReturnDescription')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">{t('returnReason')}</Label>
                    <Textarea
                      id="reason"
                      placeholder={t('returnReasonPlaceholder')}
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      rows={5}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('returnReasonMinLength')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setReturnDialogOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleReturnRequest}
                    disabled={submittingReturn || returnReason.trim().length < 10}
                    className="w-full sm:w-auto"
                  >
                    {submittingReturn ? t('submitting') : t('submitReturn')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>{t('orderItems')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderItems.map((item) => (
                  <div key={item.id}>
                    <div className="flex gap-4">
                      <div className="size-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <Package className="size-8 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {item.product_title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.variant_title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('quantity')}: {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          {formatPrice(
                            (item.price_cents * item.quantity) / 100,
                            locale,
                            order.currency.toUpperCase()
                          )}
                        </p>
                      </div>
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4">
                  <p className="text-lg font-bold text-foreground">{t('total')}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(
                      order.total_cents / 100,
                      locale,
                      order.currency.toUpperCase()
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return Requests */}
          {returnRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('returnRequests')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {returnRequests.map((returnRequest) => (
                    <div key={returnRequest.id}>
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={getReturnStatusVariant(returnRequest.status)}>
                              {t(`returnStatus.${returnRequest.status}`)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {formatDate(returnRequest.created_at)}
                          </p>
                          <p className="text-sm text-foreground mt-2">
                            <strong>{t('reason')}:</strong> {returnRequest.reason}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {t('refundAmount')}
                          </p>
                          <p className="font-medium text-foreground">
                            {formatPrice(
                              returnRequest.refund_amount_cents / 100,
                              locale,
                              returnRequest.refund_currency.toUpperCase()
                            )}
                          </p>
                        </div>
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Shipping Info */}
          {order.shipping_address && (
            <Card>
              <CardHeader>
                <CardTitle>{t('shippingAddress')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {order.shipping_address.full_name && (
                  <p className="font-medium">{order.shipping_address.full_name}</p>
                )}
                {order.shipping_address.street_line1 && (
                  <p>{order.shipping_address.street_line1}</p>
                )}
                {order.shipping_address.street_line2 && (
                  <p>{order.shipping_address.street_line2}</p>
                )}
                {order.shipping_address.city && (
                  <p>
                    {order.shipping_address.city}
                    {order.shipping_address.state && `, ${order.shipping_address.state}`}{' '}
                    {order.shipping_address.postal_code}
                  </p>
                )}
                {order.shipping_address.country_code && (
                  <p className="uppercase">{order.shipping_address.country_code}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Info */}
          {order.payment_method && (
            <Card>
              <CardHeader>
                <CardTitle>{t('paymentMethod')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  {order.payment_method === 'crypto' ? (
                    <>
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                        <Coins className="size-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{t('cryptocurrency')}</p>
                        <Badge variant="outline" className="mt-1 gap-1.5">
                          <Coins className="size-3" />
                          <span>{t('cryptoPayment')}</span>
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <CreditCard className="size-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{t('creditCard')}</p>
                        <Badge variant="secondary" className="mt-1 gap-1.5">
                          <CreditCard className="size-3" />
                          <span>{t('cardPayment')}</span>
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Timeline */}
          <OrderTimelineArtifact
            orderId={order.id}
            status={order.status}
            trackingNumber={order.tracking_number || undefined}
            createdAt={order.created_at}
            paidAt={order.paid_at || undefined}
            shippedAt={order.shipped_at || undefined}
            currency={order.currency}
            total={order.total_cents}
            showFooter={false}
          />

          {/* Tracking Info */}
          {order.tracking_number && (
            <Card>
              <CardHeader>
                <CardTitle>{t('tracking')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">{t('trackingNumber')}</p>
                  <p className="font-medium text-foreground">{order.tracking_number}</p>
                </div>
                {order.carrier && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('carrier')}</p>
                    <p className="font-medium text-foreground">{order.carrier}</p>
                  </div>
                )}
                {order.tracking_url && (
                  <Button variant="outline" asChild className="w-full">
                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                      {t('trackPackage')}
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
