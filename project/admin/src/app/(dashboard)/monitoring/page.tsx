'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Activity,
  Calendar,
  Webhook,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number | null;
  lastChecked: string;
  detail?: string;
}

interface CronJob {
  name: string;
  label: string;
  description: string;
  lastRun: string | null;
  finishedAt: string | null;
  status: string;
  durationMs: number | null;
  errorMessage: string | null;
  rowsAffected: number | null;
}

interface WebhookEvent {
  id: string;
  source: string;
  eventType: string;
  eventId: string;
  status: string;
  statusCode: number | null;
  processedAt: string;
}

interface IntegrityCheck {
  name: string;
  description: string;
  count: number;
  severity: 'critical' | 'warning' | 'info';
  viewPath: string;
}

interface ErrorLog {
  id: string;
  message: string;
  stack: string | null;
  url: string | null;
  error_hash: string;
  count: number;
  first_seen: string;
  last_seen: string;
}

interface TrendData { date: string; count: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) {
  const classes = {
    healthy: 'bg-success',
    degraded: 'bg-warning',
    unhealthy: 'bg-destructive',
  };
  return (
    <span className={`inline-block w-3 h-3 rounded-full ${classes[status]} flex-shrink-0`} />
  );
}

function StatusIcon({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) {
  if (status === 'healthy') return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (status === 'degraded') return <AlertCircle className="h-5 w-5 text-warning" />;
  return <XCircle className="h-5 w-5 text-destructive" />;
}

function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  if (severity === 'critical') return <Badge variant="destructive">Critical</Badge>;
  if (severity === 'warning') return <Badge variant="secondary" className="bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning">Warning</Badge>;
  return <Badge variant="outline">Info</Badge>;
}

function formatLatency(ms: number | null) {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(ts: string | null) {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString();
}

function CronStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <Badge className="bg-success/10 text-success dark:bg-success/20 dark:text-success border-0">Completed</Badge>;
    case 'running': return <Badge className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary border-0">Running</Badge>;
    case 'failed': return <Badge variant="destructive">Failed</Badge>;
    case 'skipped': return <Badge variant="secondary">Skipped</Badge>;
    default: return <Badge variant="outline" className="text-muted-foreground">Never Run</Badge>;
  }
}

// ─── Health Tab ───────────────────────────────────────────────────────────────

