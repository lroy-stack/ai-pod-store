/**
 * Shared font configuration for Design Studio.
 * Single source of truth for available fonts — used by:
 * - fabric-init.ts (client-side font loading)
 * - composition-renderer.ts (server-side font registration)
 * - FontPicker.tsx (UI dropdown)
 */

export const FONT_FILES: Record<string, string> = {
  'Inter': 'Inter-Regular.ttf',
  'Roboto': 'Roboto-Regular.ttf',
  'Montserrat': 'Montserrat-Regular.ttf',
  'Playfair Display': 'PlayfairDisplay-Regular.ttf',
  'Oswald': 'Oswald-Regular.ttf',
  'Lato': 'Lato-Regular.ttf',
  'Pacifico': 'Pacifico-Regular.ttf',
  'Dancing Script': 'DancingScript-Regular.ttf',
  'Great Vibes': 'GreatVibes-Regular.ttf',
  'Caveat': 'Caveat-Regular.ttf',
  'Permanent Marker': 'PermanentMarker-Regular.ttf',
  'Bebas Neue': 'BebasNeue-Regular.ttf',
}

export const AVAILABLE_FONTS = Object.keys(FONT_FILES)
