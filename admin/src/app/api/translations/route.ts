import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { withAuth } from '@/lib/auth-middleware';

// Docker: messages copied into /app/frontend-messages/ at build time
// Dev: messages live at ../frontend/messages/ relative to admin root
const dockerPath = path.join(process.cwd(), 'frontend-messages');
const devPath = path.join(process.cwd(), '../frontend/messages');
const MESSAGES_DIR = existsSync(dockerPath) ? dockerPath : devPath;

export const GET = withAuth(async (req: NextRequest, session: unknown) => {
  try {
    // Read all three locale files
    const [enData, esData, deData] = await Promise.all([
      fs.readFile(path.join(MESSAGES_DIR, 'en.json'), 'utf-8'),
      fs.readFile(path.join(MESSAGES_DIR, 'es.json'), 'utf-8'),
      fs.readFile(path.join(MESSAGES_DIR, 'de.json'), 'utf-8'),
    ]);

    const en = JSON.parse(enData);
    const es = JSON.parse(esData);
    const de = JSON.parse(deData);

    // Flatten the nested JSON structure into a flat list
    const translations: Array<{
      namespace: string;
      key: string;
      en: string;
      es: string;
      de: string;
    }> = [];

    function getNestedValue(obj: any, path: string): any {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    function flattenObject(obj: any, namespace: string = '', prefix: string = '') {
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recurse into nested objects
          flattenObject(value, namespace || key, fullKey);
        } else if (typeof value === 'string' || typeof value === 'number') {
          // Only add leaf nodes (actual translations)
          translations.push({
            namespace: namespace || key.split('.')[0],
            key: fullKey,
            en: String(getNestedValue(en, fullKey) || ''),
            es: String(getNestedValue(es, fullKey) || ''),
            de: String(getNestedValue(de, fullKey) || ''),
          });
        }
      }
    }

    flattenObject(en);

    return NextResponse.json(translations);
  } catch (error) {
    console.error('Error fetching translations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch translations' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest, session: unknown) => {
  try {
    const { key, locale, value } = await request.json();

    if (!key || !locale || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: key, locale, value' },
        { status: 400 }
      );
    }

    if (!['en', 'es', 'de'].includes(locale)) {
      return NextResponse.json(
        { error: 'Invalid locale. Must be en, es, or de' },
        { status: 400 }
      );
    }

    // Read the locale file
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    const fileData = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileData);

    // Update the nested value
    const keys = key.split('.');
    let current = data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating translation:', error);
    return NextResponse.json(
      { error: 'Failed to update translation' },
      { status: 500 }
    );
  }
});
