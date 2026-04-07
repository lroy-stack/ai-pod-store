'use client';

import { useState, useEffect } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface StoreSettings {
  store_name: string;
  store_description: string;
  contact_email: string;
  support_email: string;
  currency: string;
  timezone: string;
}

export function StoreSettingsTab() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await adminFetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || data);
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof StoreSettings, value: string) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    setIsDirty(true);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        toast.success('Settings saved');
        setIsDirty(false);
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading settings...
        </CardContent>
      </Card>
    );
  }

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
          <CardTitle>Store Information</CardTitle>
          <p className="text-sm text-muted-foreground">Basic information about your store</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Store Name</Label>
            <Input
              value={settings.store_name}
              onChange={(e) => updateField('store_name', e.target.value)}
            />
          </div>
          <div>
            <Label>Store Description</Label>
            <Input
              value={settings.store_description}
              onChange={(e) => updateField('store_description', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <p className="text-sm text-muted-foreground">Email addresses for customer communications</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={settings.contact_email}
                onChange={(e) => updateField('contact_email', e.target.value)}
              />
            </div>
            <div>
              <Label>Support Email</Label>
              <Input
                type="email"
                value={settings.support_email}
                onChange={(e) => updateField('support_email', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => updateField('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  <SelectItem value="USD">USD (Dollar)</SelectItem>
                  <SelectItem value="GBP">GBP (Pound)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={(v) => updateField('timezone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/Berlin">Europe/Berlin (CET)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                  <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
