#!/usr/bin/env node
/**
 * Diagnostic: Create ONE mockup task for ONE color and dump the FULL JSON response.
 * Purpose: Understand the exact structure Printful returns so we can fix the extraction bug.
 */
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();

const PF_TOKEN = get('PRINTFUL_API_TOKEN');
const PF_STORE = get('PRINTFUL_STORE_ID');

const pfHeaders = {
  'Authorization': `Bearer ${PF_TOKEN}`,
  'X-PF-Store-Id': PF_STORE,
  'Content-Type': 'application/json',
};

async function pfFetch(path, opts = {}) {
  const res = await fetch(`https://api.printful.com${path}`, { headers: pfHeaders, ...opts });
  if (res.status === 429) {
    const reset = parseInt(res.headers.get('x-ratelimit-reset') || '60', 10);
    console.log(`Rate limited, waiting ${reset}s...`);
    await new Promise(r => setTimeout(r, reset * 1000));
    return pfFetch(path, opts);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function main() {
  // Use "Just For You" (sync 422030329) on CC1717 (catalog 586)
  // Test with Black (15114) which returned 3 separate mockup objects (the bug case)
  const syncProductId = 422030329;
  const catalogId = 586;
  const testVariantId = 15114; // Black

  console.log('=== Step 1: Get front design URL ===');
  const data = await pfFetch(`/store/products/${syncProductId}`);
  const v0 = data.result.sync_variants[0];
  const frontFile = v0.files.find(f => f.type === 'default' || f.type === 'front');
  console.log('Front file:', JSON.stringify(frontFile, null, 2));

  console.log('\n=== Step 2: Create mockup task ===');
  const body = {
    variant_ids: [testVariantId],
    format: 'png',
    width: 1000,
    option_groups: ['Ghost'],
    options: ['Front', 'Left', 'Back'],
    files: [
      {
        placement: 'front',
        image_url: frontFile.preview_url,
        position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 },
      },
      {
        placement: 'sleeve_left',
        image_url: 'https://files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png',
        position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 },
      },
      {
        placement: 'back',
        image_url: 'https://files.cdn.printful.com/files/d52/d52c0a1771381a65ad5b015de567877f_preview.png',
        position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 },
      },
    ],
  };

  const createRes = await pfFetch(`/mockup-generator/create-task/${catalogId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const taskKey = createRes.result.task_key;
  console.log('Task key:', taskKey);

  console.log('\n=== Step 3: Poll and dump FULL response ===');
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const taskRes = await pfFetch(`/mockup-generator/task?task_key=${taskKey}`);
    const status = taskRes.result.status;
    console.log(`Poll ${i + 1}: status=${status}`);

    if (status === 'completed') {
      // Dump the FULL response
      const output = JSON.stringify(taskRes.result, null, 2);
      fs.writeFileSync('scripts/_diag-mockup-result.json', output);
      console.log('\nFull response saved to scripts/_diag-mockup-result.json');
      console.log(`\nmockups[] array length: ${taskRes.result.mockups?.length}`);

      // Show key fields per mockup object
      for (let m = 0; m < (taskRes.result.mockups || []).length; m++) {
        const mock = taskRes.result.mockups[m];
        console.log(`\n--- mockups[${m}] ---`);
        console.log('Keys:', Object.keys(mock).join(', '));
        console.log('variant_ids:', mock.variant_ids);
        console.log('placement:', mock.placement);
        console.log('mockup_url:', mock.mockup_url?.slice(0, 80) + '...');
        console.log('extra[] length:', (mock.extra || []).length);
        // Show ALL fields that are NOT url/image data
        for (const [k, v] of Object.entries(mock)) {
          if (k === 'mockup_url' || k === 'extra') continue;
          console.log(`  ${k}:`, typeof v === 'string' ? v.slice(0, 100) : v);
        }
        // Show extra[] items
        for (let e = 0; e < (mock.extra || []).length; e++) {
          const ex = mock.extra[e];
          console.log(`  extra[${e}]:`, {
            ...ex,
            url: ex.url?.slice(0, 60) + '...',
          });
        }
      }
      return;
    }

    if (status === 'failed') {
      console.log('FAILED:', JSON.stringify(taskRes.result, null, 2));
      return;
    }
  }
  console.log('Timed out');
}

main().catch(e => console.error(e));
