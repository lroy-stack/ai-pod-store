'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, DollarSign, ShoppingCart, Package } from 'lucide-react';

interface FinanceReport {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    currency: string;
  };
  profitAndLoss: {
    revenue: number;
    costs: number;
    grossProfit: number;
    grossMarginPercent: number;
    breakdown: {
      printifyCosts: number;
      stripeFees: number;
      operationalCosts: number;
    };
  };
  productMargins: Array<{
    productId: string;
    productName: string;
    category: string;
    revenue: number;
    quantity: number;
    estimatedMargin: number;
    marginPercent: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;
}

export default function AnalyticsPage() {
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const response = await fetch('/api/admin/finance/report');
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'eur') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Analytics & Finance</h1>
          <p className="text-center py-12 text-muted-foreground">Loading financial data...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Analytics & Finance</h1>
          <p className="text-center py-12 text-muted-foreground">Failed to load financial data</p>
        </div>
      </DashboardLayout>
    );
  }

  const currency = report.summary.currency;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Finance</h1>
          <p className="text-muted-foreground">Financial overview and product performance</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(report.summary.totalRevenue, currency)}
              </div>
              <p className="text-xs text-muted-foreground">All-time revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{report.summary.totalOrders}</div>
              <p className="text-xs text-muted-foreground">Completed orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(report.summary.averageOrderValue, currency)}
              </div>
              <p className="text-xs text-muted-foreground">Per order</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Margin</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {report.profitAndLoss.grossMarginPercent.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Profit margin</p>
            </CardContent>
          </Card>
        </div>

        {/* P&L Statement */}
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium">Revenue</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(report.profitAndLoss.revenue, currency)}
                </span>
              </div>

              <div className="space-y-2 pl-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Printify Costs</span>
                  <span className="text-red-600">
                    -{formatCurrency(report.profitAndLoss.breakdown.printifyCosts, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stripe Fees (3%)</span>
                  <span className="text-red-600">
                    -{formatCurrency(report.profitAndLoss.breakdown.stripeFees, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Operational Costs</span>
                  <span className="text-red-600">
                    -{formatCurrency(report.profitAndLoss.breakdown.operationalCosts, currency)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Total Costs</span>
                <span className="font-bold text-red-600">
                  -{formatCurrency(report.profitAndLoss.costs, currency)}
                </span>
              </div>

              <div className="flex justify-between border-t-2 pt-2">
                <span className="font-bold">Gross Profit</span>
                <span className="font-bold text-green-600 text-lg">
                  {formatCurrency(report.profitAndLoss.grossProfit, currency)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Chart (Simple Bar Chart using divs) */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.monthlyRevenue.map((month) => {
                const maxRevenue = Math.max(...report.monthlyRevenue.map(m => m.revenue), 1);
                const widthPercent = (month.revenue / maxRevenue) * 100;

                return (
                  <div key={month.month} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-muted-foreground">{month.month}</div>
                    <div className="flex-1 h-8 bg-muted rounded relative">
                      <div
                        className="h-full bg-primary rounded flex items-center px-2"
                        style={{ width: `${widthPercent}%` }}
                      >
                        {month.revenue > 0 && (
                          <span className="text-xs font-medium text-primary-foreground">
                            {formatCurrency(month.revenue, currency)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right text-muted-foreground">
                      {month.orders} orders
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Product Margins */}
        <Card>
          <CardHeader>
            <CardTitle>Product Performance & Margins</CardTitle>
          </CardHeader>
          <CardContent>
            {report.productMargins.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No product data available</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Est. Margin</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.productMargins.map((product) => (
                    <TableRow key={product.productId}>
                      <TableCell className="font-medium">{product.productName}</TableCell>
                      <TableCell className="capitalize">{product.category}</TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(product.revenue, currency)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(product.estimatedMargin, currency)}
                      </TableCell>
                      <TableCell className="text-right">{product.marginPercent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
