'use client';

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { adminFetch } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { exportToCSV } from '@/lib/export-utils';
import { useOrders, Order } from '@/hooks/queries/useOrders';
import { OrderKanbanBoard } from '@/components/orders/OrderKanbanBoard';
import { LayoutList, LayoutDashboard } from 'lucide-react';

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  processing: 'default',
  shipped: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  refunded: 'outline',
};

const formatCurrency = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [selectedRows, setSelectedRows] = useState<Order[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');

  // Fetch a large page to work client-side
  const { data, isLoading } = useOrders({ page: 1, limit: 500 });
  const orders = data?.orders || [];

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      // Select column
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      // Order ID
      {
        accessorKey: 'id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order ID" />
        ),
        cell: ({ row }) => (
          <Link
            href={`/orders/${row.original.id}`}
            className="font-mono text-xs text-primary hover:underline"
          >
            {row.original.id.substring(0, 8)}...
          </Link>
        ),
      },
      // Customer
      {
        accessorKey: 'customer_email',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        cell: ({ row }) => {
          const email =
            row.original.user?.email ||
            row.original.customer_email ||
            'Guest';
          const name = row.original.user?.name;
          return (
            <div>
              <p className="text-sm truncate max-w-[180px]">{email}</p>
              {name && (
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {name}
                </p>
              )}
            </div>
          );
        },
        filterFn: (row, _, filterValue) => {
          const email =
            row.original.user?.email ||
            row.original.customer_email ||
            '';
          const name = row.original.user?.name || '';
          return (
            email.toLowerCase().includes(filterValue.toLowerCase()) ||
            name.toLowerCase().includes(filterValue.toLowerCase())
          );
        },
      },
      // Total
      {
        accessorKey: 'total_cents',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total" />
        ),
        cell: ({ row }) =>
          formatCurrency(row.original.total_cents, row.original.currency),
      },
      // Status
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant={statusColors[row.original.status] || 'default'}>
            {row.original.status}
          </Badge>
        ),
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true;
          return row.original.status === filterValue;
        },
      },
      // Provider
      {
        accessorKey: 'pod_provider',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Provider" />
        ),
        cell: ({ row }) => {
          const provider = row.original.pod_provider;
          if (provider === 'printful')
            return <Badge variant="default">Printful</Badge>;
          if (provider)
            return <Badge variant="secondary">Legacy</Badge>;
          return <Badge variant="destructive">No Provider</Badge>;
        },
      },
      // Date
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      // Actions
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => (
          <Link href={`/orders/${row.original.id}`}>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </Link>
        ),
      },
    ],
    []
  );

  const handleBulkAction = async () => {
    if (!bulkAction || selectedRows.length === 0) return;
    try {
      setBulkLoading(true);
      const response = await adminFetch('/api/admin/orders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedRows.map((r) => r.id),
          action: bulkAction,
        }),
      });
      if (!response.ok) throw new Error('Bulk action failed');
      setSelectedRows([]);
      setBulkAction('');
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Bulk action completed successfully');
    } catch {
      toast.error('Failed to execute bulk action. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExport = (rows: Order[], visibleColumnIds: string[]) => {
    const headers = visibleColumnIds.filter(
      (id) => !['select', 'actions'].includes(id)
    );
    const csvRows = rows.map((order) =>
      headers.map((col) => {
        switch (col) {
          case 'id':
            return order.id;
          case 'customer_email':
            return order.user?.email || order.customer_email || 'Guest';
          case 'total_cents':
            return formatCurrency(order.total_cents, order.currency);
          case 'status':
            return order.status;
          case 'pod_provider':
            return order.pod_provider || 'None';
          case 'created_at':
            return formatDate(order.created_at);
          default:
            return '';
        }
      })
    );
    exportToCSV(
      headers.map((h) => h.replace(/_/g, ' ').toUpperCase()),
      csvRows,
      'orders.csv'
    );
  };

  const renderMobileCard = (order: Order) => (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/orders/${order.id}`}
          className="font-mono text-sm text-primary hover:underline"
        >
          {order.id.substring(0, 8)}...
        </Link>
        <Badge variant={statusColors[order.status] || 'default'}>
          {order.status}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground truncate">
        {order.user?.email || order.customer_email || 'Guest'}
      </p>
      <div className="flex items-center justify-between text-sm border-t pt-2">
        <span className="text-muted-foreground">{formatDate(order.created_at)}</span>
        <div className="flex items-center gap-2">
          {order.pod_provider === 'printful' ? (
            <Badge variant="default">Printful</Badge>
          ) : order.pod_provider ? (
            <Badge variant="secondary">Legacy</Badge>
          ) : (
            <Badge variant="destructive">No Provider</Badge>
          )}
          <span className="font-medium">
            {formatCurrency(order.total_cents, order.currency)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Orders</h1>
            <p className="text-muted-foreground">
              Manage and track customer orders
            </p>
          </div>
          {/* Table | Board switcher */}
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/50 self-start sm:self-auto">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2 h-8"
              onClick={() => setViewMode('table')}
            >
              <LayoutList className="h-4 w-4" />
              Table
            </Button>
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2 h-8"
              onClick={() => setViewMode('board')}
            >
              <LayoutDashboard className="h-4 w-4" />
              Board
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedRows.length > 0 && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {selectedRows.length} order{selectedRows.length !== 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkAction('mark_processing');
                  setShowConfirmDialog(true);
                }}
              >
                Mark Processing
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkAction('mark_shipped');
                  setShowConfirmDialog(true);
                }}
              >
                Mark Shipped
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkAction('cancel');
                  setShowConfirmDialog(true);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Table or Board view */}
        {viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={orders}
            isLoading={isLoading}
            enableSorting
            enablePagination
            enableRowSelection
            enableColumnVisibility
            pageSize={20}
            tableId="orders"
            searchColumn="customer_email"
            searchPlaceholder="Search by customer email or name..."
            filters={[
              {
                columnId: 'status',
                label: 'Status',
                options: [
                  { label: 'Pending', value: 'pending' },
                  { label: 'Processing', value: 'processing' },
                  { label: 'Shipped', value: 'shipped' },
                  { label: 'Delivered', value: 'delivered' },
                  { label: 'Cancelled', value: 'cancelled' },
                  { label: 'Refunded', value: 'refunded' },
                ],
              },
            ]}
            onExport={handleExport}
            onRowSelectionChange={setSelectedRows}
            renderMobileCard={renderMobileCard}
            emptyTitle="No orders found"
            emptyDescription="Try adjusting your search or filter criteria."
          />
        ) : (
          <OrderKanbanBoard orders={orders} isLoading={isLoading} />
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to apply this action to{' '}
                {selectedRows.length} order{selectedRows.length !== 1 ? 's' : ''}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkAction} disabled={bulkLoading}>
                {bulkLoading ? 'Processing...' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
