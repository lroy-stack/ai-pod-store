'use client';

import { useState, useEffect } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface ShippingRate {
  country_code: string;
  standard_rate_cents: number;
  standard_days_min: number;
  standard_days_max: number;
}

interface ShippingConfig {
  free_shipping_threshold_cents: number;
  allowed_countries: string[];
  rates: ShippingRate[];
  express_enabled: boolean;
}

export function ShippingSettingsTab() {
  const [config, setConfig] = useState<ShippingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const res = await adminFetch('/api/admin/settings/shipping');
      if (res.ok) {
        setConfig(await res.json());
      }
    } catch {
      toast.error('Failed to load shipping config');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/settings/shipping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Shipping settings saved');
        setIsDirty(false);
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.formErrors?.[0] || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading shipping configuration...
        </CardContent>
      </Card>
    );
  }

  const thresholdEur = (config.free_shipping_threshold_cents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!isDirty || saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Free Shipping Threshold
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Free shipping for orders above (EUR)</Label>
            <Input
              type="number"
              step="0.01"
              value={thresholdEur}
              onChange={(e) => {
                setConfig({ ...config, free_shipping_threshold_cents: Math.round(parseFloat(e.target.value) * 100) || 0 });
                setIsDirty(true);
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Express Shipping</Label>
              <p className="text-xs text-muted-foreground">Offer express delivery option at checkout</p>
            </div>
            <Switch
              checked={config.express_enabled}
              onCheckedChange={(v) => { setConfig({ ...config, express_enabled: v }); setIsDirty(true); }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping Rates</CardTitle>
          <p className="text-sm text-muted-foreground">Standard shipping rates by country</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {config.rates.map((rate, i) => (
              <div key={rate.country_code} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Badge variant="outline" className="w-10 justify-center">{rate.country_code}</Badge>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Rate (EUR)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(rate.standard_rate_cents / 100).toFixed(2)}
                      onChange={(e) => {
                        const rates = [...config.rates];
                        rates[i] = { ...rate, standard_rate_cents: Math.round(parseFloat(e.target.value) * 100) || 0 };
                        setConfig({ ...config, rates });
                        setIsDirty(true);
                      }}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Min days</Label>
                    <Input
                      type="number"
                      value={rate.standard_days_min}
                      onChange={(e) => {
                        const rates = [...config.rates];
                        rates[i] = { ...rate, standard_days_min: parseInt(e.target.value) || 1 };
                        setConfig({ ...config, rates });
                        setIsDirty(true);
                      }}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max days</Label>
                    <Input
                      type="number"
                      value={rate.standard_days_max}
                      onChange={(e) => {
                        const rates = [...config.rates];
                        rates[i] = { ...rate, standard_days_max: parseInt(e.target.value) || 1 };
                        setConfig({ ...config, rates });
                        setIsDirty(true);
                      }}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowed Countries</CardTitle>
          <p className="text-sm text-muted-foreground">{config.allowed_countries.length} countries enabled</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {config.allowed_countries.map((c) => (
              <Badge key={c} variant="secondary">{c}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
