'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Filter } from 'lucide-react';
import { useRowNavigation } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';

interface Order {
  id: string;
  user_id: string | null;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  customer_email?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  processing: 'default',
  shipped: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  refunded: 'outline',
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Bulk operations state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Keyboard navigation
  const { selectedIndex, setSelectedIndex } = useRowNavigation({
    rowCount: orders.length,
    enabled: !showConfirmDialog && !loading,
    onOpen: (index) => {
      const order = orders[index];
      if (order) {
        router.push(`/orders/${order.id}`);
      }
    },
  });

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  // Reset selected index when orders change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [orders, setSelectedIndex]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (search) {
        params.append('search', search);
      }

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/orders?${params.toString()}`);
      const data: OrdersResponse = await response.json();

      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(orders.map((order) => order.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const isAllSelected = orders.length > 0 && selectedOrders.size === orders.length;
  const isSomeSelected = selectedOrders.size > 0 && selectedOrders.size < orders.length;

  // Bulk action handlers
  const handleBulkActionChange = (action: string) => {
    setBulkAction(action);
    setShowConfirmDialog(true);
  };

  const executeBulkAction = async () => {
    if (!bulkAction || selectedOrders.size === 0) return;

    try {
      setBulkLoading(true);
      const response = await fetch('/api/admin/orders/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds: Array.from(selectedOrders),
          action: bulkAction,
        }),
      });

      if (!response.ok) {
        throw new Error('Bulk action failed');
      }

      // Refresh orders and clear selection
      await fetchOrders();
      setSelectedOrders(new Set());
      setBulkAction('');
      setShowConfirmDialog(false);
    } catch (error) {
      console.error('Failed to execute bulk action:', error);
      alert('Failed to execute bulk action. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const getBulkActionLabel = (action: string) => {
    switch (action) {
      case 'cancel':
        return 'Cancel Orders';
      case 'mark_shipped':
        return 'Mark as Shipped';
      case 'mark_delivered':
        return 'Mark as Delivered';
      case 'mark_processing':
        return 'Mark as Processing';
      default:
        return 'Unknown Action';
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Orders</h1>
          <p className="text-muted-foreground">
            Manage and track customer orders
          </p>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by order ID or customer email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('');
                setPage(1);
              }}
              className={statusFilter === '' ? 'bg-muted' : ''}
            >
              All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('pending');
                setPage(1);
              }}
              className={statusFilter === 'pending' ? 'bg-muted' : ''}
            >
              Pending
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('processing');
                setPage(1);
              }}
              className={statusFilter === 'processing' ? 'bg-muted' : ''}
            >
              Processing
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('shipped');
                setPage(1);
              }}
              className={statusFilter === 'shipped' ? 'bg-muted' : ''}
            >
              Shipped
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedOrders.size > 0 && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50 flex items-center justify-between">
            <p className="text-sm font-medium">
              {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-3">
              <Select onValueChange={handleBulkActionChange} value="">
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Bulk actions..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mark_processing">Mark as Processing</SelectItem>
                  <SelectItem value="mark_shipped">Mark as Shipped</SelectItem>
                  <SelectItem value="mark_delivered">Mark as Delivered</SelectItem>
                  <SelectItem value="cancel">Cancel Orders</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedOrders(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="border rounded-lg bg-card">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all orders"
                        />
                      </TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order, index) => (
                      <TableRow
                        key={order.id}
                        className={selectedIndex === index ? 'bg-muted/50 ring-2 ring-primary ring-inset' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={(checked) =>
                              handleSelectOrder(order.id, checked as boolean)
                            }
                            aria-label={`Select order ${order.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-primary hover:underline"
                          >
                            {order.id.substring(0, 8)}...
                          </Link>
                        </TableCell>
                        <TableCell>
                          {order.user?.email || order.customer_email || 'Guest'}
                          {order.user?.name && (
                            <div className="text-sm text-muted-foreground">
                              {order.user.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColors[order.status] || 'default'}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.total_cents, order.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden">
                <div className="p-4 space-y-4">
                  {orders.map((order, index) => (
                    <div
                      key={order.id}
                      className={`border rounded-lg p-4 space-y-3 ${
                        selectedIndex === index ? 'bg-muted/50 ring-2 ring-primary' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-h-[44px]">
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={(checked) =>
                              handleSelectOrder(order.id, checked as boolean)
                            }
                            aria-label={`Select order ${order.id}`}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/orders/${order.id}`}
                              className="font-mono text-sm text-primary hover:underline inline-block min-h-[44px] flex items-center"
                            >
                              {order.id.substring(0, 8)}...
                            </Link>
                            <p className="text-sm text-muted-foreground truncate">
                              {order.user?.email || order.customer_email || 'Guest'}
                            </p>
                            {order.user?.name && (
                              <p className="text-sm text-muted-foreground">
                                {order.user.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant={statusColors[order.status] || 'default'}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">
                          {formatDate(order.created_at)}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(order.total_cents, order.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t p-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {orders.length} of {total} orders
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
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Tip: Use <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">j</kbd>/<kbd className="px-1 py-0.5 text-xs bg-muted border rounded">k</kbd> to navigate, <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">Enter</kbd> to open, <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">?</kbd> for help
          </p>
        </div>

        {/* Keyboard Shortcuts Help Dialog */}
        <KeyboardShortcutsHelp />

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to {getBulkActionLabel(bulkAction).toLowerCase()} for{' '}
                {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeBulkAction}
                disabled={bulkLoading}
              >
                {bulkLoading ? 'Processing...' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
