'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  ShoppingCart, CreditCard, Send, Clock, Truck, CheckCircle2,
  RefreshCw, Paintbrush, Package, MapPin, FileText, Activity,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface AdminNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
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
  shipping_address: Record<string, unknown> | null;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  external_order_id?: string;
  provider_status?: string;
  pod_provider?: string;
  stripe_payment_intent_id?: string;
  payment_method?: string;
  admin_notes?: AdminNote[];
  items?: OrderLineItem[];
  user?: { id: string; email: string; name: string | null };
  user_order_count?: number;
}

// ─── Fraud Indicators ────────────────────────────────────────────────────────

interface FraudFlag {
  label: string;
  reason: string;
}

function computeFraudFlags(order: OrderDetail): FraudFlag[] {
  const flags: FraudFlag[] = [];
  const shipping = order.shipping_address as Record<string, string> | null;
  const totalEur = order.total_cents / 100;
  const isHighValue = totalEur > 200;

  // Flag 1: First-time customer with order > €200
  const isFirstOrNew = (order.user_order_count ?? 0) <= 1;
  if (isHighValue && order.user_id && isFirstOrNew) {
    flags.push({
      label: 'First Order > €200',
      reason: `High-value first order (${order.currency.toUpperCase()} ${totalEur.toFixed(2)}) from new customer`,
    });
  }

  // Flag 2: High-value guest order (no account)
  if (isHighValue && !order.user_id) {
    flags.push({
      label: 'High Value Guest',
      reason: `Guest checkout for ${order.currency.toUpperCase()} ${totalEur.toFixed(2)} — no account`,
    });
  }

  // Flag 3: Address mismatch — currency region vs shipping country
  const shippingCountry = (shipping?.country ?? shipping?.country_code ?? '').toUpperCase();
  const eurCountries = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'FI', 'IE', 'GR', 'LU', 'SK', 'SI', 'MT', 'CY', 'EE', 'LV', 'LT'];
  const currencyIsEur = order.currency.toUpperCase() === 'EUR';
  const currencyIsUsd = order.currency.toUpperCase() === 'USD';
  if (
    shippingCountry &&
    ((currencyIsUsd && eurCountries.includes(shippingCountry)) ||
      (currencyIsEur && shippingCountry === 'US'))
  ) {
    flags.push({
      label: 'Address Mismatch',
      reason: `Order currency (${order.currency.toUpperCase()}) does not match shipping country (${shippingCountry})`,
    });
  }

  // Flag 4: Multiple failed payment signals — provider failed with no retry
  if (order.provider_status === 'failed' && !order.external_order_id) {
    flags.push({
      label: 'Provider Failed',
      reason: 'Order submitted to provider but failed — possible fulfilment risk',
    });
  }

  return flags;
}

