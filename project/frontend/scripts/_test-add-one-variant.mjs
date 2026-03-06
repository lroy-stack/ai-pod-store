#!/usr/bin/env node
/**
 * TEST: Add ONE variant to "Just For You" (Navy/S) with url-based files.
 * If this works, the format is correct and we can batch the rest.
 */
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const PF_TOKEN = get('PRINTFUL_API_TOKEN');
const PF_STORE = get('PRINTFUL_STORE_ID');

const SYNC_PRODUCT_ID = 422030329; // Just For You
const PRICE = '38.09';

// Navy / S = catalog variant 21555 (from step 1 output)
const TEST_VARIANT_ID = 21555;

// File URLs from existing variant (Supabase Storage originals)
const FRONT_URL = 'https://your-project.supabase.co/storage/v1/object/public/designs/printful-migration/front-just-for-you.png';
const BACK_URL = 'https://your-project.supabase.co/storage/v1/object/public/designs/branding/back-wordmark-v2-37pct.png';
const SLEEVE_URL = 'https://your-project.supabase.co/storage/v1/object/public/designs/branding/sleeve-left-v2-32pct.png';

const headers = {
  'Authorization': `Bearer ${PF_TOKEN}`,
  'X-PF-Store-Id': PF_STORE,
  'Content-Type': 'application/json',
};

async function main() {
  console.log('TEST: Adding Navy/S to Just For You...');
  console.log(`  variant_id: ${TEST_VARIANT_ID}`);
  console.log(`  Files: url-based (not id-based)`);

  const body = {
    variant_id: TEST_VARIANT_ID,
    retail_price: PRICE,
    files: [
      { type: 'default', url: FRONT_URL },
      { type: 'back', url: BACK_URL },
      { type: 'sleeve_left', url: SLEEVE_URL },
    ],
  };

  console.log('\nRequest body:');
  console.log(JSON.stringify(body, null, 2));

  const res = await fetch(`https://api.printful.com/store/products/${SYNC_PRODUCT_ID}/variants`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log(`\nResponse ${res.status}:`);
  console.log(JSON.stringify(data, null, 2).slice(0, 500));

  if (res.ok) {
    console.log('\nSUCCESS — url-based files work!');
    console.log(`  New sync_variant_id: ${data.result?.id}`);
    console.log(`  Color: ${data.result?.product?.color || data.result?.color}`);
    console.log(`  Files count: ${data.result?.files?.length}`);
  } else {
    console.log('\nFAILED — trying with "front" instead of "default"...');

    // Retry with type: "front" instead of "default"
    body.files[0].type = 'front';
    const res2 = await fetch(`https://api.printful.com/store/products/${SYNC_PRODUCT_ID}/variants`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data2 = await res2.json();
    console.log(`\nRetry response ${res2.status}:`);
    console.log(JSON.stringify(data2, null, 2).slice(0, 500));

    if (res2.ok) {
      console.log('\nSUCCESS with type "front" — use "front" not "default"!');
    }
  }
}

main().catch(e => console.error('FATAL:', e));
