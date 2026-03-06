import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const TOKEN = envFile.match(/PRINTIFY_API_TOKEN=(.*)/)?.[1]

const EU_COUNTRIES = ['DE','ES','FR','IT','NL','PL','AT','BE','PT','IE','DK','SE','FI','CZ','HR','RO','BG','HU','SI','SK','LT','LV','EE','LU','MT','CY','GR'];

async function getProviders(bp) {
  const r = await fetch(`https://api.printify.com/v1/catalog/blueprints/${bp}/print_providers.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  return await r.json();
}

async function getShippingAndVariants(bp, provider) {
  const [sr, vr] = await Promise.all([
    fetch(`https://api.printify.com/v1/catalog/blueprints/${bp}/print_providers/${provider}/shipping.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    }),
    fetch(`https://api.printify.com/v1/catalog/blueprints/${bp}/print_providers/${provider}/variants.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    })
  ]);
  return { shipping: await sr.json(), variants: await vr.json() };
}

function checkEU(shipping) {
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
  return { euCountries, euCost, euAdditional };
}

function getCanvas(variants) {
  if (variants.variants?.length > 0) {
    const ph = variants.variants[0].placeholders || [];
    return ph.map(p => `${p.position}:${p.width}x${p.height}`).join(', ');
  }
  return 'N/A';
}

async function main() {
  const knownEUProviders = [26, 410, 30, 72, 6, 217, 41, 66, 90, 95, 86, 94, 48, 59, 332, 14, 23];
  
  // === STICKERS ===
  console.log('=== STICKER BLUEPRINTS WITH EU SHIPPING ===');
  const stickerBPs = [384, 400, 476, 794, 540, 808, 1087, 1178, 1240, 1359, 1600, 1668, 1680];
  
  for (const bp of stickerBPs) {
    try {
      const providers = await getProviders(bp);
      if (!Array.isArray(providers)) continue;
      
      for (const p of providers) {
        try {
          const { shipping, variants } = await getShippingAndVariants(bp, p.id);
          const { euCountries, euCost } = checkEU(shipping);
          
          if (euCountries.length > 0) {
            const canvas = getCanvas(variants);
            const vc = variants.variants?.length || 0;
            console.log(`  BP${bp}/P${p.id} (${p.title}) | EU-YES (${euCountries.length}) | Ship: $${euCost} | Variants: ${vc} | Canvas: ${canvas}`);
          }
        } catch(e) {}
        await new Promise(r => setTimeout(r, 250));
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  
  // === LONG SLEEVES ===
  console.log('\n=== LONG SLEEVE BLUEPRINTS WITH EU SHIPPING ===');
  const lsBPs = [45, 80, 879, 501, 1192, 1528, 474, 41, 710, 945, 1569, 1654, 1616, 1726, 1994, 2010, 2747];
  
  for (const bp of lsBPs) {
    try {
      const providers = await getProviders(bp);
      if (!Array.isArray(providers)) continue;
      
      for (const p of providers) {
        if (knownEUProviders.includes(p.id)) {
          try {
            const { shipping, variants } = await getShippingAndVariants(bp, p.id);
            const { euCountries, euCost, euAdditional } = checkEU(shipping);
            
            if (euCountries.length > 0) {
              const canvas = getCanvas(variants);
              const vc = variants.variants?.length || 0;
              console.log(`  BP${bp}/P${p.id} (${p.title}) | EU-YES (${euCountries.length}) | Ship: $${euCost} (add: $${euAdditional}) | Variants: ${vc} | Canvas: ${canvas}`);
            }
          } catch(e) {}
          await new Promise(r => setTimeout(r, 250));
        }
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  
  // === ADDITIONAL TEE + HOODIE COMBOS ===
  console.log('\n=== ADDITIONAL TEE/HOODIE OPTIONS ===');
  const extraCombos = [
    // More tee BPs with P26
    { bp: 1683, provider: 26, name: 'Acid Washed Round Neck / Textildruck' },
    { bp: 1607, provider: 26, name: 'Acid Washed Oversize / Textildruck' },
    // P410 tees
    { bp: 6, provider: 410, name: 'Gildan 5000 / Printful' },
    { bp: 12, provider: 410, name: 'Bella+Canvas 3001 / Printful' },
    // P410 hoodies 
    { bp: 793, provider: 410, name: 'Gildan Hoodie Emb / Printful (existing)' },
    // Foam trucker hat (DTF, not embroidery)
    { bp: 1735, provider: 410, name: 'Foam Trucker Hat / Printful' },
  ];
  
  for (const combo of extraCombos) {
    try {
      const { shipping, variants } = await getShippingAndVariants(combo.bp, combo.provider);
      const { euCountries, euCost, euAdditional } = checkEU(shipping);
      const canvas = getCanvas(variants);
      const vc = variants.variants?.length || 0;
      const status = euCountries.length > 0 ? `EU-YES (${euCountries.length})` : 'NO EU';
      console.log(`  BP${combo.bp}/P${combo.provider} (${combo.name}) | ${status} | Ship: $${euCost} (add: $${euAdditional}) | Variants: ${vc} | Canvas: ${canvas}`);
    } catch(e) {
      console.log(`  BP${combo.bp}/P${combo.provider}: ERROR ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

main().catch(console.error);
