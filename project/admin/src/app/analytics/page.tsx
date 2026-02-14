'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, DollarSign, ShoppingCart, Package, Users, Target, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

interface RFMData {
  segments: {
    champions: number;
    loyal: number;
    potential: number;
    atRisk: number;
    hibernating: number;
    lost: number;
  };
  totalCustomers: number;
  calculatedAt: string;
  source: string;
}

interface DemandData {
  historical: Array<{
    week: string;
    orders: number;
    revenue: number;
  }>;
  forecast: Array<{
    week: string;
    ordersLower: number;
    ordersForecast: number;
    ordersUpper: number;
    revenueForecast: number;
  }>;
  summary: {
    avgWeeklyOrders: number;
    avgWeeklyRevenue: number;
    trend: string;
    trendValue: number;
  };
  calculatedAt: string;
  source: string;
}

export default function AnalyticsPage() {
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [rfmData, setRfmData] = useState<RFMData | null>(null);
  const [demandData, setDemandData] = useState<DemandData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchReport(),
      fetchRFM(),
      fetchDemand()
    ]);
    setLoading(false);
  };

  const fetchReport = async () => {
    try {
      const response = await fetch('/api/admin/finance/report');
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    }
  };

  const fetchRFM = async () => {
    try {
      const response = await fetch('/api/analytics/rfm');
      if (response.ok) {
        const data = await response.json();
        setRfmData(data);
      }
    } catch (error) {
      console.error('Error fetching RFM data:', error);
    }
  };

  const fetchDemand = async () => {
    try {
      const response = await fetch('/api/analytics/demand');
      if (response.ok) {
        const data = await response.json();
        setDemandData(data);
      }
    } catch (error) {
      console.error('Error fetching demand data:', error);
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
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className="text-foreground">Admin</span>
          <span>&gt;</span>
          <span>Analytics</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Analytics & Finance</h1>
          <p className="text-muted-foreground">Financial overview and product performance</p>
        </div>
        <p className="text-center py-12 text-muted-foreground">Loading analytics data...</p>
      </div>
    );
  }

  const currency = report?.summary.currency || 'EUR';

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <span>Analytics</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Finance</h1>
          <p className="text-muted-foreground">Financial overview, customer segments, and demand forecasting</p>
        </div>
        <Button onClick={fetchAllData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* RFM Customer Segmentation */}
      {rfmData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              RFM Customer Segmentation
            </CardTitle>
            <CardDescription>
              Recency, Frequency, Monetary analysis • {rfmData.totalCustomers} total customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-success/10 rounded-lg p-4 border border-success/20">
                <p className="text-xs font-medium text-success mb-1">Champions</p>
                <p className="text-2xl font-bold">{rfmData.segments.champions}</p>
                <p className="text-xs text-muted-foreground mt-1">High R, F, M</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                <p className="text-xs font-medium text-primary mb-1">Loyal</p>
                <p className="text-2xl font-bold">{rfmData.segments.loyal}</p>
                <p className="text-xs text-muted-foreground mt-1">High F, M</p>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                <p className="text-xs font-medium text-blue-600 mb-1">Potential</p>
                <p className="text-2xl font-bold">{rfmData.segments.potential}</p>
                <p className="text-xs text-muted-foreground mt-1">High R, low F</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
                <p className="text-xs font-medium text-yellow-600 mb-1">At Risk</p>
                <p className="text-2xl font-bold">{rfmData.segments.atRisk}</p>
                <p className="text-xs text-muted-foreground mt-1">Low R, high F, M</p>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
                <p className="text-xs font-medium text-orange-600 mb-1">Hibernating</p>
                <p className="text-2xl font-bold">{rfmData.segments.hibernating}</p>
                <p className="text-xs text-muted-foreground mt-1">Low R, F, M</p>
              </div>
              <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
                <p className="text-xs font-medium text-destructive mb-1">Lost</p>
                <p className="text-2xl font-bold">{rfmData.segments.lost}</p>
                <p className="text-xs text-muted-foreground mt-1">Very low R</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Last updated: {new Date(rfmData.calculatedAt).toLocaleString()}
              {rfmData.source === 'realtime' && ' (Real-time calculation)'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Demand Forecast */}
      {demandData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Demand Forecast (4-Week Outlook)
            </CardTitle>
            <CardDescription>
              Weekly average: {demandData.summary.avgWeeklyOrders} orders •
              Trend: {demandData.summary.trend} ({demandData.summary.trendValue > 0 ? '+' : ''}{demandData.summary.trendValue} orders/week)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-6">
              {demandData.forecast.map((week) => (
                <div key={week.week} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-medium">{week.week}</div>
                  <div className="flex-1 h-10 bg-muted rounded relative">
                    {/* Lower bound */}
                    <div
                      className="absolute h-full bg-primary/20 rounded"
                      style={{ width: `${(week.ordersLower / (week.ordersUpper || 1)) * 100}%` }}
                    />
                    {/* Forecast */}
                    <div
                      className="absolute h-full bg-primary/60 rounded flex items-center px-2"
                      style={{ width: `${(week.ordersForecast / (week.ordersUpper || 1)) * 100}%` }}
                    >
                      <span className="text-xs font-medium text-foreground">
                        {week.ordersForecast} orders
                      </span>
                    </div>
                    {/* Upper bound */}
                    <div
                      className="absolute h-full bg-primary rounded opacity-30"
                      style={{ width: `${100}%` }}
                    />
                  </div>
                  <div className="w-28 text-sm text-right text-muted-foreground">
                    €{week.revenueForecast.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(demandData.calculatedAt).toLocaleString()}
              {demandData.source === 'realtime' && ' (Real-time calculation)'}
            </p>
          </CardContent>
        </Card>
      )}

      {!report && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Financial data not available</p>
          </CardContent>
        </Card>
      )}

      {report && (
        <div className="space-y-6">

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
      )}
    </div>
  );
}
