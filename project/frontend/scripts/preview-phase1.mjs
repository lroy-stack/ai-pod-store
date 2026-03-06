import sharp from 'sharp';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE = join(import.meta.dirname, '../public/phase1-production');
const dirs = ['tshirts', 'hoodies', 'crewnecks', 'longsleeves', 'mugs', 'caps'];

for (const dir of dirs) {
  const fullDir = join(BASE, dir);
  let files;
  try { files = readdirSync(fullDir).filter(f => f.endsWith('.svg')); } catch { continue; }

  for (const f of files) {
    const svgBuf = readFileSync(join(fullDir, f));
    const outPath = join(BASE, 'renders', `${dir}--${f.replace('.svg', '.png')}`);
    try {
      const svgStr = svgBuf.toString('utf-8');
      const wMatch = svgStr.match(/width="(\d+)"/);
      const hMatch = svgStr.match(/height="(\d+)"/);
      const w = wMatch ? parseInt(wMatch[1]) : 800;
      const h = hMatch ? parseInt(hMatch[1]) : 800;

      // Render at 1/4 for preview, dark bg to simulate garment
      await sharp(svgBuf)
        .resize(Math.round(w/4), Math.round(h/4), { fit: 'contain', background: { r: 30, g: 30, b: 30, alpha: 255 } })
        .png()
        .toFile(outPath);
      console.log(`✓ ${dir}/${f} (${w}x${h}) → preview`);
    } catch (e) {
      console.error(`✗ ${dir}/${f}: ${e.message}`);
    }
  }
}
console.log('\nDone. Check renders/ directory.');
