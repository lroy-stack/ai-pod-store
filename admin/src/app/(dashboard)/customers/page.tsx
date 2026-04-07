'use client';

import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useCustomers, Customer } from '@/hooks/queries/useCustomers';
import { useRouter } from 'next/navigation';
import { exportToCSV } from '@/lib/export-utils';

const RFM_SEGMENTS = [
  'VIP', 'Champion', 'Loyal', 'Regular', 'New', 'At Risk', 'Churned', 'No Orders',
];

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

function formatCents(cents: number, currency = 'eur') {
  return new Intl.NumberFormat('en-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CustomersPage() {
  const router = useRouter();
  const { data, isLoading } = useCustomers({ page: 1, limit: 500 });
  const customers = data?.customers || [];

  const handleExport = (rows: Customer[], _visibleColumnIds: string[]) => {
    const headers = ['name', 'email', 'orders_count', 'total_spent', 'clv', 'segment', 'tags', 'joined_date'];
    const csvRows = rows.map((c) => [
      c.name || '',
      c.email,
      String(c.order_count),
      formatCents(c.total_spent_cents, c.currency),
      formatCents(c.clv_cents, c.currency),
      c.rfm_segment,
      (c.tags || []).join('; '),
      formatDate(c.created_at),
    ]);
    exportToCSV(
      headers.map((h) => h.replace(/_/g, ' ').toUpperCase()),
      csvRows,
      `customers-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      // Name + Avatar
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => {
          const c = row.original;
          const initials = c.name
            ? c.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
            : c.email[0].toUpperCase();
          return (
            <div className="flex items-center gap-2 min-w-[150px]">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={c.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm truncate max-w-[160px]">{c.name}</span>
            </div>
          );
        },
      },
      // Email
      {
        accessorKey: 'email',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
            {row.original.email}
          </span>
        ),
      },
      // Joined
      {
        accessorKey: 'created_at',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      // Orders
      {
        accessorKey: 'order_count',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Orders" />,
        cell: ({ row }) => (
          <span className="text-sm font-medium tabular-nums">{row.original.order_count}</span>
        ),
      },
      // Total Spent
      {
        accessorKey: 'total_spent_cents',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total Spent" />,
        cell: ({ row }) => (
          <span className="text-sm font-medium tabular-nums whitespace-nowrap">
            {formatCents(row.original.total_spent_cents, row.original.currency)}
          </span>
        ),
      },
      // CLV
      {
        accessorKey: 'clv_cents',
        header: ({ column }) => <DataTableColumnHeader column={column} title="CLV (3yr)" />,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums whitespace-nowrap text-muted-foreground">
            {formatCents(row.original.clv_cents, row.original.currency)}
          </span>
        ),
      },
      // RFM Segment
      {
        accessorKey: 'rfm_segment',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Segment" />,
        cell: ({ row }) => {
          const seg = row.original.rfm_segment;
          const cls = RFM_VARIANTS[seg] || '';
          return (
            <Badge className={`border-0 text-xs whitespace-nowrap ${cls}`}>{seg}</Badge>
          );
        },
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true;
          return row.original.rfm_segment === filterValue;
        },
      },
      // Account status
      {
        accessorKey: 'account_status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const s = row.original.account_status;
          if (s === 'active') return <Badge variant="outline" className="text-xs">Active</Badge>;
          return <Badge variant="destructive" className="text-xs">{s}</Badge>;
        },
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true;
          return row.original.account_status === filterValue;
        },
      },
    ],
    []
  );

  const renderMobileCard = (customer: Customer) => {
    const seg = customer.rfm_segment;
    const cls = RFM_VARIANTS[seg] || '';
    const initials = customer.name
      ? customer.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      : customer.email[0].toUpperCase();

    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={customer.avatar_url ?? undefined} />
            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{customer.name}</p>
            <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
          </div>
          <Badge className={`ml-auto flex-shrink-0 border-0 text-xs ${cls}`}>{seg}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs border-t pt-2">
          <div>
            <p className="text-muted-foreground">Orders</p>
            <p className="font-medium">{customer.order_count}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Spent</p>
            <p className="font-medium">{formatCents(customer.total_spent_cents, customer.currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">CLV</p>
            <p className="font-medium">{formatCents(customer.clv_cents, customer.currency)}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Customers</h1>
          <p className="text-muted-foreground">View and manage your customer base</p>
        </div>

        <DataTable
          columns={columns}
          data={customers}
          isLoading={isLoading}
          enableSorting
          enablePagination
          enableColumnVisibility
          pageSize={25}
          tableId="customers"
          searchColumn="email"
          searchPlaceholder="Search by name or email…"
          filters={[
            {
              columnId: 'rfm_segment',
              label: 'Segment',
              options: RFM_SEGMENTS.map((s) => ({ label: s, value: s })),
            },
            {
              columnId: 'account_status',
              label: 'Status',
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Disabled', value: 'disabled' },
                { label: 'Suspended', value: 'suspended' },
              ],
            },
          ]}
          onExport={handleExport}
          onRowClick={(row) => router.push(`/customers/${row.id}`)}
          renderMobileCard={renderMobileCard}
          emptyTitle="No customers found"
          emptyDescription="Customers will appear here once users register."
        />
      </div>
    </main>
  );
}
