'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LOCALES } from './types';

interface I18nFieldProps {
  label: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  multiline?: boolean;
  placeholder?: string;
}

const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
};

export function I18nField({ label, value, onChange, multiline, placeholder }: I18nFieldProps) {
  const handleChange = (locale: string, text: string) => {
    onChange({ ...value, [locale]: text });
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Tabs defaultValue="en" className="w-full">
        <TabsList className="h-8">
          {LOCALES.map((locale) => (
            <TabsTrigger key={locale} value={locale} className="text-xs px-3 h-7">
              {locale.toUpperCase()}
            </TabsTrigger>
          ))}
        </TabsList>
        {LOCALES.map((locale) => (
          <TabsContent key={locale} value={locale} className="mt-2">
            {multiline ? (
              <Textarea
                value={value[locale] || ''}
                onChange={(e) => handleChange(locale, e.target.value)}
                placeholder={placeholder ? `${placeholder} (${LOCALE_LABELS[locale]})` : ''}
                rows={3}
              />
            ) : (
              <Input
                value={value[locale] || ''}
                onChange={(e) => handleChange(locale, e.target.value)}
                placeholder={placeholder ? `${placeholder} (${LOCALE_LABELS[locale]})` : ''}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
