'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  productId: string;
  providerProductId: string | null;
  lastSyncedAt: string | null;
}

export function PrintfulSyncPanel({ productId, providerProductId, lastSyncedAt }: Props) {
  const queryClient = useQueryClient();

  // Fetch Printful data
  const { data, isLoading, error } = useQuery({
    queryKey: ['printful-product', productId],
    queryFn: async () => {
      const res = await adminFetch(`/api/products/${productId}/printful`);
      if (!res.ok) throw new Error('Failed to fetch Printful data');
      return res.json();
    },
    enabled: !!providerProductId,
    staleTime: 60_000,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch(`/api/products/${productId}/sync`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Sync failed');
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast.success(`Synced ${result.variants_synced} variants from Printful`);
      queryClient.invalidateQueries({ queryKey: ['printful-product', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    },
  });

  if (!providerProductId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>This product is not linked to a Printful provider.</p>
          <p className="text-sm mt-1">Create it via PodClaw or link manually.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync Status + Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <img src="https://files.cdn.printful.com/upload/brand/printful-brand-icon-1.png" alt="Printful" className="h-5 w-5" />
            Printful Provider
          </CardTitle>
          <div className="flex items-center gap-2">
            {data?.printful_dashboard_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={data.printful_dashboard_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open in Printful
                </a>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Provider ID</p>
              <p className="font-mono text-xs">{providerProductId}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Synced</p>
              <p>{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Variants</p>
              <p>{data?.sync_product?.variants_count ?? '—'} total, {data?.sync_product?.synced_count ?? '—'} synced</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              {data?.sync_product?.is_ignored ? (
                <Badge variant="secondary">Ignored</Badge>
              ) : (
                <Badge className="bg-success text-success-foreground">Active</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variants from Printful */}
      {data?.variants && data.variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provider Variants ({data.variants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead>Catalog Product</TableHead>
                  <TableHead>Retail Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Files</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.variants.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {v.catalog_image && (
                          <img src={v.catalog_image} alt="" className="h-8 w-8 rounded object-cover" />
                        )}
                        {v.catalog_product}
                      </div>
                    </TableCell>
                    <TableCell>{v.retail_price} {v.currency}</TableCell>
                    <TableCell>
                      {v.synced ? (
                        <Badge className="bg-success/10 text-success"><CheckCircle className="h-3 w-3 mr-1" />Synced</Badge>
                      ) : (
                        <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Not synced</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {v.files?.map((f: any, i: number) => (
                          f.preview_url && (
                            <a key={i} href={f.preview_url} target="_blank" rel="noopener noreferrer">
                              <img src={f.thumbnail_url || f.preview_url} alt={f.type} className="h-8 w-8 rounded border border-border object-cover" />
                            </a>
                          )
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Loading Printful data...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-center text-destructive">
            Failed to load Printful data: {error instanceof Error ? error.message : 'Unknown error'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
