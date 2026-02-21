#!/usr/bin/env node
/**
 * Generate placeholder mockup template images using sharp
 * These are simple colored rectangles representing product mockups
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a solid color PNG image using sharp
 */
async function createColoredPNG(r, g, b, width = 500, height = 600) {
  // Create an SVG with a solid color rectangle
  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="rgb(${r}, ${g}, ${b})" />
    </svg>
  `;

  // Convert SVG to PNG using sharp
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}

// Templates to create
const templates = [
  { name: 'tshirt-white.png', r: 255, g: 255, b: 255, width: 500, height: 600 },
  { name: 'tshirt-black.png', r: 30, g: 30, b: 30, width: 500, height: 600 },
  { name: 'hoodie-white.png', r: 255, g: 255, b: 255, width: 500, height: 700 },
  { name: 'hoodie-black.png', r: 30, g: 30, b: 30, width: 500, height: 700 },
  { name: 'mug-white.png', r: 255, g: 255, b: 255, width: 400, height: 400 },
  { name: 'phone-case-black.png', r: 30, g: 30, b: 30, width: 300, height: 600 },
  { name: 'tote-bag-natural.png', r: 245, g: 222, b: 179, width: 500, height: 500 },
];

const outputDir = path.join(__dirname, '../public/mockup-templates');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate each template
async function generateAll() {
  for (const { name, r, g, b, width, height } of templates) {
    const pngBuffer = await createColoredPNG(r, g, b, width, height);
    const outputPath = path.join(outputDir, name);
    fs.writeFileSync(outputPath, pngBuffer);
    console.log(`✓ Created ${name} (${width}x${height})`);
  }
  console.log(`\n✓ Generated ${templates.length} mockup templates in ${outputDir}`);
}

generateAll().catch(console.error);
