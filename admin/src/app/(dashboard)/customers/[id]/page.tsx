'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  MoreVertical,
  Mail,
  ShieldOff,
  ShieldCheck,
  X,
  Plus,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';

const PREDEFINED_TAGS = ['VIP', 'wholesale', 'influencer', 'at-risk', 'new'];

const RFM_DESCRIPTIONS: Record<string, string> = {
  VIP: 'High value customer: high spend, frequent orders, purchased recently.',
  Champion: 'Very high spend with multiple orders.',
  Loyal: 'Frequent buyer with consistent purchase history.',
  Regular: 'Regular customer with moderate activity.',
  New: 'Joined recently with their first order.',
  'At Risk': 'Previously active but no orders in 90+ days.',
  Churned: 'No orders in 6+ months. Re-engagement recommended.',
  'No Orders': 'Registered user with no completed orders yet.',
};

const RFM_VARIANTS: Record<string, string> = {
  VIP: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary',
  Champion: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning',
  Loyal: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary',
  Regular: 'bg-success/10 text-success dark:bg-success/20 dark:text-success',
  New: 'bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground',
  'At Risk': 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning',
  Churned: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive',
  'No Orders': '',
};

function formatCents(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

interface CustomerData {
  user: {
    id: string;
    email: string;
    name: string;
    created_at: string;
    avatar_url: string | null;
    account_status: string;
    tags: string[];
    role: string;
    locale: string;
    currency: string;
    email_verified: boolean;
    last_login_at: string | null;
    tier: string;
  };
  stats: {
    order_count: number;
    total_spent_cents: number;
    avg_order_cents: number;
    clv_cents: number;
    rfm_segment: string;
    wishlist_count: number;
  };
  orders: {
    id: string;
    total_cents: number;
    currency: string;
    status: string;
    created_at: string;
    external_order_id: string | null;
  }[];
  addresses: {
    id: string;
    full_name: string;
    street_line1: string;
    city: string;
    country_code: string;
    is_default: boolean;
  }[];
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/customers/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast.error('Customer not found');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const addTag = async (tag: string) => {
    if (!data || !tag.trim()) return;
    const trimmed = tag.trim();
    if (data.user.tags.includes(trimmed)) {
      toast.info('Tag already added');
      return;
    }
    setSavingTag(true);
    try {
      const res = await adminFetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: [...data.user.tags, trimmed] }),
      });
      if (res.ok) {
        setData((prev) => prev ? {
          ...prev,
          user: { ...prev.user, tags: [...prev.user.tags, trimmed] },
        } : prev);
        setTagInput('');
        toast.success(`Tag "${trimmed}" added`);
      } else {
        toast.error('Failed to add tag');
      }
    } finally {
      setSavingTag(false);
    }
  };

  const removeTag = async (tag: string) => {
    if (!data) return;
    const newTags = data.user.tags.filter((t) => t !== tag);
    setSavingTag(true);
    try {
      const res = await adminFetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
      if (res.ok) {
        setData((prev) => prev ? {
          ...prev,
          user: { ...prev.user, tags: newTags },
        } : prev);
        toast.success(`Tag "${tag}" removed`);
      } else {
        toast.error('Failed to remove tag');
      }
    } finally {
      setSavingTag(false);
    }
  };

  const toggleStatus = async () => {
    if (!data) return;
    const newStatus = data.user.account_status === 'active' ? 'disabled' : 'active';
    setTogglingStatus(true);
    try {
      const res = await adminFetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_status: newStatus }),
      });
      if (res.ok) {
        setData((prev) => prev ? {
          ...prev,
          user: { ...prev.user, account_status: newStatus },
        } : prev);
        toast.success(`Account ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
      } else {
        toast.error('Failed to update status');
      }
    } finally {
      setTogglingStatus(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!data) return;
    setSendingReset(true);
    try {
      const res = await adminFetch(`/api/customers/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_password_reset' }),
      });
      if (res.ok) {
        toast.success('Password reset email sent');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to send reset email');
      }
    } finally {
      setSendingReset(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Customer not found.</p>
      </main>
    );
  }

  const { user, stats, orders, addresses } = data;
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  const rfmClass = RFM_VARIANTS[stats.rfm_segment] || '';

  return (
    <TooltipProvider>
      <main className="min-h-screen p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Back */}
          <Button variant="outline" size="sm" asChild>
            <a href="/customers">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Customers
            </a>
          </Button>

          {/* Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 flex-shrink-0">
                    <AvatarImage src={user.avatar_url ?? undefined} />
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-xl font-bold">{user.name}</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className={`border-0 cursor-help ${rfmClass}`}>
                            {stats.rfm_segment}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-[200px] text-xs">{RFM_DESCRIPTIONS[stats.rfm_segment] || ''}</p>
                        </TooltipContent>
                      </Tooltip>
                      {user.account_status !== 'active' && (
                        <Badge variant="destructive">{user.account_status}</Badge>
                      )}
                      {user.email_verified && (
                        <Badge variant="outline" className="text-xs">Verified</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Joined {formatDate(user.created_at)} &middot; Last login {formatDate(user.last_login_at)}
                    </p>
                  </div>
                </div>

                {/* Account Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4 mr-1" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={sendPasswordReset}
                      disabled={sendingReset}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {sendingReset ? 'Sending…' : 'Send Password Reset'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={toggleStatus}
                      disabled={togglingStatus}
                    >
                      {user.account_status === 'active' ? (
                        <>
                          <ShieldOff className="h-4 w-4 mr-2 text-destructive" />
                          Disable Account
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4 mr-2 text-success" />
                          Enable Account
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="#orders">
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        View Order History
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
                <p className="text-2xl font-bold">{stats.order_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Spend</p>
                <p className="text-2xl font-bold">{formatCents(stats.total_spent_cents, user.currency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">CLV (3yr)</p>
                <p className="text-2xl font-bold">{formatCents(stats.clv_cents, user.currency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Avg Order</p>
                <p className="text-2xl font-bold">{formatCents(stats.avg_order_cents, user.currency)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {user.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      disabled={savingTag}
                      className="ml-1 hover:text-destructive"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {user.tags.length === 0 && (
                  <span className="text-sm text-muted-foreground">No tags yet</span>
                )}
              </div>
              {/* Predefined tag suggestions */}
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_TAGS.filter((t) => !user.tags.includes(t)).map((t) => (
                  <button
                    key={t}
                    onClick={() => addTag(t)}
                    disabled={savingTag}
                    className="text-xs border border-dashed border-border rounded-full px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  >
                    + {t}
                  </button>
                ))}
              </div>
              {/* Custom tag input */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add custom tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                  }}
                  className="h-8 text-sm max-w-[200px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addTag(tagInput)}
                  disabled={savingTag || !tagInput.trim()}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Order history */}
          <Card id="orders">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <p className="p-6 text-muted-foreground text-sm">No orders found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.slice(0, 10).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">
                            <Link
                              href={`/orders/${order.id}`}
                              className="hover:underline text-primary"
                            >
                              {order.id.substring(0, 8)}…
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(order.created_at)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{order.status}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatCents(order.total_cents, order.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Addresses */}
          {addresses.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Address Book</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="border rounded-lg p-3 text-sm">
                      {addr.is_default && (
                        <Badge variant="default" className="mb-2 text-xs">Default</Badge>
                      )}
                      <p className="font-medium">{addr.full_name}</p>
                      <p className="text-muted-foreground">{addr.street_line1}</p>
                      <p className="text-muted-foreground">{addr.city}, {addr.country_code}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </TooltipProvider>
  );
}
