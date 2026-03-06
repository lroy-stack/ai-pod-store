/**
 * "THINK FOR YOURSELF" Maze — M2580 Hoodie Front (1800×1800)
 *
 * V8 FINAL: Real geometric maze, text follows walls coherently.
 * - Nested rectangles with gaps (doors) form a solvable path
 * - "THINK" runs along each wall
 * - "YOURSELF" + "SKAPARA" in corridors and center
 * - Entry at bottom, Exit at top-right
 */
import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'

const SIZE = 1800
const canvas = createCanvas(SIZE, SIZE)
const ctx = canvas.getContext('2d')
ctx.clearRect(0, 0, SIZE, SIZE)

// ─── MAZE PARAMETERS ───
const M = 110     // outer margin
const W = 6       // wall thickness
const C = 95      // corridor width
const S = W + C   // step = 101px
const N = 15      // grid units (15 * 101 = 1515 + 2*110 = 1735, fits 1800)

ctx.fillStyle = '#FFFFFF'

// Helpers
function hWall(x1, x2, y) {
  ctx.fillRect(M + x1 * S, M + y * S, (x2 - x1) * S + W, W)
}
function vWall(x, y1, y2) {
  ctx.fillRect(M + x * S, M + y1 * S, W, (y2 - y1) * S + W)
}

// ═══════════════════════════════════════════
// RING 0 — Outer border
// ═══════════════════════════════════════════
hWall(0, N, 0)          // top (full)
hWall(0, 6, N)          // bottom-left
hWall(8, N, N)          // bottom-right (gap 6-8 = entry)
vWall(0, 0, N)          // left (full)
vWall(N, 0, 2)          // right-top
vWall(N, 4, N)          // right-bottom (gap 2-4 = exit)

// ═══════════════════════════════════════════
// RING 1
// ═══════════════════════════════════════════
hWall(1, 6, 1)          // top-left
hWall(8, N - 1, 1)      // top-right (gap 6-8)
hWall(2, N - 1, N - 1)  // bottom (gap at left 1-2)
vWall(1, 1, 6)          // left-top
vWall(1, 8, N - 1)      // left-bottom (gap 6-8)
vWall(N - 1, 1, N - 1)  // right (full)

// ═══════════════════════════════════════════
// RING 2
// ═══════════════════════════════════════════
hWall(2, N - 2, 2)      // top (full)
hWall(2, 5, N - 2)      // bottom-left
hWall(7, N - 2, N - 2)  // bottom-right (gap 5-7)
vWall(2, 2, 5)          // left-top
vWall(2, 7, N - 2)      // left-bottom (gap 5-7)
vWall(N - 2, 2, 5)      // right-top
vWall(N - 2, 7, N - 2)  // right-bottom (gap 5-7)

// ═══════════════════════════════════════════
// RING 3
// ═══════════════════════════════════════════
hWall(3, 6, 3)          // top-left
hWall(8, N - 3, 3)      // top-right (gap 6-8)
hWall(3, N - 3, N - 3)  // bottom (full)
vWall(3, 3, N - 3)      // left (full)
vWall(N - 3, 3, 6)      // right-top
vWall(N - 3, 8, N - 3)  // right-bottom (gap 6-8)

// ═══════════════════════════════════════════
// RING 4 (innermost)
// ═══════════════════════════════════════════
hWall(4, N - 4, 4)      // top (full)
hWall(5, 7, N - 4)      // bottom-left
hWall(9, N - 4, N - 4)  // bottom-right (gap 7-9)
vWall(4, 4, 6)          // left-top (gap 6-center)
vWall(4, 8, N - 4)      // left-bottom
vWall(N - 4, 4, N - 4)  // right (full)

// ═══════════════════════════════════════════
// INTERNAL WALLS (create zigzag paths)
// ═══════════════════════════════════════════
// Upper inner area
hWall(5, 8, 5)
vWall(5, 5, 6)
vWall(8, 5, 6)

// Lower inner area
hWall(5, 8, N - 5)
vWall(5, N - 6, N - 5)
vWall(8, N - 6, N - 5)

// Center horizontal bars
hWall(5, 7, 7)
hWall(5, 7, 8)

// Additional complexity stubs
hWall(9, 11, 6)
hWall(9, 11, N - 6)
vWall(7, 3, 4)
vWall(7, N - 4, N - 3)

// ═══════════════════════════════════════════
// TEXT ALONG WALLS — "THINK" follows each segment
// ═══════════════════════════════════════════
const TF = '900 14px "Arial Black", "Helvetica Neue", sans-serif'
const TFv = '900 12px "Arial Black", "Helvetica Neue", sans-serif'

function textH(x1, x2, y, below = true) {
  const left = M + x1 * S + 8
  const right = M + x2 * S - 2
  const ty = M + y * S + (below ? W + 2 : -14)
  ctx.font = TF
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  let tx = left
  while (tx + 55 < right) {
    ctx.fillText('THINK', tx, ty)
    tx += 62
  }
}

function textV(x, y1, y2, right = true) {
  const px = M + x * S + (right ? W + 2 : -2)
  const top = M + y1 * S + 20
  const bottom = M + y2 * S - 10
  ctx.font = TFv
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let ty = top
  while (ty < bottom) {
    ctx.save()
    ctx.translate(px, ty)
    ctx.rotate(right ? Math.PI / 2 : -Math.PI / 2)
    ctx.fillText('THINK', 0, 0)
    ctx.restore()
    ty += 50
  }
}

