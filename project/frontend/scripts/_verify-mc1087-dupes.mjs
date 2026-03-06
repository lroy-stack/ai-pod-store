#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');

const products = ['existential-dread', 'plans-cancelled', 'self-care-mode', 'social-battery', 'soup-fork'];
const colors = ['black', 'navy-blazer', 'vintage-black'];
const views = ['front', 'back', 'sleeve_left'];

for (const slug of products) {
  console.log(`\n=== ${slug} ===`);
  for (const color of colors) {
    const sizes = [];
    for (const view of views) {
      const url = `${SB}/storage/v1/object/public/designs/mockups/${slug}/${color}-${view}.png`;
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      sizes.push(buf.byteLength);
    }
    const allSame = sizes[0] === sizes[1] && sizes[1] === sizes[2];
    console.log(`  ${color.padEnd(15)} front=${sizes[0]} back=${sizes[1]} sleeve=${sizes[2]} ${allSame ? '⚠ DUPLICATE' : '✓ OK'}`);
  }
}
