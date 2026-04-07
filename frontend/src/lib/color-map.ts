/**
 * Maps common garment color names (from providers) to hex codes.
 * Used in the Design Editor to render color swatches for variant selection.
 */

const COLOR_NAME_TO_HEX: Record<string, string> = {
  // Basics
  'black': '#1a1a1a',
  'white': '#ffffff',
  'natural': '#f5e6d3',
  'cream': '#fffdd0',
  'ivory': '#fffff0',

  // Grays
  'gray': '#808080',
  'grey': '#808080',
  'light gray': '#d3d3d3',
  'light grey': '#d3d3d3',
  'dark gray': '#404040',
  'dark grey': '#404040',
  'charcoal': '#36454f',
  'heather grey': '#9e9e9e',
  'heather gray': '#9e9e9e',
  'grey melange': '#b0b0b0',
  'ash': '#b2beb5',
  'mouse grey': '#878787',

  // Blues
  'navy': '#000080',
  'navy blue': '#000080',
  'french navy': '#1a237e',
  'royal blue': '#4169e1',
  'blue': '#0000ff',
  'light blue': '#add8e6',
  'sky blue': '#87ceeb',
  'cobalt': '#0047ab',
  'ocean blue': '#4f94cd',

  // Reds
  'red': '#dc143c',
  'burgundy': '#800020',
  'maroon': '#800000',
  'wine': '#722f37',
  'dark red': '#8b0000',
  'cardinal red': '#c41e3a',
  'crimson': '#dc143c',

  // Greens
  'green': '#008000',
  'forest green': '#228b22',
  'olive': '#808000',
  'army green': '#4b5320',
  'sage': '#bcb88a',
  'mint': '#98ff98',
  'khaki': '#c3b091',
  'neon green': '#39ff14',
  'kelly green': '#4cbb17',

  // Yellows / Oranges
  'yellow': '#ffd700',
  'gold': '#ffd700',
  'orange': '#ff8c00',
  'peach': '#ffcba4',
  'coral': '#ff7f50',
  'tangerine': '#ff9966',

  // Pinks / Purples
  'pink': '#ffc0cb',
  'hot pink': '#ff69b4',
  'magenta': '#ff00ff',
  'purple': '#800080',
  'lavender': '#e6e6fa',
  'plum': '#8e4585',
  'violet': '#7f00ff',

  // Browns
  'brown': '#8b4513',
  'tan': '#d2b48c',
  'sand': '#c2b280',
  'chocolate': '#7b3f00',
  'camel': '#c19a6b',
  'warm sand': '#d2b48c',

  // Specialty
  'heather': '#b0b0b0',
  'denim': '#1560bd',
  'camo': '#78866b',
  'tie-dye': '#ff69b4',
  'neon orange': '#ff6700',
  'neon yellow': '#ccff00',
  'neon pink': '#ff6ec7',
}

/**
 * Convert a garment color name to hex code.
 * Falls back to a neutral gray if the color name is unknown.
 */
export function colorNameToHex(name: string): string {
  const normalized = name.toLowerCase().trim()
  return COLOR_NAME_TO_HEX[normalized] || '#808080'
}

/**
 * Determine if a color is "light" (for text contrast purposes).
 * Uses relative luminance calculation.
 */
export function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '')
  const r = parseInt(color.substring(0, 2), 16)
  const g = parseInt(color.substring(2, 4), 16)
  const b = parseInt(color.substring(4, 6), 16)
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}
