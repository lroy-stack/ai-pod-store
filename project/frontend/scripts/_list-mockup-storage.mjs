#!/usr/bin/env node
/**
 * List all mockup images in Supabase Storage under designs/mockups/
 */
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const SB_URL = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY = get('SUPABASE_SERVICE_KEY');

async function listFolder(prefix) {
  const res = await fetch(`${SB_URL}/storage/v1/object/list/designs`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix, limit: 200, sortBy: { column: 'name', order: 'asc' } }),
  });
  return res.json();
}

async function main() {
  // List mockups/ subfolders
  const folders = await listFolder('mockups');
  console.log('=== MOCKUP FOLDERS ===');
  for (const f of folders) {
    if (f.id === null) {
      // It's a folder
      console.log(`\n📁 mockups/${f.name}/`);
      const files = await listFolder(`mockups/${f.name}`);
      for (const file of files) {
        if (file.name) {
          console.log(`  ${file.name} (${Math.round((file.metadata?.size || 0) / 1024)}KB)`);
        }
      }
    }
  }

  // Also check coming-soon/
  console.log('\n=== COMING-SOON IMAGES ===');
  const csFiles = await listFolder('coming-soon');
  for (const f of csFiles) {
    if (f.name) {
      console.log(`  ${f.name} (${Math.round((f.metadata?.size || 0) / 1024)}KB)`);
    }
  }
}

main().catch(e => console.error(e));
