'use client';

import { Badge } from '@/components/ui/badge';

interface MarginCalculatorProps {
  retailPriceCents: number;
  avgBaseCostCents: number;
  currency?: string;
}

export function MarginCalculator({
  retailPriceCents,
  avgBaseCostCents,
  currency = 'EUR',
}: MarginCalculatorProps) {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£';

  // Stripe fee: 2.9% + €0.25
  const stripeFee = Math.round(retailPriceCents * 0.029 + 25);
  const profit = retailPriceCents - avgBaseCostCents - stripeFee;
  const marginPct =
    retailPriceCents > 0 ? (profit / retailPriceCents) * 100 : 0;

  const fmt = (cents: number) =>
    `${symbol}${(cents / 100).toFixed(2)}`;

  const isLowMargin = marginPct < 35;

  // Visual bar proportions (clamped to 0–100%)
  const total = retailPriceCents > 0 ? retailPriceCents : 1;
  const costPct = Math.min(100, (avgBaseCostCents / total) * 100);
  const feePct = Math.min(100 - costPct, (stripeFee / total) * 100);
  const profitPct = Math.max(0, 100 - costPct - feePct);

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/40">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Margin Breakdown</p>
        <Badge variant={isLowMargin ? 'destructive' : 'default'} className="text-xs">
          {isLowMargin ? `⚠ Low margin ${marginPct.toFixed(1)}%` : `${marginPct.toFixed(1)}% margin`}
        </Badge>
      </div>

      {/* Visual bar */}
      <div className="h-4 rounded-full overflow-hidden flex w-full">
        <div
          className="bg-destructive/70 h-full transition-all"
          style={{ width: `${costPct}%` }}
          title={`Base cost: ${fmt(avgBaseCostCents)}`}
        />
        <div
          className="bg-warning/70 h-full transition-all"
          style={{ width: `${feePct}%` }}
          title={`Stripe fee: ${fmt(stripeFee)}`}
        />
        <div
          className="bg-emerald-500/70 h-full flex-1 transition-all"
          title={`Profit: ${fmt(profit)}`}
        />
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-destructive/70 flex-shrink-0" />
          <div>
            <p className="text-muted-foreground">Base cost</p>
            <p className="font-medium">{fmt(avgBaseCostCents)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-warning/70 flex-shrink-0" />
          <div>
            <p className="text-muted-foreground">Stripe fee</p>
            <p className="font-medium">{fmt(stripeFee)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70 flex-shrink-0" />
          <div>
            <p className="text-muted-foreground">Profit</p>
            <p className={`font-medium ${profit < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              {fmt(profit)}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Stripe fee = 2.9% + {symbol}0.25 per transaction
      </p>
    </div>
  );
}
