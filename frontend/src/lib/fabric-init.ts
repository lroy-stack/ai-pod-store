/**
 * Fabric.js v6 initialization and font loading for Design Studio.
 * Uses dynamic import to avoid SSR issues.
 */

import { FONT_FILES, AVAILABLE_FONTS } from './font-config'

export { AVAILABLE_FONTS }

let fontsLoaded = false

export async function loadFonts(): Promise<void> {
  if (fontsLoaded) return
  const promises = Object.entries(FONT_FILES).map(([family, file]) => {
    const font = new FontFace(family, `url(/fonts/${file})`)
    return font.load().then(f => {
      document.fonts.add(f)
    }).catch(() => {
      // Font load failure is non-critical — fallback to system font
    })
  })
  await Promise.all(promises)
  fontsLoaded = true
}

export async function loadFabric() {
  const fabric = await import('fabric')
  return fabric
}
