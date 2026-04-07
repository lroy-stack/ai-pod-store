'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      printfulCosts: number;
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
  categoryMarginBreakdown: Array<{
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

export default function FinancePage() {
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');

  useEffect(() => {
    fetchReport();
  }, [paymentMethodFilter]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (paymentMethodFilter && paymentMethodFilter !== 'all') {
        params.set('paymentMethod', paymentMethodFilter);
      }
      const qs = params.toString();
      const path = `/api/admin/finance/report${qs ? `?${qs}` : ''}`;
      const response = await adminFetch(path);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Error fetching finance report:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const handleExport = async () => {
    try {
      const response = await adminFetch('/api/admin/finance/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ report }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting finance report:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className="text-foreground">Admin</span>
          <span>&gt;</span>
          <span>Finance</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Finance Reports</h1>
          <p className="text-muted-foreground">Profit & Loss, Cash Flow, and Revenue Analysis</p>
        </div>
        <p className="text-center py-12 text-muted-foreground">Loading financial data...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className="text-foreground">Admin</span>
          <span>&gt;</span>
          <span>Finance</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Finance Reports</h1>
          <p className="text-muted-foreground">Profit & Loss, Cash Flow, and Revenue Analysis</p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Financial data not available</p>
            <Button onClick={fetchReport} variant="outline" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = report.summary.currency || 'EUR';

  // Calculate cash flow statement components
  const operatingCashFlow = report.profitAndLoss.grossProfit; // Simplified: gross profit as proxy
  const investingCashFlow = 0; // Not tracked yet
  const financingCashFlow = 0; // Not tracked yet
  const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <span>Finance</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finance Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive financial overview and performance metrics
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="crypto">Crypto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" disabled={!report}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={fetchReport} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
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
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-success" />
              All-time revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(report.profitAndLoss.grossProfit, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {report.profitAndLoss.grossMarginPercent.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(report.profitAndLoss.costs, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((report.profitAndLoss.costs / report.profitAndLoss.revenue) * 100).toFixed(1)}% of revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(report.summary.averageOrderValue, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {report.summary.totalOrders} orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Profit & Loss Statement</CardTitle>
          <CardDescription>Detailed breakdown of revenue and expenses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Revenue Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2">
                <span className="text-lg font-semibold">Revenue</span>
                <span className="text-lg font-bold text-success">
                  {formatCurrency(report.profitAndLoss.revenue, currency)}
                </span>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Costs Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2">
                <span className="text-lg font-semibold">Cost of Goods Sold</span>
                <span className="text-lg font-bold text-destructive">
                  {formatCurrency(report.profitAndLoss.costs, currency)}
                </span>
              </div>

              <div className="space-y-2 pl-4 text-sm border-l-2 border-muted ml-2">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Printful Production Costs</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(report.profitAndLoss.breakdown.printfulCosts, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Payment Processing (Stripe 3%)</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(report.profitAndLoss.breakdown.stripeFees, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Operational & Platform Costs</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(report.profitAndLoss.breakdown.operationalCosts, currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-px bg-border my-4" />

            {/* Net Profit */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xl font-bold">Gross Profit</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    After deducting all costs
                  </p>
                </div>
                <span className="text-2xl font-bold text-success">
                  {formatCurrency(report.profitAndLoss.grossProfit, currency)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Statement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Cash Flow Statement</CardTitle>
          <CardDescription>Simplified cash flow analysis (operating activities)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Operating Cash Flow</TableCell>
                <TableCell className="text-right font-medium text-success">
                  {formatCurrency(operatingCashFlow, currency)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Investing Cash Flow</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(investingCashFlow, currency)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Financing Cash Flow</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(financingCashFlow, currency)}
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold">Net Cash Flow</TableCell>
                <TableCell className="text-right font-bold text-success">
                  {formatCurrency(netCashFlow, currency)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-4">
            Note: Cash flow is simplified and based on gross profit. Full cash flow accounting (receivables, payables, inventory) will be added in future versions.
          </p>
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Revenue Trends</CardTitle>
          <CardDescription>Monthly revenue over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          {report.monthlyRevenue.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No revenue data available</p>
          ) : (
            <div className="space-y-3">
              {report.monthlyRevenue.map((month) => {
                const maxRevenue = Math.max(...report.monthlyRevenue.map(m => m.revenue), 1);
                const widthPercent = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;

                return (
                  <div key={month.month} className="flex items-center gap-4">
                    <div className="w-28 text-sm font-medium text-muted-foreground">
                      {month.month}
                    </div>
                    <div className="flex-1 h-10 bg-muted rounded-lg relative overflow-hidden">
                      {month.revenue > 0 ? (
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/80 flex items-center px-3 transition-all duration-300"
                          style={{ width: `${widthPercent}%` }}
                        >
                          <span className="text-xs font-semibold text-primary-foreground">
                            {formatCurrency(month.revenue, currency)}
                          </span>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">No data</span>
                        </div>
                      )}
                    </div>
                    <div className="w-24 text-sm text-right text-muted-foreground">
                      {month.orders} {month.orders === 1 ? 'order' : 'orders'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