function FraudIndicators({ order }: { order: OrderDetail }) {
  const flags = computeFraudFlags(order);
  if (flags.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
      <p className="text-xs font-semibold text-destructive uppercase tracking-wide">
        Fraud Indicators
      </p>
      <div className="flex flex-wrap gap-2">
        {flags.map((flag) => (
          <Badge
            key={flag.label}
            variant="destructive"
            className="text-xs"
            title={flag.reason}
          >
            {flag.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary', paid: 'default', processing: 'default',
  submitted: 'default', production: 'default', shipped: 'default',
  delivered: 'default', cancelled: 'destructive', refunded: 'outline',
};

const formatCurrency = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

const formatDate = (dateString: string | null) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ─── Timeline ────────────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'created', label: 'Created', icon: ShoppingCart },
  { key: 'paid', label: 'Paid', icon: CreditCard },
  { key: 'sent_to_provider', label: 'Sent to Provider', icon: Send },
  { key: 'in_production', label: 'In Production', icon: Clock },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

function getStepTimestamp(order: OrderDetail, key: string): string | null {
  switch (key) {
    case 'created': return order.created_at;
    case 'paid': return order.paid_at;
    case 'sent_to_provider': return order.external_order_id ? order.paid_at : null;
    case 'in_production': return ['production', 'shipped', 'delivered'].includes(order.status) ? order.paid_at : null;
    case 'shipped': return order.shipped_at;
    case 'delivered': return order.status === 'delivered' ? order.shipped_at : null;
    default: return null;
  }
}

function getCurrentStepIndex(order: OrderDetail): number {
  const status = order.status;
  if (status === 'delivered') return 5;
  if (status === 'shipped') return 4;
  if (status === 'production') return 3;
  if (status === 'submitted' || order.external_order_id) return 2;
  if (status === 'paid' || status === 'processing') return 1;
  return 0;
}

function TimelineTab({ order }: { order: OrderDetail }) {
  const currentStep = getCurrentStepIndex(order);

  return (
    <div className="py-4">
      <div className="relative">
        {TIMELINE_STEPS.map((step, index) => {
          const Icon = step.icon;
          const ts = getStepTimestamp(order, step.key);
          const isCompleted = index <= currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === TIMELINE_STEPS.length - 1;

          return (
            <div key={step.key} className="flex items-start gap-4 mb-0">
              {/* Icon + connector */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 flex-shrink-0 transition-colors ${
                    isCurrent
                      ? 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20'
                      : isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-12 mt-0 ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>

              {/* Content */}
              <div className="pt-2 pb-12 last:pb-0 flex-1">
                <div className={`font-medium flex items-center gap-2 ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <span>{step.label}</span>
                  {isCurrent && (
                    <Badge className="text-xs" variant="default">Current</Badge>
                  )}
                </div>
                {ts ? (
                  <p className="text-sm text-muted-foreground mt-0.5">{formatDate(ts)}</p>
                ) : isCompleted ? (
                  <p className="text-xs text-muted-foreground">Completed</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Pending</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ order, onNotesUpdate }: { order: OrderDetail; onNotesUpdate: (notes: AdminNote[]) => void }) {
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const notes = order.admin_notes || [];

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSubmitting(true);
    try {
      const res = await adminFetch(`/api/orders/${order.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: noteText.trim() }),
      });
      if (!res.ok) throw new Error('Failed to save note');
      const data = await res.json();
      onNotesUpdate(data.notes);
      setNoteText('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Internal Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Type an admin-only note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
          />
          <Button onClick={handleAddNote} disabled={submitting || !noteText.trim()} size="sm">
            {submitting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
            Add Note
          </Button>
        </CardContent>
      </Card>

      {/* Existing notes */}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No notes yet</p>
      ) : (
        <div className="space-y-3">
          {[...notes].reverse().map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">{note.author}</span>
                  <span>·</span>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchOrderDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminFetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      setOrder(data.order);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrderDetail(); }, [fetchOrderDetail]);

  const handleRetryProvider = async () => {
    if (!order) return;
    setRetrying(true);
    try {
      const res = await adminFetch(`/api/admin/orders/${order.id}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to retry provider submission');
      toast.success('Order resubmitted successfully');
      await fetchOrderDetail();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry');
    } finally {
      setRetrying(false);
    }
  };

  const handleNotesUpdate = (notes: AdminNote[]) => {
    if (order) setOrder({ ...order, admin_notes: notes });
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="h-8 bg-muted rounded w-48 animate-pulse mb-6" />
          <div className="h-64 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-destructive">Error: {error || 'Order not found'}</p>
        </div>
      </div>
    );
  }

  const shippingAddress = order.shipping_address as Record<string, string> | null;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Order Details</h1>
            <p className="text-muted-foreground font-mono text-xs mt-0.5">{order.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusColors[order.status] || 'default'} className="text-sm px-3 py-1 capitalize">
              {order.status}
            </Badge>
            {order.provider_status === 'failed' && (
              <Button onClick={handleRetryProvider} disabled={retrying} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                Retry
              </Button>
            )}
          </div>
        </div>

        {/* Fraud Indicators */}
        <FraudIndicators order={order} />

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="general" className="flex items-center gap-1">
              <Package className="h-4 w-4 hidden sm:block" />
              <span>General</span>
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-1">
              <ShoppingCart className="h-4 w-4 hidden sm:block" />
              <span>Items</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-1">
              <Activity className="h-4 w-4 hidden sm:block" />
              <span>Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="shipping" className="flex items-center gap-1">
              <MapPin className="h-4 w-4 hidden sm:block" />
              <span>Shipping</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-1">
              <FileText className="h-4 w-4 hidden sm:block" />
              <span>Notes</span>
              {(order.admin_notes?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  {order.admin_notes!.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{order.user?.email || order.customer_email || 'N/A'}</p>
                  </div>
                  {order.user?.name && (
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{order.user.name}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-bold text-lg">{formatCurrency(order.total_cents, order.currency)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Order Date</p>
                    <p className="font-medium">{formatDate(order.created_at)}</p>
                  </div>
                  {order.paid_at && (
                    <div>
                      <p className="text-muted-foreground">Paid At</p>
                      <p className="font-medium">{formatDate(order.paid_at)}</p>
                    </div>
                  )}
                  {order.payment_method && (
                    <div>
                      <p className="text-muted-foreground">Method</p>
                      <p className="font-medium capitalize">{order.payment_method}</p>
                    </div>
                  )}
                  {order.stripe_payment_intent_id && (
                    <div>
                      <p className="text-muted-foreground">Stripe PI</p>
                      <p className="font-mono text-xs">{order.stripe_payment_intent_id}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Provider info */}
            {(order.external_order_id || order.provider_status) && (
              <Card>
                <CardHeader><CardTitle className="text-base">Provider</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {order.pod_provider && (
                    <div>
                      <p className="text-muted-foreground">Provider</p>
                      <p className="font-medium capitalize">{order.pod_provider}</p>
                    </div>
                  )}
                  {order.external_order_id && (
                    <div>
                      <p className="text-muted-foreground">Provider Order ID</p>
                      <p className="font-mono">{order.external_order_id}</p>
                    </div>
                  )}
                  {order.provider_status && (
                    <div>
                      <p className="text-muted-foreground">Provider Status</p>
                      <Badge variant={order.provider_status === 'failed' ? 'destructive' : 'default'}>
                        {order.provider_status}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items">
            <Card>
              <CardHeader><CardTitle className="text-base">Order Items ({order.items?.length ?? 0})</CardTitle></CardHeader>
              <CardContent>
                {!order.items || order.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items found</p>
                ) : (
                  <div className="divide-y divide-border">
                    {order.items.map((item) => (
                      <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{item.product_name}</p>
                              {item.personalization_text && (
                                <Badge variant="default" className="gap-1 text-xs">
                                  <Paintbrush className="h-3 w-3" />
                                  Personalized
                                </Badge>
                              )}
                            </div>
                            {item.variant_name && (
                              <p className="text-sm text-muted-foreground mt-0.5">{item.variant_name}</p>
                            )}
                            {item.personalization_text && (
                              <div className="mt-2 p-3 bg-muted/30 rounded border text-sm space-y-1">
                                <p><span className="text-muted-foreground">Text: </span>{item.personalization_text}</p>
                                {item.personalization_font && (
                                  <p><span className="text-muted-foreground">Font: </span>{item.personalization_font}</p>
                                )}
                                {item.personalization_font_color && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Color: </span>
                                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: item.personalization_font_color }} />
                                    <span className="font-mono text-xs">{item.personalization_font_color}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-medium">{formatCurrency(item.price_cents, order.currency)}</p>
                            <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader><CardTitle className="text-base">Order Timeline</CardTitle></CardHeader>
              <CardContent>
                <TimelineTab order={order} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shipping Tab */}
          <TabsContent value="shipping">
            <Card>
              <CardHeader><CardTitle className="text-base">Shipping Information</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                {order.tracking_number && (
                  <div>
                    <p className="text-muted-foreground">Tracking Number</p>
                    {order.tracking_url ? (
                      <a href={order.tracking_url} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline">
                        {order.tracking_number}
                      </a>
                    ) : (
                      <p className="font-medium font-mono">{order.tracking_number}</p>
                    )}
                  </div>
                )}
                {order.carrier && (
                  <div>
                    <p className="text-muted-foreground">Carrier</p>
                    <p className="font-medium">{order.carrier}</p>
                  </div>
                )}
                {order.shipped_at && (
                  <div>
                    <p className="text-muted-foreground">Shipped At</p>
                    <p className="font-medium">{formatDate(order.shipped_at)}</p>
                  </div>
                )}
                {shippingAddress && Object.keys(shippingAddress).length > 0 ? (
                  <div>
                    <p className="text-muted-foreground mb-1">Delivery Address</p>
                    <div className="bg-muted/30 rounded p-3 space-y-0.5">
                      {shippingAddress.name && <p className="font-medium">{shippingAddress.name}</p>}
                      {shippingAddress.line1 && <p>{shippingAddress.line1}</p>}
                      {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
                      {(shippingAddress.city || shippingAddress.postal_code) && (
                        <p>{[shippingAddress.postal_code, shippingAddress.city].filter(Boolean).join(' ')}</p>
                      )}
                      {shippingAddress.country && <p>{shippingAddress.country}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No shipping address on file</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes">
            <NotesTab order={order} onNotesUpdate={handleNotesUpdate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
