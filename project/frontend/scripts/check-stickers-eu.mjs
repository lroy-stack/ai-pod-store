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

const stickerBPs = [384, 400, 476, 564, 598, 600, 661, 794, 802, 803, 806, 811, 818, 875, 876, 906, 1216, 1386, 1387, 1492];

async function main() {
  console.log('=== ALL STICKER BPs - EU SHIPPING CHECK ===\n');
  
  for (const bp of stickerBPs) {
    try {
      const providers = await getProviders(bp);
      if (!Array.isArray(providers)) continue;
      
      let foundEU = false;
      for (const p of providers) {
        try {
          const { shipping, variants } = await getShippingAndVariants(bp, p.id);
          const euCountries = [];
          let euCost = '?';
          
          if (shipping.profiles) {
            for (const profile of shipping.profiles) {
              const countries = profile.countries || [];
              const euInProfile = countries.filter(c => EU_COUNTRIES.includes(c));
              if (euInProfile.length > 0) {
                euCountries.push(...euInProfile);
                if (profile.first_item?.cost) euCost = (profile.first_item.cost / 100).toFixed(2);
              }
            }
          }
          
          if (euCountries.length > 0) {
            foundEU = true;
            let canvas = 'N/A';
            if (variants.variants?.length > 0) {
              const ph = variants.variants[0].placeholders || [];
              canvas = ph.map(p => `${p.position}:${p.width}x${p.height}`).join(', ');
            }
            const vc = variants.variants?.length || 0;
            console.log(`  BP${bp}/P${p.id} (${p.title}) | EU (${euCountries.length}) | Ship: $${euCost} | V:${vc} | Canvas: ${canvas}`);
          }
        } catch(e) {}
        await new Promise(r => setTimeout(r, 200));
      }
      if (!foundEU) {
        console.log(`  BP${bp}: NO EU providers found (${providers.length} providers checked)`);
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 100));
  }
}

main().catch(console.error);