// Ring 0 text
textH(0, N, 0); textH(0, 6, N); textH(8, N, N)
textV(0, 0, N); textV(N, 0, 2); textV(N, 4, N)

// Ring 1 text
textH(1, 6, 1); textH(8, N - 1, 1); textH(2, N - 1, N - 1)
textV(1, 1, 6); textV(1, 8, N - 1); textV(N - 1, 1, N - 1)

// Ring 2 text
textH(2, N - 2, 2); textH(2, 5, N - 2); textH(7, N - 2, N - 2)
textV(2, 2, 5); textV(2, 7, N - 2); textV(N - 2, 2, 5); textV(N - 2, 7, N - 2)

// Ring 3 text
textH(3, 6, 3); textH(8, N - 3, 3); textH(3, N - 3, N - 3)
textV(3, 3, N - 3); textV(N - 3, 3, 6); textV(N - 3, 8, N - 3)

// Ring 4 text
textH(4, N - 4, 4); textH(5, 7, N - 4); textH(9, N - 4, N - 4)
textV(4, 4, 6); textV(4, 8, N - 4); textV(N - 4, 4, N - 4)

// Internal text
textH(5, 8, 5); textH(5, 8, N - 5)
textH(5, 7, 7); textH(5, 7, 8)
textH(9, 11, 6); textH(9, 11, N - 6)

// ═══════════════════════════════════════════
// "YOURSELF" IN CORRIDORS — coherent placement
// ═══════════════════════════════════════════
ctx.font = '900 24px "Arial Black", Impact, sans-serif'
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'

function ys(gx, gy, rot = 0) {
  const px = M + gx * S + S / 2
  const py = M + gy * S + S / 2
  ctx.save()
  ctx.translate(px, py)
  if (rot) ctx.rotate(rot)
  ctx.fillText('YOURSELF', 0, 0)
  ctx.restore()
}

// Top corridor
ys(6.5, 0.3)

// Ring 1 corridors
ys(3.5, 1.3)
ys(10, 1.3)
ys(5, N - 1.5)
ys(10, N - 1.5)

// Ring 2 side corridors (vertical)
ys(0.3, 7, Math.PI / 2)
ys(N - 0.5, 7, -Math.PI / 2)

// Ring 2 internal
ys(4.5, 2.5)
ys(10, 2.5)

// Ring 3 corridors
ys(5, N - 2.7)
ys(10, N - 2.7)
ys(1.3, 3.5, Math.PI / 2)
ys(1.3, 11, Math.PI / 2)

// Inner corridors
ys(6.5, 4.5)
ys(6.5, N - 4.5)
ys(3.5, 7, Math.PI / 2)
ys(N - 3.7, 7, -Math.PI / 2)

// ═══════════════════════════════════════════
// CENTER — Large "YOURSELF" + "SKAPARA"
// ═══════════════════════════════════════════
const cx = M + 7.5 * S
const cy = M + 7.5 * S

ctx.font = '900 48px "Arial Black", Impact, sans-serif'
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
ctx.fillText('YOURSELF', cx, cy - 8)

ctx.font = '900 20px "Arial Black", Impact, sans-serif'
ctx.fillText('S K A P A R A', cx, cy + 28)

// ═══════════════════════════════════════════
// ENTRY / EXIT ARROWS
// ═══════════════════════════════════════════
ctx.strokeStyle = '#FFFFFF'
ctx.lineWidth = 2.5
ctx.lineCap = 'round'

// Entry (bottom, pointing up)
const entryX = M + 7 * S + S / 2
const entryY = M + N * S + 20
ctx.beginPath()
ctx.moveTo(entryX, entryY + 25)
ctx.lineTo(entryX, entryY)
ctx.moveTo(entryX - 7, entryY + 9)
ctx.lineTo(entryX, entryY)
ctx.lineTo(entryX + 7, entryY + 9)
ctx.stroke()

// Exit (right, pointing right)
const exitX = M + N * S + 12
const exitY = M + 3 * S + S / 2
ctx.beginPath()
ctx.moveTo(exitX, exitY)
ctx.lineTo(exitX + 25, exitY)
ctx.moveTo(exitX + 16, exitY - 7)
ctx.lineTo(exitX + 25, exitY)
ctx.lineTo(exitX + 16, exitY + 7)
ctx.stroke()

// ═══════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════
const outDir = '/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/public/brand-designs/think-maze'

const buffer = canvas.toBuffer('image/png')
writeFileSync(`${outDir}/think-maze-front-1800x1800.png`, buffer)
console.log(`✓ Production PNG: ${(buffer.length / 1024).toFixed(1)} KB`)

const pc = createCanvas(SIZE, SIZE)
const pctx = pc.getContext('2d')

for (const { name, color } of [
  { name: 'black', color: '#080808' },
  { name: 'navy-blazer', color: '#171f2c' },
  { name: 'charcoal-heather', color: '#463e3d' },
]) {
  pctx.fillStyle = color
  pctx.fillRect(0, 0, SIZE, SIZE)
  pctx.drawImage(canvas, 0, 0)
  writeFileSync(`${outDir}/think-maze-preview-${name}.png`, pc.toBuffer('image/png'))
}
console.log('✓ 3 color previews')
