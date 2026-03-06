#!/usr/bin/env node
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const SB_URL = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY = get('SUPABASE_SERVICE_KEY');

const images = [
  { file: 'public/mockup-preview/branded/7024ef34-abff-47b5-b6aa-23b4f3b588a0.webp', name: 'prism-tee.webp' },
  { file: 'public/mockup-preview/branded/e7bca6fa-c39f-47bc-8ab8-399bb03e7ce6.webp', name: 'nope-hoodie.webp' },
  { file: 'public/mockup-preview/branded/4c5c39bb-92d8-4e5a-8079-86f6561fc58c.webp', name: 'gpu-zip.webp' },
  { file: 'public/mockup-preview/branded/429ebeff-db5e-44d5-ba8c-de952d769fef.webp', name: 'ai-wrote-this-cap.webp' },
  { file: 'public/mockup-preview/branded/13bc1ffc-a703-4a9b-96fb-a460c429990c.webp', name: 'option-two-tee.webp' },
  { file: 'public/mockup-preview/branded/ceafc0f9-80bd-4ccf-8d0b-f93dc2d81774.webp', name: 'friday-deploy-snap.webp' },
  { file: 'public/mockup-preview/branded/75c19f30-003b-4a95-812a-852ae5aa337d.webp', name: 'shadow-tee.webp' },
  { file: 'public/mockup-preview/branded/c79a87b1-39bd-47ba-a47c-59ef758a04d0.webp', name: 'nervous-system-hoodie.webp' },
];

async function main() {
  const urls = {};
  for (const img of images) {
    const buffer = fs.readFileSync(img.file);
    const storagePath = `coming-soon/${img.name}`;
    const res = await fetch(`${SB_URL}/storage/v1/object/designs/${storagePath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SB_KEY}`,
        apikey: SB_KEY,
        'Content-Type': 'image/webp',
        'x-upsert': 'true',
      },
      body: buffer,
    });
    if (!res.ok) {
      console.log(`FAIL: ${img.name} ${res.status} ${await res.text()}`);
    } else {
      const url = `${SB_URL}/storage/v1/object/public/designs/${storagePath}`;
      urls[img.name] = url;
      console.log(`OK: ${img.name} (${buffer.length} bytes)`);
    }
  }
  console.log('\n--- PUBLIC URLS ---');
  for (const [k, v] of Object.entries(urls)) {
    console.log(`${k}: ${v}`);
  }
}

main().catch(e => console.error(e));
