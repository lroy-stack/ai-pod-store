'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Check, Sparkles, Save } from 'lucide-react';
import { ThemeEditorDialog } from '@/components/ThemeEditorDialog';
import { toast } from 'sonner';

interface Theme {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: 'light' | 'dark' | 'high_contrast' | 'custom';
  css_variables: Record<string, string>;
  css_variables_dark: Record<string, string>;
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  border_radius: string;
  shadow_preset: string;
  is_active: boolean;
  is_default: boolean;
  is_custom: boolean;
  created_at: string;
}

interface BrandConfig {
  id: string;
  brand_name: string;
  brand_tagline: string;
  copyright_text: string;
  support_email: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  brand_color_primary: string;
  brand_color_secondary: string;
  brand_font: string;
}

export default function BrandingPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [brandConfig, setBrandConfig] = useState<BrandConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchThemes();
    fetchBrandConfig();
  }, []);

  async function fetchThemes() {
    try {
      const res = await adminFetch('/api/admin/themes');
      if (res.ok) {
        const data = await res.json();
        setThemes(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch themes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBrandConfig() {
    try {
      const res = await adminFetch('/api/admin/brand-config');
      if (res.ok) {
        const data = await res.json();
        setBrandConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to fetch brand config:', error);
      toast.error('Failed to load brand configuration');
    }
  }

  async function saveBrandConfig() {
    if (!brandConfig) return;

    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/brand-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandConfig),
      });

      if (res.ok) {
        toast.success('Brand identity saved successfully');
        await fetchBrandConfig();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save brand identity');
      }
    } catch (error) {
      console.error('Failed to save brand config:', error);
      toast.error('Failed to save brand identity');
    } finally {
      setSaving(false);
    }
  }

  async function activateTheme(id: string) {
    setActivatingId(id);
    try {
      const res = await adminFetch(`/api/admin/themes/${id}/activate`, {
        method: 'POST',
      });

      if (res.ok) {
        await fetchThemes();
        toast.success('Theme activated successfully');
      } else {
        toast.error('Failed to activate theme');
      }
    } catch (error) {
      console.error('Failed to activate theme:', error);
      toast.error('Failed to activate theme');
    } finally {
      setActivatingId(null);
    }
  }

  function getCategoryColor(category: string) {
    switch (category) {
      case 'light':
        return 'bg-primary/10 text-primary';
      case 'dark':
        return 'bg-secondary/10 text-secondary-foreground';
      case 'high_contrast':
        return 'bg-accent/10 text-accent-foreground';
      case 'custom':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Branding &amp; Themes</h1>
        <p className="text-muted-foreground mt-2">
          Manage your store&apos;s visual identity and theme presets
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="identity">Store Identity</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
        </TabsList>

        {/* Identity Tab */}
        <TabsContent value="identity" className="mt-6">
          {!brandConfig ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading brand configuration...</p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Store Identity</CardTitle>
                <CardDescription>
                  Configure your brand name, tagline, and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Brand Name */}
                <div className="space-y-2">
                  <Label htmlFor="brand_name">Brand Name</Label>
                  <Input
                    id="brand_name"
                    value={brandConfig.brand_name || ''}
                    onChange={(e) =>
                      setBrandConfig({ ...brandConfig, brand_name: e.target.value })
                    }
                    placeholder="Your Brand Name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your brand name displayed across the platform
                  </p>
                </div>

                {/* Tagline */}
                <div className="space-y-2">
                  <Label htmlFor="brand_tagline">Tagline</Label>
                  <Input
                    id="brand_tagline"
                    value={brandConfig.brand_tagline || ''}
                    onChange={(e) =>
                      setBrandConfig({ ...brandConfig, brand_tagline: e.target.value })
                    }
                    placeholder="Your brand tagline or slogan"
                  />
                  <p className="text-xs text-muted-foreground">
                    A short phrase that describes your brand
                  </p>
                </div>

                {/* Support Email */}
                <div className="space-y-2">
                  <Label htmlFor="support_email">Support Email</Label>
                  <Input
                    id="support_email"
                    type="email"
                    value={brandConfig.support_email || ''}
                    onChange={(e) =>
                      setBrandConfig({ ...brandConfig, support_email: e.target.value })
                    }
                    placeholder="support@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email address for customer support inquiries
                  </p>
                </div>

                {/* Copyright Text */}
                <div className="space-y-2">
                  <Label htmlFor="copyright_text">Copyright Notice</Label>
                  <Input
                    id="copyright_text"
                    value={brandConfig.copyright_text || ''}
                    onChange={(e) =>
                      setBrandConfig({ ...brandConfig, copyright_text: e.target.value })
                    }
                    placeholder="© 2026 Your Brand. All rights reserved."
                  />
                  <p className="text-xs text-muted-foreground">
                    Copyright notice displayed in the footer
                  </p>
                </div>

                {/* Logo URLs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logo_light_url">Light Mode Logo URL</Label>
                    <Input
                      id="logo_light_url"
                      value={brandConfig.logo_light_url || ''}
                      onChange={(e) =>
                        setBrandConfig({ ...brandConfig, logo_light_url: e.target.value })
                      }
                      placeholder="https://..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Logo displayed in light mode
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logo_dark_url">Dark Mode Logo URL</Label>
                    <Input
                      id="logo_dark_url"
                      value={brandConfig.logo_dark_url || ''}
                      onChange={(e) =>
                        setBrandConfig({ ...brandConfig, logo_dark_url: e.target.value })
                      }
                      placeholder="https://..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Logo displayed in dark mode
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                  <Button onClick={saveBrandConfig} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Themes Tab */}
        <TabsContent value="themes" className="mt-6">
          <div className="flex justify-end mb-6">
            <Button disabled title="Coming soon">
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Theme
            </Button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading themes...</p>
            </div>
          )}

          {/* Theme Cards Grid */}
          {!loading && themes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {themes.map((theme) => (
                <Card key={theme.id} className={theme.is_active ? 'ring-2 ring-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">{theme.name}</CardTitle>
                          {theme.is_active && (
                            <Badge variant="default" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                          {theme.is_default && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getCategoryColor(theme.category)}>
                            {theme.category.replace('_', ' ')}
                          </Badge>
                          {theme.is_custom && (
                            <Badge variant="outline" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Custom
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {theme.description && (
                      <CardDescription className="mt-2">
                        {theme.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {/* Color Preview */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Colors</p>
                      <div className="flex gap-2">
                        {theme.css_variables.primary && (
                          <div
                            className="w-8 h-8 rounded border border-border"
                            style={{ backgroundColor: theme.css_variables.primary }}
                            title="Primary"
                          />
                        )}
                        {theme.css_variables.secondary && (
                          <div
                            className="w-8 h-8 rounded border border-border"
                            style={{ backgroundColor: theme.css_variables.secondary }}
                            title="Secondary"
                          />
                        )}
                        {theme.css_variables.accent && (
                          <div
                            className="w-8 h-8 rounded border border-border"
                            style={{ backgroundColor: theme.css_variables.accent }}
                            title="Accent"
                          />
                        )}
                        {theme.css_variables.background && (
                          <div
                            className="w-8 h-8 rounded border border-border"
                            style={{ backgroundColor: theme.css_variables.background }}
                            title="Background"
                          />
                        )}
                        {theme.css_variables.foreground && (
                          <div
                            className="w-8 h-8 rounded border border-border"
                            style={{ backgroundColor: theme.css_variables.foreground }}
                            title="Foreground"
                          />
                        )}
                      </div>
                    </div>

                    {/* Font Info */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Fonts</p>
                      <p className="text-sm">{theme.fonts.heading}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!theme.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => activateTheme(theme.id)}
                          disabled={activatingId === theme.id}
                        >
                          {activatingId === theme.id ? 'Activating...' : 'Activate'}
                        </Button>
                      )}
                      <ThemeEditorDialog
                        theme={theme}
                        onSave={async (updatedTheme) => {
                          console.log('Saving theme:', updatedTheme);
                          await fetchThemes();
                        }}
                        trigger={
                          <Button variant="outline" size="sm" className="flex-1">
                            Customize
                          </Button>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && themes.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No themes found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
