'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-api';

interface LegalSettings {
  company_name: string;
  company_address: string;
  tax_id: string;
  company_email: string;
  dpo_name: string;
  dpo_email: string;
  trade_register_court?: string;
  trade_register_number?: string;
  privacy_policy_url?: string;
  terms_of_service_url?: string;
  cookie_policy_url?: string;
  retention_conversations?: number;
  retention_audit_logs?: number;
  retention_marketing_events?: number;
}

export default function LegalSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [settings, setSettings] = useState<LegalSettings>({
    company_name: '',
    company_address: '',
    tax_id: '',
    company_email: '',
    dpo_name: '',
    dpo_email: '',
    trade_register_court: '',
    trade_register_number: '',
    privacy_policy_url: '/privacy',
    terms_of_service_url: '/terms',
    cookie_policy_url: '/privacy#cookies',
    retention_conversations: 365,
    retention_audit_logs: 730,
    retention_marketing_events: 180,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await adminFetch('/api/admin/legal-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setSettings(data.settings);
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        setMessage({ type: 'error', text: 'Failed to load settings' });
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!settings.company_name?.trim()) {
      newErrors.company_name = 'Company name is required';
    }
    if (!settings.company_email?.trim()) {
      newErrors.company_email = 'Company email is required';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (settings.company_email && !emailRegex.test(settings.company_email)) {
      newErrors.company_email = 'Invalid email format';
    }
    if (settings.dpo_email && !emailRegex.test(settings.dpo_email)) {
      newErrors.dpo_email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setMessage({ type: 'error', text: 'Please fix validation errors' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await adminFetch('/api/admin/legal-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Legal settings saved successfully!' });
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Network error - please try again' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof LegalSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="md:hidden">
          <Link href="/legal">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Legal Entity Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure company information used in legal pages
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="hidden md:flex">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Basic company details displayed on legal pages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company_name"
              value={settings.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="e.g., PodClaw Store"
              className={errors.company_name ? 'border-destructive' : ''}
            />
            {errors.company_name && (
              <p className="text-sm text-destructive">{errors.company_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_address">Company Address</Label>
            <Textarea
              id="company_address"
              value={settings.company_address}
              onChange={(e) => handleChange('company_address', e.target.value)}
              placeholder="Full legal address"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_email">
              Company Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company_email"
              type="email"
              value={settings.company_email}
              onChange={(e) => handleChange('company_email', e.target.value)}
              placeholder="legal@company.com"
              className={errors.company_email ? 'border-destructive' : ''}
            />
            {errors.company_email && (
              <p className="text-sm text-destructive">{errors.company_email}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tax Information */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Information</CardTitle>
          <CardDescription>
            Tax identification and trade register details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tax_id">Tax ID / VAT Number</Label>
            <Input
              id="tax_id"
              value={settings.tax_id}
              onChange={(e) => handleChange('tax_id', e.target.value)}
              placeholder="e.g., DE123456789"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trade_register_court">Trade Register Court</Label>
              <Input
                id="trade_register_court"
                value={settings.trade_register_court || ''}
                onChange={(e) => handleChange('trade_register_court', e.target.value)}
                placeholder="e.g., Amtsgericht Berlin"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade_register_number">Trade Register Number</Label>
              <Input
                id="trade_register_number"
                value={settings.trade_register_number || ''}
                onChange={(e) => handleChange('trade_register_number', e.target.value)}
                placeholder="e.g., HRB 123456"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Protection Officer */}
      <Card>
        <CardHeader>
          <CardTitle>Data Protection Officer (DPO)</CardTitle>
          <CardDescription>
            GDPR-required contact information for data protection inquiries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dpo_name">DPO Name</Label>
            <Input
              id="dpo_name"
              value={settings.dpo_name}
              onChange={(e) => handleChange('dpo_name', e.target.value)}
              placeholder="Data Protection Officer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dpo_email">DPO Email</Label>
            <Input
              id="dpo_email"
              type="email"
              value={settings.dpo_email}
              onChange={(e) => handleChange('dpo_email', e.target.value)}
              placeholder="dpo@company.com"
              className={errors.dpo_email ? 'border-destructive' : ''}
            />
            {errors.dpo_email && (
              <p className="text-sm text-destructive">{errors.dpo_email}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legal Page URLs */}
      <Card>
        <CardHeader>
          <CardTitle>Legal Page URLs</CardTitle>
          <CardDescription>
            Internal page paths for legal documents (optional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="privacy_policy_url">Privacy Policy URL</Label>
            <Input
              id="privacy_policy_url"
              value={settings.privacy_policy_url || ''}
              onChange={(e) => handleChange('privacy_policy_url', e.target.value)}
              placeholder="/privacy"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms_of_service_url">Terms of Service URL</Label>
            <Input
              id="terms_of_service_url"
              value={settings.terms_of_service_url || ''}
              onChange={(e) => handleChange('terms_of_service_url', e.target.value)}
              placeholder="/terms"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cookie_policy_url">Cookie Policy URL</Label>
            <Input
              id="cookie_policy_url"
              value={settings.cookie_policy_url || ''}
              onChange={(e) => handleChange('cookie_policy_url', e.target.value)}
              placeholder="/privacy#cookies"
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle>Data Retention</CardTitle>
          <CardDescription>
            Configure how long data is kept before automatic deletion (in days)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="retention_conversations">
              Conversations Retention (days)
            </Label>
            <Input
              id="retention_conversations"
              type="number"
              min="1"
              value={settings.retention_conversations || 365}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  retention_conversations: parseInt(e.target.value) || 365,
                }))
              }
              placeholder="365"
            />
            <p className="text-xs text-muted-foreground">
              User conversations older than this will be deleted. Default: 365 days (1 year)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="retention_audit_logs">
              Audit Logs Retention (days)
            </Label>
            <Input
              id="retention_audit_logs"
              type="number"
              min="1"
              value={settings.retention_audit_logs || 730}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  retention_audit_logs: parseInt(e.target.value) || 730,
                }))
              }
              placeholder="730"
            />
            <p className="text-xs text-muted-foreground">
              Admin audit logs older than this will be deleted. Default: 730 days (2 years)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="retention_marketing_events">
              Marketing Events Retention (days)
            </Label>
            <Input
              id="retention_marketing_events"
              type="number"
              min="1"
              value={settings.retention_marketing_events || 180}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  retention_marketing_events: parseInt(e.target.value) || 180,
                }))
              }
              placeholder="180"
            />
            <p className="text-xs text-muted-foreground">
              A/B test events older than this will be deleted. Default: 180 days (6 months)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Mobile save button */}
      <div className="md:hidden">
        <Button onClick={handleSave} disabled={saving} className="w-full h-12">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
