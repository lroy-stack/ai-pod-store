#!/usr/bin/env node
/**
 * Regenerate all kids PNG designs from updated SVGs
 * Uses sharp to convert at exact canvas dimensions per blueprint
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const designsDir = join(__dirname, '..', 'public', 'kids-designs')

// Each design with its exact canvas dimensions
const designs = [
  { file: '01-not-crying-compiling', width: 3000, height: 3800 },  // BP189 Baby Bodysuit
  { file: '02-bug-reporter',         width: 3000, height: 3800 },  // BP157 Baby T-Shirt
  { file: '03-sudo-ice-cream',       width: 3402, height: 4264 },  // BP145 Kids Softstyle Tee
  { file: '04-bedtime-not-found',    width: 3402, height: 4264 },  // BP145 Kids Softstyle Tee
  { file: '05-ctrl-z-homework',      width: 4606, height: 5787 },  // BP6 Kids Heavy Cotton Tee
  { file: '06-ai-raised-me',         width: 3531, height: 2908 },  // BP67 Kids Hoodie
  { file: '07-my-code-works',        width: 3319, height: 3761 },  // BP65 Kids Crewneck
  { file: '08-future-prompt-engineer', width: 2571, height: 4886 }, // BP1470 Kids EVA Clogs
]

async function main() {
  console.log('Regenerating kids PNGs from updated SVGs...\n')

  for (const d of designs) {
    const svgPath = join(designsDir, `${d.file}.svg`)
    const pngPath = join(designsDir, `${d.file}.png`)

    try {
      const svgBuffer = readFileSync(svgPath)

      const pngBuffer = await sharp(svgBuffer, { density: 300, limitInputPixels: false })
        .resize(d.width, d.height, { fit: 'fill' })
        .png({ compressionLevel: 6 })
        .toBuffer()

      writeFileSync(pngPath, pngBuffer)
      const sizeMB = (pngBuffer.length / 1024 / 1024).toFixed(2)
      console.log(`  ✓ ${d.file}.png — ${d.width}x${d.height} — ${sizeMB} MB`)
    } catch (err) {
      console.error(`  ✗ ${d.file} — ${err.message}`)
    }
  }

  console.log('\nDone!')
}

main()
