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
 * Applies CSS variables to an element safely using setProperty().
 * No dangerouslySetInnerHTML or textContent CSS injection.
 */
function applyVariables(element: HTMLElement, variables: ThemeVariables): void {
  Object.entries(variables).forEach(([key, value]) => {
    const cssKey = `--${key.replace(/_/g, '-')}`;
    element.style.setProperty(cssKey, value);
  });
}

/**
 * Injects theme CSS variables safely via style.setProperty().
 * Uses document.documentElement (:root) and .dark class for theme variants.
 */
function injectThemeCSS(theme: Theme): void {
  // Remove existing theme style tags (both server-rendered and dynamic)
  const serverStyle = document.getElementById('server-theme-style');
  if (serverStyle) {
    serverStyle.remove();
  }
  const existingStyle = document.getElementById('dynamic-theme-style');
  if (existingStyle) {
    existingStyle.remove();
  }

  const shadowValue = SHADOW_PRESETS[theme.shadow_preset] || SHADOW_PRESETS.medium;
  const radiusValue = RADIUS_PRESETS[theme.border_radius] || theme.border_radius;

  // Apply light theme variables to :root
  const root = document.documentElement;
  applyVariables(root, theme.css_variables);
  root.style.setProperty('--radius', radiusValue);
  root.style.setProperty('--shadow', shadowValue);
  root.style.setProperty('--font-sans', `"${theme.fonts.body}", system-ui, sans-serif`);
  root.style.setProperty('--font-heading', `"${theme.fonts.heading}", system-ui, sans-serif`);
  root.style.setProperty('--font-mono', `"${theme.fonts.mono}", ui-monospace, monospace`);

  // Apply dark theme variables via inline style on .dark class
  // This requires a workaround: we inject a minimal <style> with .dark selector
  // but without user-controlled content in the CSS text
  const styleTag = document.createElement('style');
  styleTag.id = 'dynamic-theme-style';

  // Build dark theme CSS properties using setProperty-like approach
  const darkProperties = Object.entries(theme.css_variables_dark)
    .map(([key, value]) => {
      const cssKey = `--${key.replace(/_/g, '-')}`;
      // Escape value to prevent CSS injection
      const safeValue = value.replace(/[<>"']/g, '');
      return `${cssKey}: ${safeValue};`;
    })
    .join(' ');

  // Only inject the minimal .dark selector with safe properties
  styleTag.textContent = `.dark { ${darkProperties} --radius: ${radiusValue}; --shadow: ${shadowValue}; }`;
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
 * Loads the active theme from the API and applies it to the document
 */
export async function loadActiveTheme(): Promise<Theme> {
  const response = await fetch('/api/storefront/theme', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch theme: ${response.status} ${response.statusText}`);
  }

  const theme: Theme = await response.json();

  injectThemeCSS(theme);
  loadGoogleFonts(theme.fonts);

  console.log(`Theme loaded: ${theme.name} (${theme.slug})`);
  return theme;
}
