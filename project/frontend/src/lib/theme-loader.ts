/**
 * Theme Loader
 *
 * Fetches the active theme from the API and injects CSS variables into the document.
 * This enables dynamic theme switching without page reload.
 */

interface ThemeVariables {
  [key: string]: string;
}

interface ThemeFonts {
  heading: string;
  body: string;
  mono: string;
}

interface Theme {
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

/**
 * Maps shadow presets to CSS shadow values
 */
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
 * Converts theme CSS variables object to CSS custom properties string
 */
function variablesToCSS(variables: ThemeVariables, isDark = false): string {
  const properties = Object.entries(variables).map(([key, value]) => {
    // Convert snake_case to kebab-case for CSS variable names
    const cssKey = key.replace(/_/g, '-');
    return `  --color-${cssKey}: ${value};`;
  });
  return properties.join('\n');
}

/**
 * Injects theme CSS into document head
 */
function injectThemeCSS(theme: Theme): void {
  // Remove existing theme style tag if it exists
  const existingStyle = document.getElementById('dynamic-theme-style');
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create new style tag
  const styleTag = document.createElement('style');
  styleTag.id = 'dynamic-theme-style';

  // Generate CSS with both light and dark mode variables
  const lightCSS = variablesToCSS(theme.css_variables, false);
  const darkCSS = variablesToCSS(theme.css_variables_dark, true);

  // Get shadow value from preset
  const shadowValue = SHADOW_PRESETS[theme.shadow_preset] || SHADOW_PRESETS.medium;

  styleTag.textContent = `
:root {
${lightCSS}
  --radius: ${RADIUS_PRESETS[theme.border_radius] || theme.border_radius};
  --shadow: ${shadowValue};
}

.dark {
${darkCSS}
  --radius: ${RADIUS_PRESETS[theme.border_radius] || theme.border_radius};
  --shadow: ${shadowValue};
}
`.trim();

  // Append to head
  document.head.appendChild(styleTag);
}

/**
 * Loads Google Fonts dynamically based on theme fonts
 */
function loadGoogleFonts(fonts: ThemeFonts): void {
  // Remove existing font link if it exists
  const existingLink = document.getElementById('dynamic-theme-fonts');
  if (existingLink) {
    existingLink.remove();
  }

  // Collect unique font families
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

  // If no custom fonts, return early
  if (fontFamilies.size === 0) {
    return;
  }

  // Create Google Fonts link
  const link = document.createElement('link');
  link.id = 'dynamic-theme-fonts';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${Array.from(fontFamilies)
    .map(font => `family=${encodeURIComponent(font)}:wght@400;500;600;700`)
    .join('&')}&display=swap`;

  // Append to head
  document.head.appendChild(link);

  // Update CSS variables for fonts
  const fontStyleTag = document.createElement('style');
  fontStyleTag.id = 'dynamic-theme-font-families';
  fontStyleTag.textContent = `
:root {
  --font-heading: "${fonts.heading}", system-ui, sans-serif;
  --font-body: "${fonts.body}", system-ui, sans-serif;
  --font-mono: "${fonts.mono}", ui-monospace, monospace;
}
`.trim();
  document.head.appendChild(fontStyleTag);
}

/**
 * Loads the active theme from the API and applies it to the document
 *
 * @returns Promise that resolves with the loaded theme
 * @throws Error if theme loading fails
 */
export async function loadActiveTheme(): Promise<Theme> {
  try {
    const response = await fetch('/api/storefront/theme', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch theme: ${response.status} ${response.statusText}`);
    }

    const theme: Theme = await response.json();

    // Inject CSS variables into document
    injectThemeCSS(theme);

    // Load Google Fonts
    loadGoogleFonts(theme.fonts);

    console.log(`✓ Theme loaded: ${theme.name} (${theme.slug})`);

    return theme;
  } catch (error) {
    console.error('Error loading theme:', error);
    throw error;
  }
}

/**
 * Preloads the active theme (useful for SSR/SSG)
 * Can be called during server-side rendering to warm up the cache
 */
export async function preloadActiveTheme(): Promise<Theme | null> {
  if (typeof window === 'undefined') {
    // Server-side: just fetch the theme without injecting
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/storefront/theme`,
        { next: { revalidate: 300 } }
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error preloading theme:', error);
    }
    return null;
  } else {
    // Client-side: load and inject
    return loadActiveTheme();
  }
}
