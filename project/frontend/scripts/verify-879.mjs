import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const TOKEN = envFile.match(/PRINTIFY_API_TOKEN=(.*)/)?.[1]

async function main() {
  // Check ALL providers for BP879
  const r = await fetch(`https://api.printify.com/v1/catalog/blueprints/879/print_providers.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const providers = await r.json();
  console.log('BP879 providers:', providers.map(p => `P${p.id} ${p.title}`));
  
  // Check shipping for each
  for (const p of providers) {
    const sr = await fetch(`https://api.printify.com/v1/catalog/blueprints/879/print_providers/${p.id}/shipping.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    const shipping = await sr.json();
    const allCountries = shipping.profiles?.flatMap(pr => pr.countries || []) || [];
    const euCountries = allCountries.filter(c => ['DE','ES','FR','IT','NL','PL','AT','BE','PT','IE','DK','SE','FI','CZ','HR'].includes(c));
    console.log(`  P${p.id} (${p.title}): ${allCountries.length} countries total, EU: ${euCountries.join(',')||'NONE'}`);
    
    // Also check for REST_OF_WORLD
    const hasROW = allCountries.includes('REST_OF_WORLD');
    if (hasROW) console.log(`    Has REST_OF_WORLD`);
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Also verify BP794 stickers (plan says P73)
  console.log('\n=== BP794 (Stickers) ===');
  const r2 = await fetch(`https://api.printify.com/v1/catalog/blueprints/794/print_providers.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const p2 = await r2.json();
  console.log('BP794 providers:', p2.map(p => `P${p.id} ${p.title}`));
  
  for (const p of p2) {
    const sr = await fetch(`https://api.printify.com/v1/catalog/blueprints/794/print_providers/${p.id}/shipping.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    const shipping = await sr.json();
    const allCountries = shipping.profiles?.flatMap(pr => pr.countries || []) || [];
    const euCountries = allCountries.filter(c => ['DE','ES','FR','IT','NL','PL','AT','BE','PT','IE','DK','SE','FI','CZ','HR'].includes(c));
    console.log(`  P${p.id} (${p.title}): EU: ${euCountries.join(',')||'NONE'}, ROW: ${allCountries.includes('REST_OF_WORLD')}`);
    await new Promise(r => setTimeout(r, 300));
  }
}

main().catch(console.error);
