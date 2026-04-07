/**
 * Theme Loader (Client-side)
 *
 * Fetches the active theme from the API and injects CSS variables into the document.
 * Variables are injected WITHOUT the --color- prefix (e.g., --background, --primary)
 * so they propagate through the @theme inline bridge in globals.css.
 */

export interface ThemeVariables {
  [key: string]: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
  mono: string;
}

export interface Theme {
  id: string;
  name: string;
  slug: string;
  category: string;
  css_variables: ThemeVariables;
  css_variables_dark: ThemeVariables;
  fonts: ThemeFonts;
  border_radius: string;
  shadow_preset: string;
}

export const SHADOW_PRESETS: Record<string, string> = {
  none: 'none',
  small: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  subtle: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  medium: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  large: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  extra_large: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

export const RADIUS_PRESETS: Record<string, string> = {
  none: '0',
  small: '0.375rem',
  medium: '0.75rem',
  large: '1rem',
  full: '2rem',
};

/**
 * Sanitizes a CSS value — strips characters that could break out of CSS context.
 * Theme values come from our own admin-controlled DB, but defense-in-depth applies.
 */
function sanitizeValue(value: string): string {
  return value.replace(/[<>{};]/g, '');
}

/**
 * Builds CSS property declarations from a variable map.
 */
function buildProperties(variables: ThemeVariables): string {
  return Object.entries(variables)
    .map(([key, value]) => `--${key.replace(/_/g, '-')}: ${sanitizeValue(value)}`)
    .join('; ');
}

/**
 * Injects theme CSS variables via a <style> tag.
 *
 * IMPORTANT: Both :root and .dark MUST be in the same <style> tag (not inline styles).
 * Using style.setProperty() on :root would create inline styles (specificity 1,0,0,0)
 * that .dark {} (specificity 0,1,0) can NEVER override — breaking dark mode completely.
 */
function injectThemeCSS(theme: Theme): void {
  // Remove existing dynamic theme style tag only.
  // NEVER remove 'server-theme-style' — it's React-owned (rendered in layout.tsx).
  // Removing it imperatively causes "removeChild" crash on locale navigation.
  // The dynamic tag appended later overrides the server one via CSS cascade.
  document.getElementById('dynamic-theme-style')?.remove();

  // Also clear any stale inline styles from the previous setProperty approach
  const root = document.documentElement;
  Object.keys(theme.css_variables).forEach((key) => {
    root.style.removeProperty(`--${key.replace(/_/g, '-')}`);
  });
  root.style.removeProperty('--radius');
  root.style.removeProperty('--shadow');
  root.style.removeProperty('--font-sans');
  root.style.removeProperty('--font-heading');
  root.style.removeProperty('--font-mono');

  const shadowValue = SHADOW_PRESETS[theme.shadow_preset] || SHADOW_PRESETS.medium;
  const radiusValue = RADIUS_PRESETS[theme.border_radius] || theme.border_radius;

  const lightProps = buildProperties(theme.css_variables);
  const darkProps = buildProperties(theme.css_variables_dark);

  const fontSans = `"${sanitizeValue(theme.fonts.body)}", system-ui, sans-serif`;
  const fontHeading = `"${sanitizeValue(theme.fonts.heading)}", system-ui, sans-serif`;
  const fontMono = `"${sanitizeValue(theme.fonts.mono)}", ui-monospace, monospace`;

  const styleTag = document.createElement('style');
  styleTag.id = 'dynamic-theme-style';
  styleTag.textContent = [
    `:root { ${lightProps}; --radius: ${radiusValue}; --shadow: ${shadowValue}; --font-sans: ${fontSans}; --font-heading: ${fontHeading}; --font-mono: ${fontMono} }`,
    `.dark { ${darkProps}; --radius: ${radiusValue}; --shadow: ${shadowValue} }`
  ].join('\n');

  document.head.appendChild(styleTag);
}

/**
 * Loads Google Fonts dynamically based on theme fonts.
 * Only loads the <link> tag — font CSS variables are set by injectThemeCSS().
 */
function loadGoogleFonts(fonts: ThemeFonts): void {
  const existingLink = document.getElementById('dynamic-theme-fonts');
  if (existingLink) {
    existingLink.remove();
  }

  const fontFamilies = new Set<string>();
  if (fonts.heading && fonts.heading !== 'system-ui' && fonts.heading !== 'ui-monospace') {
    fontFamilies.add(fonts.heading);
  }
  if (fonts.body && fonts.body !== 'system-ui' && fonts.body !== 'ui-monospace') {
    fontFamilies.add(fonts.body);
  }
  if (fonts.mono && fonts.mono !== 'system-ui' && fonts.mono !== 'ui-monospace') {
    fontFamilies.add(fonts.mono);
  }

  if (fontFamilies.size === 0) {
    return;
  }

  const link = document.createElement('link');
  link.id = 'dynamic-theme-fonts';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${Array.from(fontFamilies)
    .map(font => `family=${encodeURIComponent(font)}:wght@400;500;600;700`)
    .join('&')}&display=swap`;

  document.head.appendChild(link);
}

/**
 * Loads the active theme from the API and applies it to the document.
 * Also loads per-tenant branding overrides and merges CSS variables on top.
 */
export async function loadActiveTheme(): Promise<Theme> {
  // Fetch base theme and tenant branding in parallel
  const [themeResponse, brandingResponse] = await Promise.allSettled([
    fetch('/api/storefront/theme', { method: 'GET' }),
    fetch('/api/storefront/branding', { method: 'GET' }),
  ])

  if (themeResponse.status === 'rejected' || !themeResponse.value.ok) {
    const err = themeResponse.status === 'rejected'
      ? themeResponse.reason
      : `HTTP ${(themeResponse as PromiseFulfilledResult<Response>).value.status}`
    throw new Error(`Failed to fetch theme: ${err}`)
  }

  const theme: Theme = await themeResponse.value.json()

  // Merge per-tenant branding CSS overrides onto base theme
  if (brandingResponse.status === 'fulfilled' && brandingResponse.value.ok) {
    try {
      const { branding } = await brandingResponse.value.json()
      if (branding) {
        // Individual color shortcut keys → CSS variables
        if (branding.primary_color) theme.css_variables['primary'] = branding.primary_color
        if (branding.secondary_color) theme.css_variables['secondary'] = branding.secondary_color
        if (branding.accent_color) theme.css_variables['accent'] = branding.accent_color

        // Arbitrary per-tenant CSS variable overrides (JSONB map)
        if (branding.css_overrides && typeof branding.css_overrides === 'object') {
          Object.assign(theme.css_variables, branding.css_overrides)
        }

        // Font overrides
        if (branding.font_heading) theme.fonts.heading = branding.font_heading
        if (branding.font_body) theme.fonts.body = branding.font_body
      }
    } catch {
      // Branding merge failed — continue with base theme
    }
  }

  injectThemeCSS(theme)
  loadGoogleFonts(theme.fonts)

  // Theme loaded silently in production
  return theme
}
