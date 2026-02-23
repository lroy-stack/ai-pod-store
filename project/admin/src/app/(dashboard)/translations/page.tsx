'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Languages, Save, Sparkles } from 'lucide-react';
import { adminFetch } from '@/lib/admin-api';

interface Translation {
  namespace: string;
  key: string;
  en: string;
  es: string;
  de: string;
}

export default function TranslationsPage() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState<{
    key: string;
    locale: string;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    fetchTranslations();
  }, []);

  async function fetchTranslations() {
    try {
      const res = await adminFetch('/api/translations');
      if (res.ok) {
        const data = await res.json();
        setTranslations(data);
      }
    } catch (error) {
      console.error('Failed to fetch translations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key: string, locale: string, value: string) {
    setSaving(true);
    try {
      const res = await adminFetch('/api/translations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, locale, value }),
      });

      if (res.ok) {
        // Update local state
        setTranslations((prev) =>
          prev.map((t) =>
            t.key === key ? { ...t, [locale]: value } : t
          )
        );
        setEditingCell(null);
      }
    } catch (error) {
      console.error('Failed to save translation:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoTranslate(key: string, sourceLocale: string) {
    setTranslating(true);
    try {
      const translation = translations.find((t) => t.key === key);
      if (!translation) return;

      const sourceText = translation[sourceLocale as keyof Translation] as string;

      // Translate to the other two locales
      const targetLocales = ['en', 'es', 'de'].filter((l) => l !== sourceLocale);

      for (const targetLocale of targetLocales) {
        const res = await adminFetch('/api/translations/auto-translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            sourceLocale,
            sourceText,
            targetLocale,
          }),
        });

        if (res.ok) {
          const { translatedText } = await res.json();

          // Save the translation
          await adminFetch('/api/translations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, locale: targetLocale, value: translatedText }),
          });

          // Update local state
          setTranslations((prev) =>
            prev.map((t) =>
              t.key === key ? { ...t, [targetLocale]: translatedText } : t
            )
          );
        }
      }
    } catch (error) {
      console.error('Auto-translate failed:', error);
    } finally {
      setTranslating(false);
    }
  }

  const filteredTranslations = translations.filter(
    (t) =>
      t.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.es.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.de.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <h1 className="text-3xl font-bold mb-6">Translation Management</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Translation Management</h1>
          <p className="text-muted-foreground">
            Manage translations for EN, ES, and DE locales
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                Translations ({filteredTranslations.length})
              </CardTitle>
              <Input
                placeholder="Search translations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Key</TableHead>
                    <TableHead className="w-[250px]">English (EN)</TableHead>
                    <TableHead className="w-[250px]">Spanish (ES)</TableHead>
                    <TableHead className="w-[250px]">German (DE)</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTranslations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No translations found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTranslations.map((translation) => (
                      <TableRow key={translation.key}>
                        <TableCell className="font-mono text-xs">
                          {translation.key}
                        </TableCell>
                        {(['en', 'es', 'de'] as const).map((locale) => (
                          <TableCell key={locale}>
                            {editingCell?.key === translation.key &&
                            editingCell?.locale === locale ? (
                              <div className="flex gap-2">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSave(translation.key, locale, editValue);
                                    }
                                    if (e.key === 'Escape') {
                                      setEditingCell(null);
                                    }
                                  }}
                                  autoFocus
                                  className="text-sm"
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleSave(translation.key, locale, editValue)
                                  }
                                  disabled={saving}
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div
                                className="cursor-pointer hover:bg-muted p-2 rounded text-sm"
                                onClick={() => {
                                  setEditingCell({ key: translation.key, locale });
                                  setEditValue(translation[locale]);
                                }}
                              >
                                {translation[locale] || (
                                  <span className="text-muted-foreground italic">
                                    (empty)
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAutoTranslate(translation.key, 'en')}
                            disabled={translating || !translation.en}
                            title="Auto-translate from English to ES and DE"
                          >
                            <Sparkles className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
