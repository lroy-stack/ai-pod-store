'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Check, Sparkles } from 'lucide-react';

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

export default function BrandingPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchThemes();
  }, []);

  async function fetchThemes() {
    try {
      const res = await fetch('/api/admin/themes');
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

  async function activateTheme(id: string) {
    setActivatingId(id);
    try {
      const res = await fetch(`/api/admin/themes/${id}/activate`, {
        method: 'POST',
      });

      if (res.ok) {
        // Refresh themes to update active status
        await fetchThemes();
      }
    } catch (error) {
      console.error('Failed to activate theme:', error);
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
    <DashboardLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Branding &amp; Themes</h1>
            <p className="text-muted-foreground mt-2">
              Manage your store&apos;s visual identity and theme presets
            </p>
          </div>
          <Button>
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
                    {theme.is_custom && (
                      <Button variant="outline" size="sm" className="flex-1">
                        Edit
                      </Button>
                    )}
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
      </div>
    </DashboardLayout>
  );
}
