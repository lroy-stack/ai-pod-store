'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SafeMarkdown } from '@/components/ui/safe-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Eye, History } from 'lucide-react';
import { adminFetch } from '@/lib/admin-api';
import { toast } from 'sonner';

interface LegalPage {
  id: string;
  slug: string;
  title_en: string;
  title_es: string;
  title_de: string;
  content_en: string;
  content_es: string;
  content_de: string;
  is_active: boolean;
  updated_at: string;
}

interface Version {
  id: string;
  version_number: number;
  title_en: string;
  title_es: string;
  title_de: string;
  changed_by: string;
  created_at: string;
}

export default function LegalPageEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [page, setPage] = useState<LegalPage | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // Editable fields
  const [titleEn, setTitleEn] = useState('');
  const [titleEs, setTitleEs] = useState('');
  const [titleDe, setTitleDe] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [contentEs, setContentEs] = useState('');
  const [contentDe, setContentDe] = useState('');

  useEffect(() => {
    async function loadPage() {
      try {
        const res = await adminFetch(`/api/admin/legal-pages/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setPage(data);
          setTitleEn(data.title_en);
          setTitleEs(data.title_es);
          setTitleDe(data.title_de);
          setContentEn(data.content_en);
          setContentEs(data.content_es);
          setContentDe(data.content_de);
        }
      } catch (error) {
        console.error('Error loading legal page:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [slug]);

  async function loadVersions() {
    try {
      const res = await adminFetch(`/api/admin/legal-pages/${slug}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
        setShowVersions(true);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/legal-pages/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_en: titleEn,
          title_es: titleEs,
          title_de: titleDe,
          content_en: contentEn,
          content_es: contentEs,
          content_de: contentDe,
          changed_by: 'admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Saved successfully! Version ${data.version} created.`);
        setPage(data.page);
      } else {
        const error = await res.json();
        toast.error(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving page:', error);
      toast.error('Failed to save page');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Page Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The legal page &quot;{slug}&quot; does not exist.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/legal">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Legal Pages
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/legal">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Edit Legal Page: {slug}</h1>
          <p className="text-muted-foreground mt-2">
            Last updated: {new Date(page.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>
          <Button
            variant="outline"
            onClick={loadVersions}
          >
            <History className="h-4 w-4 mr-2" />
            Version History
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Version History */}
      {showVersions && versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Version History</CardTitle>
            <CardDescription>
              {versions.length} versions found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">Version {v.version_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()} by {v.changed_by}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{v.title_en}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editor Tabs */}
      <Tabs defaultValue="en" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="en">English</TabsTrigger>
          <TabsTrigger value="es">Spanish</TabsTrigger>
          <TabsTrigger value="de">German</TabsTrigger>
        </TabsList>

        {/* English Tab */}
        <TabsContent value="en" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>English Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title-en">Title</Label>
                <Input
                  id="title-en"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="Page title in English"
                />
              </div>
              <div>
                <Label htmlFor="content-en">Content (Markdown)</Label>
                <Textarea
                  id="content-en"
                  value={contentEn}
                  onChange={(e) => setContentEn(e.target.value)}
                  placeholder="Markdown content..."
                  className="min-h-[400px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use placeholders: {'{{company_name}}, {{company_email}}, {{dpo_name}}, etc.'}
                </p>
              </div>
              {showPreview && (
                <div>
                  <Label>Preview</Label>
                  <div className="p-4 border rounded-lg prose prose-sm max-w-none">
                    <SafeMarkdown>{contentEn}</SafeMarkdown>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spanish Tab */}
        <TabsContent value="es" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Spanish Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title-es">Title</Label>
                <Input
                  id="title-es"
                  value={titleEs}
                  onChange={(e) => setTitleEs(e.target.value)}
                  placeholder="Page title in Spanish"
                />
              </div>
              <div>
                <Label htmlFor="content-es">Content (Markdown)</Label>
                <Textarea
                  id="content-es"
                  value={contentEs}
                  onChange={(e) => setContentEs(e.target.value)}
                  placeholder="Markdown content..."
                  className="min-h-[400px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use placeholders: {'{{company_name}}, {{company_email}}, {{dpo_name}}, etc.'}
                </p>
              </div>
              {showPreview && (
                <div>
                  <Label>Preview</Label>
                  <div className="p-4 border rounded-lg prose prose-sm max-w-none">
                    <SafeMarkdown>{contentEs}</SafeMarkdown>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* German Tab */}
        <TabsContent value="de" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>German Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title-de">Title</Label>
                <Input
                  id="title-de"
                  value={titleDe}
                  onChange={(e) => setTitleDe(e.target.value)}
                  placeholder="Page title in German"
                />
              </div>
              <div>
                <Label htmlFor="content-de">Content (Markdown)</Label>
                <Textarea
                  id="content-de"
                  value={contentDe}
                  onChange={(e) => setContentDe(e.target.value)}
                  placeholder="Markdown content..."
                  className="min-h-[400px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use placeholders: {'{{company_name}}, {{company_email}}, {{dpo_name}}, etc.'}
                </p>
              </div>
              {showPreview && (
                <div>
                  <Label>Preview</Label>
                  <div className="p-4 border rounded-lg prose prose-sm max-w-none">
                    <SafeMarkdown>{contentDe}</SafeMarkdown>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
