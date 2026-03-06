import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const TOKEN = envFile.match(/PRINTIFY_API_TOKEN=(.*)/)?.[1]

const EU_COUNTRIES = ['DE','ES','FR','IT','NL','PL','AT','BE','PT','IE','DK','SE','FI','CZ','HR','RO','BG','HU','SI','SK','LT','LV','EE','LU','MT','CY','GR'];

async function check(bp, provider, name) {
  try {
    const [sr, vr] = await Promise.all([
      fetch(`https://api.printify.com/v1/catalog/blueprints/${bp}/print_providers/${provider}/shipping.json`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      }),
      fetch(`https://api.printify.com/v1/catalog/blueprints/${bp}/print_providers/${provider}/variants.json`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      })
    ]);
    const shipping = await sr.json();
    const variants = await vr.json();
    
    const euCountries = [];
    let euCost = '?';
    let euAdditional = '?';
    if (shipping.profiles) {
      for (const profile of shipping.profiles) {
        const countries = profile.countries || [];
        const euInProfile = countries.filter(c => EU_COUNTRIES.includes(c));
        if (euInProfile.length > 0) {
          euCountries.push(...euInProfile);
          if (profile.first_item?.cost) euCost = (profile.first_item.cost / 100).toFixed(2);
          if (profile.additional_items?.cost) euAdditional = (profile.additional_items.cost / 100).toFixed(2);
        }
      }
    }
    
    let canvas = 'N/A';
    if (variants.variants?.length > 0) {
      const ph = variants.variants[0].placeholders || [];
      canvas = ph.map(p => `${p.position}:${p.width}x${p.height}`).join(', ');
    }
    const vc = variants.variants?.length || 0;
    const status = euCountries.length > 0 ? `EU-YES (${euCountries.length})` : 'NO EU';
    console.log(`BP${bp}/P${provider} | ${name} | ${status} | Ship: $${euCost} (add: $${euAdditional}) | V:${vc} | Canvas: ${canvas}`);
  } catch(e) {
    console.log(`BP${bp}/P${provider}: ERROR ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 300));
}

async function main() {
  console.log('=== BELLA+CANVAS 3501 (Jersey Long Sleeve) ===');
  await check(41, 72, 'Bella+Canvas 3501 LS / Print Clever');
  await check(41, 30, 'Bella+Canvas 3501 LS / OPT OnDemand');
  await check(41, 26, 'Bella+Canvas 3501 LS / Textildruck EU');
  await check(41, 410, 'Bella+Canvas 3501 LS / Printful');
  
  console.log('\n=== GILDAN 2400 (Ultra Cotton LS) ===');
  await check(80, 26, 'Gildan 2400 LS / Textildruck EU');
  await check(80, 410, 'Gildan 2400 LS / Printful');
  
  console.log('\n=== VINYL KISS-CUT STICKERS (EU provider) ===');
  await check(1216, 255, 'Vinyl Kiss-Cut / Sticky Products Europe');
  
  console.log('\n=== LAMINATE STICKERS (EU) ===');  
  await check(906, 36, 'Laminate Stickers / Print Pigeons');
  
  console.log('\n=== SQUARE VINYL STICKERS ===');
  await check(476, 30, 'Square Vinyl / OPT OnDemand');
  
  console.log('\n=== PRINTFUL DTG TEES (checking print technique) ===');
  // Check what printing technique P26 uses for tees
  const r = await fetch(`https://api.printify.com/v1/catalog/blueprints/6/print_providers/26/variants.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const v = await r.json();
  if (v.variants?.length > 0) {
    const ph = v.variants[0].placeholders || [];
    console.log('BP6/P26 print areas:', ph.map(p => `${p.position}: ${p.width}x${p.height}`).join(', '));
    // Check variant info
    console.log('Sample variant:', JSON.stringify(v.variants[0]).slice(0, 300));
  }
  
  console.log('\n=== CHECKING PRINTFUL (P410) HOODIE ALTERNATIVES ===');
  // Check if P410 has DTG hoodies (not just embroidery)
  await check(77, 410, 'Gildan 18500 Hoodie / Printful');
  await check(77, 26, 'Gildan 18500 Hoodie / Textildruck EU');
  await check(77, 30, 'Gildan 18500 Hoodie / OPT OnDemand');
  
  console.log('\n=== COMPARING HOODIE OPTIONS ===');
  await check(458, 26, 'B&C WUI24 Pullover Hoodie / Textildruck EU');
  await check(517, 30, 'B&C King Hooded / OPT OnDemand');
  await check(92, 26, 'AWDIS JH001 College Hoodie / Textildruck EU');
  await check(92, 72, 'AWDIS JH001 College Hoodie / Print Clever');
  await check(1576, 30, 'Stanley Stella Cruiser Hoodie / OPT OnDemand');
}

main().catch(console.error);
