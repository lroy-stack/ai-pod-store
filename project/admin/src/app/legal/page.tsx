'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Pencil, Settings, Shield } from 'lucide-react';
import { adminFetch } from '@/lib/admin-api';

interface LegalPage {
  id: string;
  slug: string;
  title_en: string;
  title_es: string;
  title_de: string;
  is_active: boolean;
  updated_at: string;
}

export default function LegalPagesListPage() {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPages() {
      try {
        const res = await adminFetch('/api/admin/legal-pages');
        if (res.ok) {
          const data = await res.json();
          setPages(data);
        }
      } catch (error) {
        console.error('Error loading legal pages:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPages();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading legal pages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Legal Pages</h1>
          <p className="text-muted-foreground mt-2">
            Manage legal content in multiple languages
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/legal/consents">
              <Shield className="h-4 w-4 mr-2" />
              Consents
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/legal/settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Legal Pages</CardTitle>
          <CardDescription>
            {pages.length} legal pages configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>English Title</TableHead>
                  <TableHead>Spanish Title</TableHead>
                  <TableHead>German Title</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {page.slug}
                      </div>
                    </TableCell>
                    <TableCell>{page.title_en}</TableCell>
                    <TableCell>{page.title_es}</TableCell>
                    <TableCell>{page.title_de}</TableCell>
                    <TableCell>
                      {new Date(page.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/legal/${page.slug}`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {pages.map((page) => (
              <Card key={page.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {page.slug}
                  </CardTitle>
                  <CardDescription>
                    Updated {new Date(page.updated_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">English</p>
                    <p className="text-sm text-muted-foreground">{page.title_en}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Spanish</p>
                    <p className="text-sm text-muted-foreground">{page.title_es}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">German</p>
                    <p className="text-sm text-muted-foreground">{page.title_de}</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/legal/${page.slug}`}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Page
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
