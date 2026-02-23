'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingUp, Layers } from 'lucide-react';

interface ErrorLog {
  id: string;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  error_hash: string;
  count: number;
  first_seen: string;
  last_seen: string;
}

interface TrendData {
  date: string;
  count: number;
}

interface ErrorStats {
  totalErrors: number;
  uniqueErrors: number;
  days: number;
}

interface MonitoringData {
  errors: ErrorLog[];
  trends: TrendData[];
  stats: ErrorStats;
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await adminFetch(`/api/monitoring/errors?days=${days}&limit=50`);
      if (!response.ok) {
        throw new Error('Failed to fetch error data');
      }
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading error data...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">Failed to load error data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Error Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Track and analyze client-side errors
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={days === 1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(1)}
          >
            24h
          </Button>
          <Button
            variant={days === 7 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(7)}
          >
            7d
          </Button>
          <Button
            variant={days === 30 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(30)}
          >
            30d
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalErrors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last {data.stats.days} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique Errors</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.uniqueErrors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Distinct error types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Frequency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.stats.uniqueErrors > 0
                ? (data.stats.totalErrors / data.stats.uniqueErrors).toFixed(1)
                : '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Errors per type
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Error Frequency Trend</CardTitle>
          <CardDescription>
            Number of errors over time (last {data.stats.days} days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No error data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error List */}
      <Card>
        <CardHeader>
          <CardTitle>Top Errors by Frequency</CardTitle>
          <CardDescription>
            Most common errors (showing top 50)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.errors.length > 0 ? (
            <div className="space-y-4">
              {data.errors.map((error) => (
                <div
                  key={error.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">{error.count}x</Badge>
                        <span className="text-sm font-mono text-muted-foreground truncate">
                          {error.url || 'No URL'}
                        </span>
                      </div>
                      <p className="font-medium text-sm mb-1 break-words">
                        {error.message}
                      </p>
                      {error.stack && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            View stack trace
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {error.stack}
                          </pre>
                        </details>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>First: {new Date(error.first_seen).toLocaleString()}</span>
                        <span>Last: {new Date(error.last_seen).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              No errors found for the selected period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
