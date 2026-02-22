'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Truck, CheckCircle, Clock, RefreshCw, Paintbrush, ShoppingCart, CreditCard, Send } from 'lucide-react';
import { toast } from 'sonner';

interface OrderLineItem {
  id: string;
  order_id: string;
  product_name: string;
  variant_name?: string;
  quantity: number;
  price_cents: number;
  personalization_text?: string;
  personalization_font?: string;
  personalization_font_color?: string;
  personalization_font_size?: string;
  personalization_position?: string;
}

interface OrderDetail {
  id: string;
  user_id: string | null;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  customer_email?: string;
  shipping_address: any;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  printify_order_id?: string;
  printify_status?: string;
  stripe_payment_intent_id?: string;
  items?: OrderLineItem[];
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  paid: 'default',
  processing: 'default',
  submitted: 'default',
  production: 'default',
  shipped: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  refunded: 'outline',
};

// Helper to generate timeline events from order data
const generateTimelineEvents = (order: OrderDetail) => {
  const events: Array<{ label: string; timestamp: string | null; icon: any; details?: string }> = [];

  // Order created
  events.push({
    label: 'Order Created',
    timestamp: order.created_at,
    icon: ShoppingCart,
    details: `Order placed${order.user?.email ? ` by ${order.user.email}` : ''}`,
  });

  // Payment received
  if (order.paid_at) {
    events.push({
      label: 'Payment Received',
      timestamp: order.paid_at,
      icon: CreditCard,
      details: order.stripe_payment_intent_id
        ? `Payment ID: ${order.stripe_payment_intent_id.substring(0, 20)}...`
        : 'Payment processed successfully',
    });
  }

  // Submitted to Printify
  if (order.printify_order_id) {
    events.push({
      label: 'Submitted to Printify',
      timestamp: order.paid_at, // Typically happens right after payment
      icon: Send,
      details: `Printify Order ID: ${order.printify_order_id}`,
    });
  }

  // In Production (if status is production or later)
  if (['production', 'shipped', 'delivered'].includes(order.status)) {
    events.push({
      label: 'In Production',
      timestamp: null, // Would need separate tracking
      icon: Clock,
      details: order.printify_status ? `Status: ${order.printify_status}` : undefined,
    });
  }

  // Shipped
  if (order.shipped_at) {
    events.push({
      label: 'Shipped',
      timestamp: order.shipped_at,
      icon: Truck,
      details: order.tracking_number
        ? `Tracking: ${order.tracking_number}${order.carrier ? ` (${order.carrier})` : ''}`
        : undefined,
    });
  }

  // Delivered (if status is delivered)
  if (order.status === 'delivered') {
    events.push({
      label: 'Delivered',
      timestamp: null, // Would need separate tracking
      icon: CheckCircle,
      details: 'Order successfully delivered',
    });
  }

  return events;
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }

      const data = await response.json();
      setOrder(data.order);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRetryPrintify = async () => {
    if (!order) return;

    setRetrying(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to retry Printify submission');
      }

      const data = await response.json();
      toast.success('Printify order resubmitted successfully');

      // Refresh order details
      await fetchOrderDetail();
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry Printify submission');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-destructive">Error: {error || 'Order not found'}</p>
          <Button onClick={() => router.push('/orders')} variant="outline" className="mt-4">
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const timelineEvents = generateTimelineEvents(order);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={() => router.push('/orders')}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Order Details</h1>
              <p className="text-muted-foreground font-mono text-sm mt-1">{order.id}</p>
            </div>
            <Badge variant={statusColors[order.status] || 'default'} className="text-sm px-3 py-1">
              {order.status}
            </Badge>
          </div>
        </div>

        {/* Event History Timeline */}
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-6">Event History</h2>
          <div className="relative">
            {timelineEvents.map((event, index) => {
              const Icon = event.icon;
              const hasTimestamp = !!event.timestamp;

              return (
                <div key={index} className="flex items-start mb-6 last:mb-0">
                  {/* Connector Line */}
                  {index < timelineEvents.length - 1 && (
                    <div className="absolute left-5 w-0.5 bg-border" style={{ top: `${index * 96 + 40}px`, height: '56px' }} />
                  )}

                  {/* Icon */}
                  <div
                    className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      hasTimestamp
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-background border-border text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="ml-4 flex-1">
                    <p className={`font-medium ${hasTimestamp ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {event.label}
                    </p>
                    {event.timestamp && (
                      <p className="text-sm text-muted-foreground mt-0.5">{formatDate(event.timestamp)}</p>
                    )}
                    {event.details && (
                      <p className="text-xs text-muted-foreground mt-1">{event.details}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Customer Information */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Customer Information</h2>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{order.user?.email || order.customer_email || 'N/A'}</p>
              </div>
              {order.user?.name && (
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{order.user.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Order Date</p>
                <p className="font-medium">{formatDate(order.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium text-lg">{formatCurrency(order.total_cents, order.currency)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping & Tracking */}
        {(order.tracking_number || order.carrier) && (
          <div className="bg-card border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Shipping & Tracking</h2>
            <div className="space-y-2">
              {order.carrier && (
                <div>
                  <p className="text-sm text-muted-foreground">Carrier</p>
                  <p className="font-medium">{order.carrier}</p>
                </div>
              )}
              {order.tracking_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Tracking Number</p>
                  {order.tracking_url ? (
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {order.tracking_number}
                    </a>
                  ) : (
                    <p className="font-medium">{order.tracking_number}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <div className="bg-card border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Order Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{item.product_name}</h3>
                        {item.personalization_text && (
                          <Badge variant="default" className="gap-1">
                            <Paintbrush className="h-3 w-3" />
                            Personalized
                          </Badge>
                        )}
                      </div>
                      {item.variant_name && (
                        <p className="text-sm text-muted-foreground mt-1">{item.variant_name}</p>
                      )}

                      {/* Personalization Details */}
                      {item.personalization_text && (
                        <div className="mt-3 p-3 bg-muted/30 rounded-md border border-border">
                          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Personalization</p>
                          <div className="space-y-1.5 text-sm">
                            <div>
                              <span className="font-medium text-muted-foreground">Text: </span>
                              <span className="text-foreground">{item.personalization_text}</span>
                            </div>
                            {item.personalization_font && (
                              <div>
                                <span className="font-medium text-muted-foreground">Font: </span>
                                <span className="text-foreground" style={{ fontFamily: item.personalization_font }}>
                                  {item.personalization_font}
                                </span>
                              </div>
                            )}
                            {item.personalization_font_color && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-muted-foreground">Color: </span>
                                <div
                                  className="w-4 h-4 rounded border border-border"
                                  style={{ backgroundColor: item.personalization_font_color }}
                                />
                                <span className="text-foreground font-mono text-xs">
                                  {item.personalization_font_color}
                                </span>
                              </div>
                            )}
                            {item.personalization_position && (
                              <div>
                                <span className="font-medium text-muted-foreground">Position: </span>
                                <span className="text-foreground capitalize">{item.personalization_position}</span>
                              </div>
                            )}
                            {item.personalization_font_size && (
                              <div>
                                <span className="font-medium text-muted-foreground">Font Size: </span>
                                <span className="text-foreground capitalize">{item.personalization_font_size}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium">{formatCurrency(item.price_cents, order.currency)}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-semibold">Technical Details</h2>
            {order.printify_status === 'failed' && (
              <Button
                onClick={handleRetryPrintify}
                disabled={retrying}
                variant="outline"
                size="sm"
              >
                {retrying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Printify Submission
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="space-y-2 text-sm">
            {order.stripe_payment_intent_id && (
              <div>
                <p className="text-muted-foreground">Stripe Payment Intent</p>
                <p className="font-mono">{order.stripe_payment_intent_id}</p>
              </div>
            )}
            {order.printify_order_id && (
              <div>
                <p className="text-muted-foreground">Printify Order ID</p>
                <p className="font-mono">{order.printify_order_id}</p>
              </div>
            )}
            {order.printify_status && (
              <div>
                <p className="text-muted-foreground">Printify Status</p>
                <div className="flex items-center gap-2">
                  <Badge variant={order.printify_status === 'failed' ? 'destructive' : 'default'}>
                    {order.printify_status}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
