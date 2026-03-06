#!/usr/bin/env node
/**
 * Register Printful webhook events for real-time stock updates.
 *
 * Run once after deploying the app with a public domain:
 *   node scripts/register-printful-webhooks.mjs
 *
 * Requires env vars in .env.local:
 *   PRINTFUL_API_TOKEN, PRINTFUL_STORE_ID, PRINTFUL_WEBHOOK_SECRET, DOMAIN
 */
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf8');
const env = (key) => {
  const m = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
  if (!m) throw new Error(`Missing env: ${key}`);
  return m[1].trim().replace(/^["']|["']$/g, '');
};

const PF_TOKEN  = env('PRINTFUL_API_TOKEN');
const PF_STORE  = env('PRINTFUL_STORE_ID');
const SECRET    = env('PRINTFUL_WEBHOOK_SECRET');
const DOMAIN    = env('DOMAIN');

if (!DOMAIN || DOMAIN === 'your-domain.com') {
  console.error('ERROR: Set DOMAIN in .env.local to your production domain (e.g. skapara.com)');
  process.exit(1);
}

const BASE_URL = `https://${DOMAIN}/api/webhooks/pod/printful?secret=${SECRET}`;

const pfHeaders = {
  'Authorization': `Bearer ${PF_TOKEN}`,
  'X-PF-Store-Id': PF_STORE,
  'Content-Type': 'application/json',
  'User-Agent': 'POD-AI-Store/1.0',
};

// Events to register — stock_updated is the most critical
const EVENTS = [
  'stock_updated',
  'product_updated',
  'order_created',
  'order_updated',
  'package_shipped',
];

async function listWebhooks() {
  const res = await fetch('https://api.printful.com/webhooks', {
    headers: pfHeaders,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`List webhooks failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function registerWebhooks() {
  const res = await fetch('https://api.printful.com/webhooks', {
    method: 'POST',
    headers: pfHeaders,
    body: JSON.stringify({
      url: BASE_URL,
      types: EVENTS,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Register webhooks failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function main() {
  console.log('=== PRINTFUL WEBHOOK REGISTRATION ===\n');
  console.log(`Callback URL: ${BASE_URL}`);
  console.log(`Events: ${EVENTS.join(', ')}\n`);

  // Check existing webhooks
  console.log('Checking existing webhooks...');
  try {
    const existing = await listWebhooks();
    const hooks = existing.result?.webhooks || existing.result || [];
    if (hooks.length > 0) {
      console.log(`Found ${hooks.length} existing webhook(s):`);
      for (const h of hooks) {
        console.log(`  - ${h.url} → [${(h.types || []).join(', ')}]`);
      }
      console.log('');
    } else {
      console.log('No existing webhooks found.\n');
    }
  } catch (err) {
    console.warn(`Could not list existing webhooks: ${err.message}\n`);
  }

  // Register
  console.log('Registering webhooks...');
  try {
    const result = await registerWebhooks();
    console.log('SUCCESS! Webhooks registered:');
    console.log(JSON.stringify(result.result, null, 2));
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  }

  console.log('\n=== DONE ===');
  console.log('Verify in Printful Dashboard → Settings → Webhooks');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
