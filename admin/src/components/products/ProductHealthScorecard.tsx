'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ShoppingCart, Star, Percent, RotateCcw, Loader2 } from 'lucide-react';

interface ProductMetrics {
  total_revenue_cents: number;
  order_count: number;
  avg_rating: number | null;
  margin_pct: number | null;
  return_count: number;
  review_count: number;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  badge?: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/40">
      <div className="mt-0.5 p-1.5 rounded-md bg-background border border-border/60">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {badge && (
          <Badge variant={badge.variant} className="mt-1 text-xs py-0 px-1.5">
            {badge.label}
          </Badge>
        )}
      </div>
    </div>
  );
}

interface ProductHealthScorecardProps {
  productId: string;
  currency?: string;
}

export function ProductHealthScorecard({ productId, currency = 'EUR' }: ProductHealthScorecardProps) {
  const [metrics, setMetrics] = useState<ProductMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      try {
        const res = await adminFetch(`/api/products/${productId}/metrics`);
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, [productId]);

  const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£';

  if (loading) {
    return (
      <Card className="border-border/40">
        <CardContent className="p-3 flex items-center justify-center h-16">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const revenueFormatted =
    metrics.total_revenue_cents > 0
      ? `${currencySymbol}${(metrics.total_revenue_cents / 100).toFixed(2)}`
      : `${currencySymbol}0.00`;

  const ratingFormatted =
    metrics.avg_rating !== null
      ? `${metrics.avg_rating} / 5`
      : 'No reviews';

  const marginFormatted =
    metrics.margin_pct !== null
      ? `${metrics.margin_pct.toFixed(1)}%`
      : 'N/A';

  const marginBadge =
    metrics.margin_pct !== null && metrics.margin_pct < 35
      ? { label: 'Low margin', variant: 'destructive' as const }
      : metrics.margin_pct !== null
      ? { label: 'Healthy', variant: 'default' as const }
      : undefined;

  return (
    <Card className="border-border/40">
      <CardContent className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <MetricCard
            icon={TrendingUp}
            label="Total Revenue"
            value={revenueFormatted}
            sub={`${metrics.order_count} unit${metrics.order_count !== 1 ? 's' : ''} sold`}
          />
          <MetricCard
            icon={ShoppingCart}
            label="Orders"
            value={metrics.order_count.toString()}
            sub="units sold"
          />
          <MetricCard
            icon={Star}
            label="Avg. Rating"
            value={ratingFormatted}
            sub={metrics.review_count > 0 ? `${metrics.review_count} review${metrics.review_count !== 1 ? 's' : ''}` : undefined}
          />
          <MetricCard
            icon={Percent}
            label="Margin"
            value={marginFormatted}
            badge={marginBadge}
          />
          <MetricCard
            icon={RotateCcw}
            label="Returns"
            value={metrics.return_count.toString()}
            badge={
              metrics.return_count > 0
                ? { label: 'Has returns', variant: 'destructive' }
                : { label: 'None', variant: 'outline' }
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
