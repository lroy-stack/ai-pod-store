#!/usr/bin/env node
/**
 * Preview SVGs on dark garment backgrounds.
 * Rewrites SVG width/height to preview size (keeps viewBox for scaling),
 * then composites on a garment-color background.
 *
 * Usage:
 *   node scripts/preview-svgs.mjs                 # all SVGs
 *   node scripts/preview-svgs.mjs a01             # single SVG by prefix
 *   node scripts/preview-svgs.mjs --bg=#1a1a2e    # custom background
 */
import sharp from 'sharp';
import { readdir, readFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';

const DESIGNS_DIR = join(import.meta.dirname, '../public/expansion-designs');
const PREVIEW_DIR = join(DESIGNS_DIR, 'previews');
const PREVIEW_WIDTH = 800;

const DEFAULT_BG = '#2D2D2D'; // charcoal — realistic dark t-shirt

function hexToRgba(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b, alpha: 1 };
}

async function renderPreview(svgPath, bgColor) {
  const svgStr = (await readFile(svgPath, 'utf-8'));

  // Extract original dimensions from viewBox or width/height
  const vbMatch = svgStr.match(/viewBox="0 0 (\d+) (\d+)"/);
  const wMatch = svgStr.match(/width="(\d+)"/);
  const hMatch = svgStr.match(/height="(\d+)"/);

  const origW = parseInt(vbMatch?.[1] || wMatch?.[1]);
  const origH = parseInt(vbMatch?.[2] || hMatch?.[2]);
  if (!origW || !origH) return null;

  const scale = PREVIEW_WIDTH / origW;
  const previewH = Math.round(origH * scale);

  // Rewrite SVG to preview dimensions (viewBox stays, width/height shrink)
  const smallSvg = svgStr
    .replace(/width="\d+"/, `width="${PREVIEW_WIDTH}"`)
    .replace(/height="\d+"/, `height="${previewH}"`);

  // Render SVG to PNG buffer
  const svgPng = await sharp(Buffer.from(smallSvg))
    .png()
    .toBuffer();

  // Create background and composite
  const result = await sharp({
    create: {
      width: PREVIEW_WIDTH,
      height: previewH,
      channels: 4,
      background: hexToRgba(bgColor),
    }
  })
    .composite([{ input: svgPng, blend: 'over' }])
    .png()
    .toBuffer();

  const outName = basename(svgPath, '.svg') + '-preview.png';
  const outPath = join(PREVIEW_DIR, outName);
  await sharp(result).toFile(outPath);
  return outPath;
}

async function main() {
  await mkdir(PREVIEW_DIR, { recursive: true });

  const args = process.argv.slice(2);
  let filter = null;
  let bgColor = DEFAULT_BG;

  for (const arg of args) {
    if (arg.startsWith('--bg=')) bgColor = arg.slice(5);
    else filter = arg.toLowerCase();
  }

  const files = (await readdir(DESIGNS_DIR))
    .filter(f => f.endsWith('.svg'))
    .filter(f => !filter || f.toLowerCase().includes(filter))
    .sort();

  if (!files.length) {
    console.log('No SVGs found' + (filter ? ` matching "${filter}"` : ''));
    return;
  }

  console.log(`Rendering ${files.length} SVGs on ${bgColor}...\n`);

  for (const file of files) {
    try {
      const out = await renderPreview(join(DESIGNS_DIR, file), bgColor);
      if (out) console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  console.log(`\nPreviews → ${PREVIEW_DIR}`);
}

main().catch(console.error);
