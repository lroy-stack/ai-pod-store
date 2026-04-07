'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { adminFetch } from '@/lib/admin-api';

interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: string;
  granted: boolean;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  users: {
    email: string;
    name: string;
  };
}

interface Summary {
  totalConsents: number;
  byType: Record<
    string,
    {
      total: number;
      optIn: number;
      optInRate: number;
    }
  >;
}

export default function ConsentRecordsPage() {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalConsents: 0, byType: {} });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [consentType, setConsentType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    loadRecords();
  }, [page, consentType, startDate, endDate]);

  async function loadRecords() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (consentType) params.append('type', consentType);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await adminFetch(`/api/admin/legal/consents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setSummary(data.summary || { totalConsents: 0, byType: {} });
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error loading consent records:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportCSV() {
    try {
      const params = new URLSearchParams();
      if (consentType) params.append('type', consentType);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await adminFetch(`/api/admin/legal/consents?${params}`);
      if (res.ok) {
        const data = await res.json();
        const csvData = convertToCSV(data.records || []);
        downloadCSV(csvData, 'consent-records.csv');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  }

  function convertToCSV(data: ConsentRecord[]): string {
    const headers = ['User Email', 'User Name', 'Consent Type', 'Granted', 'Timestamp', 'IP Address'];
    const rows = data.map((record) => [
      record.users?.email || '',
      record.users?.name || '',
      record.consent_type,
      record.granted ? 'Yes' : 'No',
      new Date(record.timestamp).toISOString(),
      record.ip_address || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  function downloadCSV(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Consent Records</h1>
          <p className="text-muted-foreground mt-2">
            GDPR compliance - user consent tracking
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Consents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalConsents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Analytics Opt-In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.byType.analytics
                ? `${summary.byType.analytics.optInRate.toFixed(1)}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.byType.analytics?.optIn || 0} of {summary.byType.analytics?.total || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Marketing Opt-In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.byType.marketing
                ? `${summary.byType.marketing.optInRate.toFixed(1)}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.byType.marketing?.optIn || 0} of {summary.byType.marketing?.total || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cookies Opt-In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.byType.cookies
                ? `${summary.byType.cookies.optInRate.toFixed(1)}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.byType.cookies?.optIn || 0} of {summary.byType.cookies?.total || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="consent_type">Consent Type</Label>
              <Select value={consentType || "all"} onValueChange={(v) => setConsentType(v === "all" ? "" : v)}>
                <SelectTrigger id="consent_type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="cookies">Cookies</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="functional">Functional</SelectItem>
                  <SelectItem value="personalization">Personalization</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {(consentType || startDate || endDate) && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConsentType('');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Consent Records</CardTitle>
          <CardDescription>
            {total} total records {(consentType || startDate || endDate) && '(filtered)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No consent records found</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Consent Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{record.users?.name || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">
                              {record.users?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{record.consent_type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {record.granted ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                <span className="text-success">Granted</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-destructive" />
                                <span className="text-destructive">Withdrawn</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(record.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.ip_address || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-4">
                {records.map((record) => (
                  <Card key={record.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {record.users?.name || 'Unknown'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {record.users?.email}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="capitalize">{record.consent_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span>
                          {record.granted ? (
                            <span className="text-success">Granted</span>
                          ) : (
                            <span className="text-destructive">Withdrawn</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time:</span>
                        <span>{new Date(record.timestamp).toLocaleString()}</span>
                      </div>
                      {record.ip_address && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IP:</span>
                          <span>{record.ip_address}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
