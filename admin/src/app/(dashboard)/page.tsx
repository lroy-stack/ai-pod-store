'use client';

import { useState } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ShoppingCart, Package, TrendingUp, TrendingDown, Users, CreditCard, UserMinus, ArrowUp, ArrowDown } from 'lucide-react';
import { ActivityFeed } from '@/components/ActivityFeed';
import { QuickActions } from '@/components/QuickActions';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardStats {
  revenue: number;
  revenueTrend: number;
  ordersCount: number;
  ordersTrend: number;
  productsCount: number;
  productsTrend: number;
  conversionRate: string;
  conversionRateTrend: number;
  // Subscription metrics
  activeSubscribers: number;
  mrr: number;
  churnedThisMonth: number;
}

interface RecentOrder {
  id: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
}

// Trend indicator component
function TrendIndicator({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-xs text-muted-foreground">No change</span>;
  }

  const isPositive = value > 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  const colorClass = isPositive ? 'text-success' : 'text-destructive';

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function DashboardPage() {
  // Chart data state
  const [revenuePeriod, setRevenuePeriod] = useState<'7d' | '30d' | '90d'>('30d'); // Default to 30d for this feature
  const [revenueChartView, setRevenueChartView] = useState<'revenue' | 'orders'>('revenue');

  // Fetch dashboard stats
  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await adminFetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json() as Promise<DashboardStats>;
    },
  });

  // Fetch recent orders
  const { data: recentOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['dashboard-recent-orders'],
    queryFn: async () => {
      const res = await adminFetch('/api/dashboard/recent-orders');
      if (!res.ok) throw new Error('Failed to fetch recent orders');
      return res.json() as Promise<RecentOrder[]>;
    },
  });

  // Fetch revenue trend (depends on period)
  const { data: revenueData = [], isLoading: revenueLoading } = useQuery({
    queryKey: ['dashboard-revenue-trend', revenuePeriod],
    queryFn: async () => {
      const res = await adminFetch(`/api/dashboard/revenue-trend?period=${revenuePeriod}`);
      if (!res.ok) throw new Error('Failed to fetch revenue trend');
      return res.json() as Promise<any[]>;
    },
  });

  // Fetch top products
  const { data: topProductsData = [], isLoading: topProductsLoading } = useQuery({
    queryKey: ['dashboard-top-products'],
    queryFn: async () => {
      const res = await adminFetch('/api/dashboard/top-products');
      if (!res.ok) throw new Error('Failed to fetch top products');
      return res.json() as Promise<any[]>;
    },
  });

  // Fetch customer acquisition
  const { data: customerAcquisitionData = [], isLoading: customerAcquisitionLoading } = useQuery({
    queryKey: ['dashboard-customer-acquisition'],
    queryFn: async () => {
      const res = await adminFetch('/api/dashboard/customer-acquisition');
      if (!res.ok) throw new Error('Failed to fetch customer acquisition');
      return res.json() as Promise<any[]>;
    },
  });

  // Combine chart loading states
  const chartsLoading = revenueLoading || topProductsLoading || customerAcquisitionLoading;

  if (loading) {
    return (
      <main>
          <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-4 bg-muted rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-32 bg-muted rounded mb-2" />
                  <div className="h-3 w-40 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
    );
  }

  return (
    <main>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{stats?.revenue.toFixed(2) || '0.00'}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
              {stats && <TrendIndicator value={stats.revenueTrend} />}
            </div>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.ordersCount || 0}</div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
              {stats && <TrendIndicator value={stats.ordersTrend} />}
            </div>
          </CardContent>
        </Card>

        {/* Active Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.productsCount || 0}</div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Currently listed
              </p>
              {stats && <TrendIndicator value={stats.productsTrend} />}
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.conversionRate || '0.0'}%</div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
              {stats && <TrendIndicator value={stats.conversionRateTrend} />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
        <QuickActions />
      </div>

      {/* Subscription Metrics Section */}
      <div className="mt-6">
        <h2 className="text-2xl font-bold mb-4">Subscription Analytics</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Active Subscribers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeSubscribers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Premium tier users
              </p>
            </CardContent>
          </Card>

          {/* Monthly Recurring Revenue */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                €{stats?.mrr.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                From active subscriptions
              </p>
            </CardContent>
          </Card>

          {/* Churned This Month */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churned This Month</CardTitle>
              <UserMinus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.churnedThisMonth || 0}</div>
              <p className="text-xs text-muted-foreground">
                Cancelled subscriptions
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {/* Revenue Trend Chart */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>30-Day Trend</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={revenueChartView === 'revenue' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRevenueChartView('revenue')}
                >
                  Revenue
                </Button>
                <Button
                  variant={revenueChartView === 'orders' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRevenueChartView('orders')}
                >
                  Orders
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <div className="h-[200px] md:h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Loading chart...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300} className="h-[200px] md:h-[300px]">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) =>
                      revenueChartView === 'revenue'
                        ? [`€${value.toFixed(2)}`, 'Revenue']
                        : [value, 'Orders']
                    }
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      padding: '8px 12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={revenueChartView}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Selling Products Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Loading chart...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProductsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Acquisition Chart */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Customer Acquisition (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartsLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Loading chart...</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={customerAcquisitionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => [value, 'New Customers']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Line type="monotone" dataKey="customers" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders and Activity Feed */}
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {/* Recent Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No recent orders</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">
                        {order.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.customerName}</span>
                          <span className="text-xs text-muted-foreground">
                            {order.customerEmail}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.status === 'completed'
                              ? 'default'
                              : order.status === 'pending'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.currency === 'EUR' ? '€' : '$'}
                        {order.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <ActivityFeed />
      </div>
    </main>
  );
}
