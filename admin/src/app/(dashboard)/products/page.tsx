'use client';

import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { exportToCSV } from '@/lib/export-utils';
import { Pencil, Archive, Plus, DollarSign, RefreshCw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';
import { toast } from 'sonner';
import { useProducts, Product } from '@/hooks/queries/useProducts';
import { useArchiveProduct, useBulkUpdateProducts } from '@/hooks/mutations/useProductMutations';
import Image from 'next/image';
import Link from 'next/link';

const formatPrice = (cents: number, currency: string) => {
  const symbol = currency.toLowerCase() === 'eur' ? '€' : '$';
  return `${symbol}${(cents / 100).toFixed(2)}`;
};

export default function ProductsPage() {
  const { data, isLoading } = useProducts({ page: 1, limit: 500 });
  const products = data?.products || [];

  const archiveProductMutation = useArchiveProduct();
  const bulkUpdateMutation = useBulkUpdateProducts();

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch('/api/products/sync-all', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: (result) => {
      toast.success(`Synced ${result.synced} products from Printful (${result.created} new, ${result.updated} updated)`);
    },
    onError: () => toast.error('Sync failed'),
  });

  const columns = useMemo<ColumnDef<Product>[]>(
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
      // Image thumbnail (50px)
      {
        id: 'image',
        header: 'Image',
        cell: ({ row }) => {
          const product = row.original;
          const firstImage = product.images?.[0];
          const imgSrc = firstImage?.src || '/brand/logo-mark-dark.png';
          return (
            <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
              <Image
                src={imgSrc}
                alt={product.title}
                width={50}
                height={50}
                className="object-cover w-full h-full"
                unoptimized
              />
            </div>
          );
        },
        enableSorting: false,
      },
      // Name
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <Link
            href={`/products/${row.original.id}`}
            className="font-medium hover:underline text-primary line-clamp-2 max-w-[200px]"
          >
            {row.original.title}
          </Link>
        ),
      },
      // Price
      {
        accessorKey: 'base_price_cents',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Price" />
        ),
        cell: ({ row }) =>
          formatPrice(row.original.base_price_cents, row.original.currency),
      },
      // Status
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === 'active' ? 'default' : 'secondary'}
          >
            {row.original.status === 'active' ? 'Active' : 'Archived'}
          </Badge>
        ),
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true;
          return row.original.status === filterValue;
        },
      },
      // Category
      {
        accessorKey: 'category',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Category" />
        ),
        cell: ({ row }) => (
          <span className="capitalize text-sm">
            {row.original.category || '—'}
          </span>
        ),
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true;
          return (row.original.category || '') === filterValue;
        },
      },
      // Provider
      {
        accessorKey: 'pod_provider',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Provider" />
        ),
        cell: ({ row }) => {
          const p = row.original.pod_provider;
          if (p === 'printful') return <Badge variant="default">Printful</Badge>;
          if (p) return <Badge variant="secondary">Legacy</Badge>;
          return <Badge variant="destructive">No Provider</Badge>;
        },
      },
      // Sync Status
      {
        id: 'sync_status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Sync Status" />
        ),
        cell: ({ row }) => {
          const product = row.original;
          // Not Published: no provider_product_id
          if (!product.provider_product_id) {
            return <Badge variant="outline" className="text-muted-foreground">Not Published</Badge>;
          }
          // No sync timestamp yet
          if (!product.last_synced_at) {
            return <Badge variant="secondary" className="bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning border-0">Pending Sync</Badge>;
          }
          // Updated after last sync → pending
          if (product.updated_at && new Date(product.updated_at) > new Date(product.last_synced_at)) {
            return <Badge variant="secondary" className="bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning border-0">Pending Sync</Badge>;
          }
          // All good
          return <Badge className="bg-success/10 text-success dark:bg-success/20 dark:text-success border-0">Synced</Badge>;
        },
        enableSorting: false,
      },
      // Actions
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/products/${product.id}`}>
                  <Pencil className="h-4 w-4" />
                </Link>
              </Button>
              {product.status === 'active' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    archiveProductMutation.mutate(product.id)
                  }
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [archiveProductMutation]
  );

  // Get unique categories for filter
  const categoryOptions = useMemo(() => {
    const cats = Array.from(
      new Set(products.map((p) => p.category).filter(Boolean))
    );
    return cats.map((c) => ({ label: c, value: c }));
  }, [products]);

  const handleExport = (rows: Product[], visibleColumnIds: string[]) => {
    const headers = visibleColumnIds.filter(
      (id) => !['select', 'actions', 'image'].includes(id)
    );
    const csvRows = rows.map((p) =>
      headers.map((col) => {
        switch (col) {
          case 'title':
            return p.title;
          case 'base_price_cents':
            return formatPrice(p.base_price_cents, p.currency);
          case 'status':
            return p.status;
          case 'category':
            return p.category || '';
          case 'pod_provider':
            return p.pod_provider || 'None';
          default:
            return '';
        }
      })
    );
    exportToCSV(
      headers.map((h) => h.replace(/_/g, ' ').toUpperCase()),
      csvRows,
      'products.csv'
    );
  };

  const renderMobileCard = (product: Product) => (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/products/${product.id}`}
          className="font-medium text-primary hover:underline line-clamp-2"
        >
          {product.title}
        </Link>
        <Badge
          variant={product.status === 'active' ? 'default' : 'secondary'}
        >
          {product.status === 'active' ? 'Active' : 'Archived'}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="capitalize">{product.category || '—'}</span>
        <span>•</span>
        <span className="font-medium">
          {formatPrice(product.base_price_cents, product.currency)}
        </span>
      </div>
      <div className="flex items-center justify-between border-t pt-2">
        {product.pod_provider === 'printful' ? (
          <Badge variant="default">Printful</Badge>
        ) : product.pod_provider ? (
          <Badge variant="secondary">Legacy</Badge>
        ) : (
          <Badge variant="destructive">No Provider</Badge>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="min-h-[44px]">
            <Link href={`/products/${product.id}`}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          {product.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => archiveProductMutation.mutate(product.id)}
              className="min-h-[44px]"
            >
              <Archive className="h-4 w-4 mr-1" />
              Archive
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Products</h1>
            <p className="text-muted-foreground">
              Manage your product catalog
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
              {syncAllMutation.isPending ? 'Syncing...' : 'Sync Printful'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/products/bulk-price-editor">
                <DollarSign className="h-4 w-4 mr-2" />
                Bulk Edit Prices
              </Link>
            </Button>
            <Button variant="default" asChild>
              <Link href="/products/new-pod">
                <Plus className="h-4 w-4 mr-2" />
                Create POD Product
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/products/new">
                <Plus className="h-4 w-4 mr-2" />
                Manual Product
              </Link>
            </Button>
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          columns={columns}
          data={products}
          isLoading={isLoading}
          enableSorting
          enablePagination
          enableRowSelection
          enableColumnVisibility
          pageSize={20}
          tableId="products"
          searchColumn="title"
          searchPlaceholder="Search products by name..."
          filters={[
            {
              columnId: 'status',
              label: 'Status',
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Archived', value: 'archived' },
                { label: 'Draft', value: 'draft' },
              ],
            },
            ...(categoryOptions.length > 0
              ? [
                  {
                    columnId: 'category',
                    label: 'Category',
                    options: categoryOptions,
                  },
                ]
              : []),
          ]}
          onExport={handleExport}
          renderMobileCard={renderMobileCard}
          emptyTitle="No products found"
          emptyDescription="Try adjusting your search or filter, or create a new product."
          emptyCtaLabel="Create Product"
          onEmptyCta={() => window.location.assign('/products/new')}
        />
      </div>
    </main>
  );
}
