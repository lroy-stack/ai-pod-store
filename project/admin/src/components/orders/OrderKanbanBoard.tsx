'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Order } from '@/hooks/queries/useOrders';

interface KanbanColumn {
  id: string;
  title: string;
  statuses: string[];
  color: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'pending', title: 'Pending Payment', statuses: ['pending'], color: 'bg-warning/10 border-warning/30' },
  { id: 'paid', title: 'Paid', statuses: ['paid', 'processing'], color: 'bg-primary/10 border-primary/30' },
  { id: 'in_production', title: 'In Production', statuses: ['submitted', 'production', 'in_production'], color: 'bg-primary/10 border-primary/30' },
  { id: 'shipped', title: 'Shipped', statuses: ['shipped'], color: 'bg-warning/10 border-warning/30' },
  { id: 'delivered', title: 'Delivered', statuses: ['delivered'], color: 'bg-success/10 border-success/30' },
];

const COLUMN_BADGE_COLORS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning',
  paid: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary',
  in_production: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary',
  shipped: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning',
  delivered: 'bg-success/10 text-success dark:bg-success/20 dark:text-success',
};

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function getDaysInStatus(order: Order): number {
  const date = new Date(order.created_at);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

interface OrderCardProps {
  order: Order;
}

function OrderCard({ order }: OrderCardProps) {
  const days = getDaysInStatus(order);
  const customerName = order.user?.name || order.user?.email || order.customer_email || 'Guest';
  const daysLabel = days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`;

  return (
    <Link href={`/orders/${order.id}`} className="block">
      <Card className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-150 mb-3">
        <CardContent className="p-3 space-y-2">
          {/* Order ID */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-primary font-medium">
              #{order.id.substring(0, 8)}
            </span>
            <span className="text-xs text-muted-foreground">{daysLabel}</span>
          </div>
          {/* Customer */}
          <p className="text-sm truncate text-foreground font-medium" title={customerName}>
            {customerName.length > 24 ? customerName.substring(0, 24) + '…' : customerName}
          </p>
          {/* Total + provider */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">
              {formatCurrency(order.total_cents, order.currency)}
            </span>
            {order.pod_provider === 'printful' && (
              <Badge variant="default" className="text-xs py-0">Printful</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

interface OrderKanbanBoardProps {
  orders: Order[];
  isLoading?: boolean;
}

export function OrderKanbanBoard({ orders, isLoading }: OrderKanbanBoardProps) {
  // Group orders by column
  const columnOrders = KANBAN_COLUMNS.map((col) => ({
    ...col,
    orders: orders.filter((o) => col.statuses.includes(o.status)),
  }));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {KANBAN_COLUMNS.map((col) => (
          <div key={col.id} className="rounded-lg border border-border bg-muted/30 p-3 min-h-[200px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-[900px]">
        {columnOrders.map((col) => (
          <div
            key={col.id}
            className={`flex-1 min-w-[200px] rounded-lg border p-3 ${col.color}`}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
              <span
                className={`inline-flex items-center justify-center rounded-full text-xs font-bold px-2 py-0.5 min-w-[24px] ${COLUMN_BADGE_COLORS[col.id]}`}
              >
                {col.orders.length}
              </span>
            </div>

            {/* Order cards */}
            <div className="space-y-0">
              {col.orders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No orders</p>
              ) : (
                col.orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