function HealthTab() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/monitoring/health');
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {lastRefresh ? `Last refreshed: ${lastRefresh.toLocaleTimeString()} · Auto-refreshes every 30s` : 'Loading...'}
        </p>
        <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && services.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-32" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-20 mb-2" />
                  <div className="h-3 bg-muted rounded w-24" />
                </CardContent>
              </Card>
            ))
          : services.map((svc) => (
              <Card key={svc.name} className="relative overflow-hidden">
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    svc.status === 'healthy' ? 'bg-success' : svc.status === 'degraded' ? 'bg-warning' : 'bg-destructive'
                  }`}
                />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{svc.name}</CardTitle>
                    <StatusIcon status={svc.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StatusDot status={svc.status} />
                    <span className="text-sm font-medium capitalize">{svc.status}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Activity className="h-3 w-3" />
                    <span>Latency: <span className="font-mono">{formatLatency(svc.latencyMs)}</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Checked: {formatTime(svc.lastChecked)}</span>
                  </div>
                  {svc.detail && (
                    <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 break-all">
                      {svc.detail}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}

// ─── Crons Tab ────────────────────────────────────────────────────────────────

function CronsTab() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCrons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/monitoring/crons');
      if (res.ok) {
        const data = await res.json();
        setCronJobs(data.cronJobs || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCrons(); }, [fetchCrons]);

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchCrons}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      {cronJobs.map((cron) => (
        <Card key={cron.name}>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cron.label}</span>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded text-muted-foreground">{cron.name}</code>
                </div>
                <p className="text-xs text-muted-foreground">{cron.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <CronStatusBadge status={cron.status} />
                <span className="text-muted-foreground text-xs">
                  Last run: {formatTime(cron.lastRun)}
                </span>
                {cron.durationMs !== null && (
                  <span className="text-muted-foreground text-xs">
                    Duration: {cron.durationMs}ms
                  </span>
                )}
                {cron.rowsAffected !== null && (
                  <span className="text-muted-foreground text-xs">
                    {cron.rowsAffected} rows
                  </span>
                )}
              </div>
            </div>
            {cron.errorMessage && (
              <div className="mt-2 text-xs text-destructive bg-destructive/10 rounded p-2">
                {cron.errorMessage}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Webhooks Tab ─────────────────────────────────────────────────────────────

function WebhooksTab() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchWebhooks = useCallback(async (source?: string) => {
    setLoading(true);
    try {
      const qs = source && source !== 'all' ? `?source=${source}` : '';
      const res = await adminFetch(`/api/monitoring/webhooks${qs}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setProviders(data.providers || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const handleSourceChange = (val: string) => {
    setSourceFilter(val);
    fetchWebhooks(val);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <p className="text-sm text-muted-foreground">Last 100 webhook events</p>
        <div className="flex gap-2">
          <Select value={sourceFilter} onValueChange={handleSourceChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchWebhooks(sourceFilter)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No webhook events found
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Timestamp</th>
                  <th className="text-left p-3 font-medium">Source</th>
                  <th className="text-left p-3 font-medium">Event Type</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((evt) => (
                  <>
                    <tr
                      key={evt.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => toggleExpand(evt.id)}
                    >
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(evt.processedAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs capitalize">{evt.source}</Badge>
                      </td>
                      <td className="p-3 font-mono text-xs">{evt.eventType}</td>
                      <td className="p-3">
                        <Badge
                          variant={evt.status === 'success' ? 'default' : evt.status === 'error' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {evt.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <code className="truncate max-w-[200px]">{evt.eventId}</code>
                          {expanded.has(evt.id) ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                        </div>
                      </td>
                    </tr>
                    {expanded.has(evt.id) && (
                      <tr key={`${evt.id}-expanded`} className="bg-muted/20">
                        <td colSpan={5} className="p-3">
                          <pre className="text-xs overflow-x-auto bg-muted rounded p-3 max-h-48">
                            {JSON.stringify(evt, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Integrity Tab ────────────────────────────────────────────────────────────

function IntegrityTab() {
  const [checks, setChecks] = useState<IntegrityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  const fetchIntegrity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/monitoring/integrity');
      if (res.ok) {
        const data = await res.json();
        setChecks(data.checks || []);
        setTimestamp(data.timestamp || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntegrity(); }, [fetchIntegrity]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {timestamp ? `Last checked: ${new Date(timestamp).toLocaleString()}` : 'Loading...'}
        </p>
        <Button variant="outline" size="sm" onClick={fetchIntegrity} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Re-check
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {checks.map((check) => (
            <Card key={check.name} className={check.count > 0 && check.severity !== 'info' ? 'border-yellow-300 dark:border-yellow-700' : ''}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {check.count === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      ) : check.severity === 'critical' ? (
                        <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm">{check.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">{check.description}</p>
                  </div>
                  <div className="flex items-center gap-3 pl-6 sm:pl-0">
                    <span className="text-2xl font-bold tabular-nums">{check.count}</span>
                    <div className="flex flex-col gap-1">
                      <SeverityBadge severity={check.severity} />
                      {check.count > 0 && (
                        <a
                          href={check.viewPath}
                          className="text-xs text-primary hover:underline"
                        >
                          View affected
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Errors Tab (existing) ────────────────────────────────────────────────────

function ErrorsTab() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [stats, setStats] = useState({ totalErrors: 0, uniqueErrors: 0, days: 7 });
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/monitoring/errors?days=${days}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setErrors(data.errors || []);
        setTrends(data.trends || []);
        setStats(data.stats || { totalErrors: 0, uniqueErrors: 0, days });
      }
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[1, 7, 30].map((d) => (
          <Button
            key={d}
            variant={days === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(d)}
          >
            {d === 1 ? '24h' : `${d}d`}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalErrors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last {stats.days} days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unique Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueErrors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Distinct error types</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.uniqueErrors > 0 ? (stats.totalErrors / stats.uniqueErrors).toFixed(1) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Errors per type</p>
          </CardContent>
        </Card>
      </div>

      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Error Frequency Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Top Errors by Frequency</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : errors.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              No errors found for the selected period
            </div>
          ) : (
            <div className="space-y-4">
              {errors.map((error) => (
                <div key={error.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">{error.count}x</Badge>
                        <span className="text-sm font-mono text-muted-foreground truncate">
                          {error.url || 'No URL'}
                        </span>
                      </div>
                      <p className="font-medium text-sm mb-1 break-words">{error.message}</p>
                      {error.stack && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Monitoring</h1>
        <p className="text-muted-foreground mt-1">
          System health, cron jobs, webhooks, data integrity, and error tracking
        </p>
      </div>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full md:w-auto">
          <TabsTrigger value="health" className="flex items-center gap-1.5">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Health</span>
          </TabsTrigger>
          <TabsTrigger value="crons" className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Crons</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-1.5">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="integrity" className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Integrity</span>
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Errors</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          <HealthTab />
        </TabsContent>

        <TabsContent value="crons">
          <CronsTab />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksTab />
        </TabsContent>

        <TabsContent value="integrity">
          <IntegrityTab />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
