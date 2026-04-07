/**
 * Design Style Presets Library
 *
 * Curated presets for common POD design styles.
 * Each preset provides prompt engineering hints, negative prompts,
 * and suggested colors for the design generation pipeline.
 */

export interface DesignPreset {
  id: string
  name: Record<string, string>
  description: Record<string, string>
  promptSuffix: string
  negativePrompt: string
  preferredIntent: string
  suggestedColors: string[]
  thumbnail: string
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: 'minimalist',
    name: {
      en: 'Minimalist',
      es: 'Minimalista',
      de: 'Minimalistisch',
    },
    description: {
      en: 'Clean, simple designs with lots of whitespace',
      es: 'Diseños limpios y simples con mucho espacio en blanco',
      de: 'Klare, einfache Designs mit viel Weißraum',
    },
    promptSuffix: 'minimalist style, clean lines, simple composition, negative space, modern',
    negativePrompt: 'cluttered, busy, ornate, complex, detailed background',
    preferredIntent: 'vector',
    suggestedColors: ['#000000', '#FFFFFF', '#F5F5F5', '#333333'],
    thumbnail: '/presets/minimalist.png',
  },
  {
    id: 'vintage',
    name: {
      en: 'Vintage',
      es: 'Vintage',
      de: 'Vintage',
    },
    description: {
      en: 'Retro-inspired designs with aged textures',
      es: 'Diseños de inspiración retro con texturas envejecidas',
      de: 'Retro-inspirierte Designs mit gealterten Texturen',
    },
    promptSuffix: 'vintage retro style, aged texture, worn look, nostalgic, classic americana',
    negativePrompt: 'modern, futuristic, neon, glossy, digital',
    preferredIntent: 'artistic',
    suggestedColors: ['#8B4513', '#D2691E', '#F4A460', '#2F4F4F', '#DAA520'],
    thumbnail: '/presets/vintage.png',
  },
  {
    id: 'geometric',
    name: {
      en: 'Geometric',
      es: 'Geométrico',
      de: 'Geometrisch',
    },
    description: {
      en: 'Bold shapes and mathematical patterns',
      es: 'Formas audaces y patrones matemáticos',
      de: 'Kräftige Formen und mathematische Muster',
    },
    promptSuffix: 'geometric shapes, bold lines, mathematical precision, symmetrical, abstract geometry',
    negativePrompt: 'organic, natural, handdrawn, irregular, soft edges',
    preferredIntent: 'vector',
    suggestedColors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#2C3E50'],
    thumbnail: '/presets/geometric.png',
  },
  {
    id: 'watercolor',
    name: {
      en: 'Watercolor',
      es: 'Acuarela',
      de: 'Aquarell',
    },
    description: {
      en: 'Soft, fluid watercolor painting effect',
      es: 'Efecto de pintura de acuarela suave y fluido',
      de: 'Weicher, fließender Aquarell-Maleffekt',
    },
    promptSuffix: 'watercolor painting, soft washes, fluid blending, artistic brush strokes, delicate colors',
    negativePrompt: 'sharp edges, digital, pixel art, hard lines, photorealistic',
    preferredIntent: 'artistic',
    suggestedColors: ['#87CEEB', '#DDA0DD', '#98FB98', '#FFB6C1', '#FFDAB9'],
    thumbnail: '/presets/watercolor.png',
  },
  {
    id: 'pop-art',
    name: {
      en: 'Pop Art',
      es: 'Arte Pop',
      de: 'Pop Art',
    },
    description: {
      en: 'Bold, colorful designs inspired by pop culture',
      es: 'Diseños audaces y coloridos inspirados en la cultura pop',
      de: 'Kräftige, farbenfrohe Designs inspiriert von der Popkultur',
    },
    promptSuffix: 'pop art style, bold colors, halftone dots, comic book aesthetic, high contrast, Andy Warhol inspired',
    negativePrompt: 'muted colors, pastel, subtle, photorealistic, watercolor',
    preferredIntent: 'artistic',
    suggestedColors: ['#FF0000', '#FFD700', '#00BFFF', '#FF69B4', '#000000'],
    thumbnail: '/presets/pop-art.png',
  },
  {
    id: 'line-art',
    name: {
      en: 'Line Art',
      es: 'Arte Lineal',
      de: 'Linienkunst',
    },
    description: {
      en: 'Elegant single-line or outline drawings',
      es: 'Dibujos elegantes de una sola línea o contorno',
      de: 'Elegante Einlinien- oder Umrisszeichnungen',
    },
    promptSuffix: 'line art, single continuous line drawing, elegant outlines, ink illustration, monochrome',
    negativePrompt: 'filled shapes, gradient, colorful, photorealistic, 3D, shading',
    preferredIntent: 'vector',
    suggestedColors: ['#000000', '#1A1A1A', '#FFFFFF', '#333333'],
    thumbnail: '/presets/line-art.png',
  },
  {
    id: 'botanical',
    name: {
      en: 'Botanical',
      es: 'Botánico',
      de: 'Botanisch',
    },
    description: {
      en: 'Nature-inspired floral and plant illustrations',
      es: 'Ilustraciones florales y de plantas inspiradas en la naturaleza',
      de: 'Naturinspirierte Blumen- und Pflanzenillustrationen',
    },
    promptSuffix: 'botanical illustration, detailed flora, natural elements, scientific illustration style, leaves and flowers',
    negativePrompt: 'abstract, geometric, urban, mechanical, digital, neon',
    preferredIntent: 'artistic',
    suggestedColors: ['#228B22', '#2E8B57', '#556B2F', '#8FBC8F', '#F5DEB3'],
    thumbnail: '/presets/botanical.png',
  },
  {
    id: 'typography',
    name: {
      en: 'Typography',
      es: 'Tipografía',
      de: 'Typografie',
    },
    description: {
      en: 'Text-focused designs with creative lettering',
      es: 'Diseños centrados en texto con letras creativas',
      de: 'Textfokussierte Designs mit kreativer Beschriftung',
    },
    promptSuffix: 'typographic design, creative lettering, bold typography, text-based art, decorative font',
    negativePrompt: 'photorealistic, landscape, portrait, abstract shapes without text',
    preferredIntent: 'text-heavy',
    suggestedColors: ['#000000', '#FFFFFF', '#FF4500', '#1E90FF', '#FFD700'],
    thumbnail: '/presets/typography.png',
  },
]

/**
 * Get a preset by ID.
 */
export function getPresetById(id: string): DesignPreset | undefined {
  return DESIGN_PRESETS.find((p) => p.id === id)
}

/**
 * Get all preset IDs.
 */
export function getPresetIds(): string[] {
  return DESIGN_PRESETS.map((p) => p.id)
}
