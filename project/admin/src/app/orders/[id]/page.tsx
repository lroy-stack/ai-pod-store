'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Truck, CheckCircle, Clock } from 'lucide-react';

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
  stripe_payment_intent_id?: string;
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

const timelineStages = [
  { key: 'paid', label: 'Paid', icon: CheckCircle },
  { key: 'submitted', label: 'Submitted to Printify', icon: Package },
  { key: 'production', label: 'In Production', icon: Clock },
  { key: 'shipped', label: 'Shipped', icon: Truck },
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const getStatusStage = (status: string): number => {
    const stages: Record<string, number> = {
      pending: 0,
      paid: 1,
      submitted: 2,
      processing: 2,
      production: 3,
      shipped: 4,
      delivered: 4,
    };
    return stages[status] || 0;
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

  const currentStage = getStatusStage(order.status);

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

        {/* Status Timeline */}
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-6">Order Timeline</h2>
          <div className="relative">
            {timelineStages.map((stage, index) => {
              const isCompleted = index < currentStage;
              const isActive = index === currentStage;
              const Icon = stage.icon;

              return (
                <div key={stage.key} className="flex items-start mb-6 last:mb-0">
                  {/* Connector Line */}
                  {index < timelineStages.length - 1 && (
                    <div
                      className={`absolute left-5 top-12 w-0.5 h-12 ${
                        isCompleted ? 'bg-primary' : 'bg-border'
                      }`}
                      style={{ marginTop: `${index * 96}px` }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isCompleted || isActive
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-background border-border text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="ml-4 flex-1">
                    <p
                      className={`font-medium ${
                        isCompleted || isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {stage.label}
                    </p>
                    {stage.key === 'paid' && order.paid_at && (
                      <p className="text-sm text-muted-foreground">{formatDate(order.paid_at)}</p>
                    )}
                    {stage.key === 'shipped' && order.shipped_at && (
                      <p className="text-sm text-muted-foreground">{formatDate(order.shipped_at)}</p>
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

        {/* Technical Details */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Technical Details</h2>
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
          </div>
        </div>
      </div>
    </div>
  );
}
