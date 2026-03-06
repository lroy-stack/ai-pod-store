import sharp from 'sharp'
import { writeFileSync } from 'fs'

// Test SVG text rendering with macOS system fonts
const fonts = ['Futura', 'Helvetica Neue', 'SF Pro Display', 'Avenir Next', 'Impact']

for (const font of fonts) {
  const svg = `<svg width="800" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="200" fill="#1e1e1e"/>
    <text x="400" y="130" text-anchor="middle" font-family="${font}" font-weight="bold" font-size="100" fill="white">${font.toUpperCase()}</text>
  </svg>`
  try {
    const buf = await sharp(Buffer.from(svg)).png().toBuffer()
    writeFileSync(`/tmp/font-${font.replace(/ /g,'_')}.png`, buf)
    console.log(`${font}: OK (${(buf.length/1024).toFixed(0)} KB)`)
  } catch (e) {
    console.log(`${font}: FAIL - ${e.message}`)
  }
}
