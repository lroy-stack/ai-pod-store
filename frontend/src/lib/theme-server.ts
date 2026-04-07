/**
 * Theme Server — SSR theme injection
 *
 * Fetches the active theme on the server and generates inline CSS
 * for injection into <head>, eliminating FOUC (Flash of Unstyled Content).
 */
import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface ThemeVariables {
  [key: string]: string;
}

interface ThemeFonts {
  heading: string;
  body: string;
  mono: string;
}

interface ThemeRow {
  css_variables: ThemeVariables;
  css_variables_dark: ThemeVariables;
  fonts: ThemeFonts;
  border_radius: string;
  shadow_preset: string;
}

const SHADOW_PRESETS: Record<string, string> = {
  none: 'none',
  small: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  subtle: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  medium: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  large: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  extra_large: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

const RADIUS_PRESETS: Record<string, string> = {
  none: '0',
  small: '0.375rem',
  medium: '0.75rem',
  large: '1rem',
  full: '2rem',
};

/**
 * Fetches the active theme from the database with 5-minute cache.
 * Fallback chain: active → default → ocean-blue → null
 */
export const getActiveTheme = unstable_cache(
  async (): Promise<ThemeRow | null> => {
    try {
      // Try active theme
      const { data: active } = await supabaseAdmin
        .from('store_themes')
        .select('css_variables, css_variables_dark, fonts, border_radius, shadow_preset')
        .eq('is_active', true)
        .single();

      if (active) return active;

      // Try default theme
      const { data: defaultTheme } = await supabaseAdmin
        .from('store_themes')
        .select('css_variables, css_variables_dark, fonts, border_radius, shadow_preset')
        .eq('is_default', true)
        .single();

      if (defaultTheme) return defaultTheme;

      // Fallback to ocean-blue
      const { data: fallback } = await supabaseAdmin
        .from('store_themes')
        .select('css_variables, css_variables_dark, fonts, border_radius, shadow_preset')
        .eq('slug', 'ocean-blue')
        .single();

      return fallback || null;
    } catch (error) {
      console.error('Error fetching theme for SSR:', error);
      return null;
    }
  },
  ['store-theme'],
  { revalidate: 300, tags: ['store-theme'] }
);

/**
 * Validate a CSS variable value to prevent stored XSS via dangerouslySetInnerHTML.
 * Allows safe CSS values: colors, numbers, units, HSL/RGB functions, var() references.
 * Rejects values containing HTML/script injection patterns.
 */
function sanitizeCSSValue(value: string): string | null {
  if (typeof value !== 'string') return null;
  // Reject values containing dangerous characters or patterns
  if (/[<>"';{}]/.test(value)) return null;
  if (/\b(script|javascript|expression|url)\b/i.test(value)) return null;
  // Allow: letters, digits, #, %, (, ), ., space, -, /, comma, degrees, hsl, rgb, var
  if (!/^[a-zA-Z0-9#%(),.\s\-/]+$/.test(value)) return null;
  return value;
}

/**
 * Converts a theme to inline CSS string for SSR injection.
 * Outputs unprefixed variables that propagate through @theme inline in globals.css.
 * CSS values are sanitized to prevent XSS via dangerouslySetInnerHTML.
 */
export function themeToInlineCSS(theme: ThemeRow): string {
  const lightVars = Object.entries(theme.css_variables)
    .map(([key, value]) => {
      const safe = sanitizeCSSValue(String(value));
      return safe ? `  --${key.replace(/_/g, '-')}: ${safe};` : null;
    })
    .filter(Boolean)
    .join('\n');

  const darkVars = Object.entries(theme.css_variables_dark)
    .map(([key, value]) => {
      const safe = sanitizeCSSValue(String(value));
      return safe ? `  --${key.replace(/_/g, '-')}: ${safe};` : null;
    })
    .filter(Boolean)
    .join('\n');

  const shadowValue = SHADOW_PRESETS[theme.shadow_preset] || SHADOW_PRESETS.medium;
  const radiusValue = RADIUS_PRESETS[theme.border_radius] || theme.border_radius;

  return `
:root {
${lightVars}
  --radius: ${radiusValue};
  --shadow: ${shadowValue};
  --font-sans: "${sanitizeCSSValue(theme.fonts.body) || 'system-ui'}", system-ui, sans-serif;
  --font-heading: "${sanitizeCSSValue(theme.fonts.heading) || 'system-ui'}", system-ui, sans-serif;
  --font-mono: "${sanitizeCSSValue(theme.fonts.mono) || 'ui-monospace'}", ui-monospace, monospace;
}
.dark {
${darkVars}
  --radius: ${radiusValue};
  --shadow: ${shadowValue};
}`.trim();
}

/**
 * Returns the Google Fonts URL for the theme's custom fonts, or null if none needed.
 */
export function themeGoogleFontsURL(theme: ThemeRow): string | null {
  const fontFamilies = new Set<string>();
  const { heading, body, mono } = theme.fonts;

  if (heading && heading !== 'system-ui' && heading !== 'ui-monospace') fontFamilies.add(heading);
  if (body && body !== 'system-ui' && body !== 'ui-monospace') fontFamilies.add(body);
  if (mono && mono !== 'system-ui' && mono !== 'ui-monospace') fontFamilies.add(mono);

  if (fontFamilies.size === 0) return null;

  return `https://fonts.googleapis.com/css2?${Array.from(fontFamilies)
    .map(font => `family=${encodeURIComponent(font)}:wght@400;500;600;700`)
    .join('&')}&display=swap`;
}
