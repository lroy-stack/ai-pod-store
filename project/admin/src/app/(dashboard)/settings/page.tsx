'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, Loader2, Check, Bell } from 'lucide-react';

interface AdminSettings {
  id: number;
  settings: {
    store_name: string;
    store_description: string;
    contact_email: string;
    support_email: string;
    currency: string;
    timezone: string;
  };
  updated_at: string;
}

interface AdminRole {
  id: string;
  name: string;
  permissions: Record<string, string[]>;
}

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC - Coordinated Universal Time' },
  { value: 'America/New_York', label: 'America/New_York - Eastern Time' },
  { value: 'America/Chicago', label: 'America/Chicago - Central Time' },
  { value: 'America/Denver', label: 'America/Denver - Mountain Time' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles - Pacific Time' },
  { value: 'Europe/London', label: 'Europe/London - GMT' },
  { value: 'Europe/Paris', label: 'Europe/Paris - CET' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo - JST' },
];

const RESOURCES = ['products', 'orders', 'designs', 'themes', 'users', 'analytics', 'finance', 'settings', 'roles'];
const ACTIONS = ['read', 'create', 'update', 'delete', 'publish', 'moderate', 'refund', 'export', 'manage_roles'];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings['settings']>({
    store_name: '',
    store_description: '',
    contact_email: '',
    support_email: '',
    currency: 'USD',
    timezone: 'UTC',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({
    new_order: true,
    agent_cycle: true,
    sync_error: true,
    webhook_failed: true,
    margin_alert: true,
    integrity_issue: true,
    order_min_eur: 0,
    margin_threshold: 35,
  });
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchRoles();
  }, []);

  async function fetchSettings() {
    try {
      const res = await adminFetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles() {
    try {
      const res = await adminFetch('/api/admin/roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setRolesLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: keyof AdminSettings['settings'], value: string) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveNotifications() {
    setSavingNotif(true);
    try {
      // Persist to localStorage as preferences
      localStorage.setItem('admin_notification_prefs', JSON.stringify(notifPrefs));
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save notification preferences');
    } finally {
      setSavingNotif(false);
    }
  }

  function hasPermission(role: AdminRole, resource: string, action: string): boolean {
    return !!(role.permissions[resource] && role.permissions[resource].includes(action));
  }

  // Only show rows that have at least one permission across all roles
  const activeResources = RESOURCES.filter((resource) =>
    roles.some((role) => role.permissions[resource] && role.permissions[resource].length > 0)
  );

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your store configuration and preferences
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-3.5 w-3.5 mr-1.5" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <div className="flex justify-end mb-4">
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-4">Loading settings...</p>
            </div>
          ) : (
            <div className="grid gap-6 max-w-3xl">
              <Card>
                <CardHeader>
                  <CardTitle>Store Information</CardTitle>
                  <CardDescription>Basic information about your store</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="store_name">Store Name</Label>
                    <Input
                      id="store_name"
                      value={settings.store_name}
                      onChange={(e) => handleChange('store_name', e.target.value)}
                      placeholder="Enter store name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store_description">Store Description</Label>
                    <Textarea
                      id="store_description"
                      value={settings.store_description}
                      onChange={(e) => handleChange('store_description', e.target.value)}
                      placeholder="Enter store description"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>Email addresses for customer communications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Contact Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={settings.contact_email}
                      onChange={(e) => handleChange('contact_email', e.target.value)}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support_email">Support Email</Label>
                    <Input
                      id="support_email"
                      type="email"
                      value={settings.support_email}
                      onChange={(e) => handleChange('support_email', e.target.value)}
                      placeholder="support@example.com"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Regional Settings</CardTitle>
                  <CardDescription>Currency and timezone preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={settings.currency}
                      onValueChange={(value) => handleChange('currency', value)}
                    >
                      <SelectTrigger id="currency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={settings.timezone}
                      onValueChange={(value) => handleChange('timezone', value)}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((timezone) => (
                          <SelectItem key={timezone.value} value={timezone.value}>
                            {timezone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions Matrix</CardTitle>
              <CardDescription>
                Permission matrix showing which actions each role can perform. Super Admin has all permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-2 text-sm">Loading roles...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 pr-4 font-semibold text-foreground min-w-[140px]">
                          Resource / Action
                        </th>
                        {roles.map((role) => (
                          <th
                            key={role.id}
                            className="text-center py-3 px-3 font-semibold text-foreground capitalize min-w-[100px]"
                          >
                            {role.name.replace('_', ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeResources.map((resource) => {
                        const resourceActions = ACTIONS.filter((action) =>
                          roles.some((role) => hasPermission(role, resource, action))
                        );
                        if (resourceActions.length === 0) return null;
                        return resourceActions.map((action, actionIdx) => (
                          <tr
                            key={`${resource}-${action}`}
                            className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                              actionIdx === 0 ? 'border-t-2 border-t-border' : ''
                            }`}
                          >
                            <td className="py-2 pr-4 text-muted-foreground">
                              {actionIdx === 0 && (
                                <span className="font-medium text-foreground capitalize block">
                                  {resource}
                                </span>
                              )}
                              <span className="text-xs ml-2 capitalize">{action}</span>
                            </td>
                            {roles.map((role) => (
                              <td key={role.id} className="text-center py-2 px-3">
                                {hasPermission(role, resource, action) ? (
                                  <Check
                                    className={`h-4 w-4 mx-auto ${
                                      role.name === 'super_admin'
                                        ? 'text-success'
                                        : 'text-primary'
                                    }`}
                                  />
                                ) : (
                                  <span className="text-muted-foreground/30 text-xs">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event Notifications</CardTitle>
                <CardDescription>
                  Choose which events trigger notifications. Disabled events will not show toasts or bell alerts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'new_order', label: 'New Orders', description: 'Alert when a new order is placed' },
                  { key: 'agent_cycle', label: 'Agent Cycles', description: 'Alert when PodClaw completes a cycle' },
                  { key: 'sync_error', label: 'Sync Errors', description: 'Alert when Printful sync fails' },
                  { key: 'webhook_failed', label: 'Webhook Failures', description: 'Alert when webhook delivery fails' },
                  { key: 'margin_alert', label: 'Margin Alerts', description: 'Alert when product margin drops below threshold' },
                  { key: 'integrity_issue', label: 'Integrity Issues', description: 'Alert when a data integrity problem is detected' },
                ].map(({ key, label, description }) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={notifPrefs[key as keyof typeof notifPrefs] as boolean}
                      onCheckedChange={(checked) =>
                        setNotifPrefs((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Thresholds</CardTitle>
                <CardDescription>Configure numeric thresholds for notification triggers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="order_min_eur">Minimum order value for notification (EUR)</Label>
                  <Input
                    id="order_min_eur"
                    type="number"
                    min={0}
                    step={1}
                    value={notifPrefs.order_min_eur}
                    onChange={(e) =>
                      setNotifPrefs((prev) => ({ ...prev, order_min_eur: Number(e.target.value) }))
                    }
                    className="max-w-xs"
                    placeholder="0 = notify for all orders"
                  />
                  <p className="text-xs text-muted-foreground">
                    Orders below this value will not trigger a notification. Set to 0 to notify for all orders.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="margin_threshold">Margin alert threshold (%)</Label>
                  <Input
                    id="margin_threshold"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={notifPrefs.margin_threshold}
                    onChange={(e) =>
                      setNotifPrefs((prev) => ({ ...prev, margin_threshold: Number(e.target.value) }))
                    }
                    className="max-w-xs"
                    placeholder="35"
                  />
                  <p className="text-xs text-muted-foreground">
                    Products with margin below this percentage will trigger a margin alert.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveNotifications} disabled={savingNotif}>
                {savingNotif ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
