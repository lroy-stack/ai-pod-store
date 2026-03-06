#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');

const products = [
  'existential-dread', 'plans-cancelled', 'self-care-mode', 'social-battery', 'soup-fork'
];

for (const slug of products) {
  const url = `${SB}/storage/v1/object/public/designs/mockups/${slug}/black-front.png`;
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  console.log(`${slug.padEnd(20)} black-front: ${buf.byteLength} bytes`);
}
