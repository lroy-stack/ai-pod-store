import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const TOKEN = envFile.match(/PRINTIFY_API_TOKEN=(.*)/)?.[1]

async function getBasePrice(bp, provider) {
  const r = await fetch(`https://api.printify.com/v1/catalog/blueprints/${bp}/print_providers/${provider}/variants.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const data = await r.json();
  if (data.variants?.length > 0) {
    // Find cheapest variant
    const prices = data.variants.map(v => v.cost).filter(c => c > 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { min: (min/100).toFixed(2), max: (max/100).toFixed(2), count: data.variants.length };
  }
  return null;
}

const items = [
  // TEES
  { bp: 6, provider: 26, name: 'Gildan 5000 / Textildruck EU' },
  { bp: 6, provider: 410, name: 'Gildan 5000 / Printful' },
  { bp: 454, provider: 26, name: 'B&C Men Tee / Textildruck EU' },
  { bp: 1462, provider: 26, name: 'Stanley Stella Creator 2.0 / Textildruck EU' },
  { bp: 12, provider: 26, name: 'Bella+Canvas 3001 / Textildruck EU' },
  { bp: 145, provider: 26, name: 'Gildan Softstyle / Textildruck EU' },
  // HOODIES
  { bp: 77, provider: 26, name: 'Gildan 18500 Hoodie / Textildruck EU' },
  { bp: 77, provider: 410, name: 'Gildan 18500 Hoodie / Printful' },
  { bp: 458, provider: 26, name: 'B&C WUI24 Hoodie / Textildruck EU' },
  { bp: 92, provider: 26, name: 'AWDIS JH001 Hoodie / Textildruck EU' },
  // CREWNECK
  { bp: 49, provider: 26, name: 'Gildan 18000 Crewneck / Textildruck EU' },
  { bp: 457, provider: 26, name: 'B&C WUI23 Crewneck / Textildruck EU' },
  // LONG SLEEVE
  { bp: 80, provider: 26, name: 'Gildan 2400 LS / Textildruck EU' },
  { bp: 80, provider: 30, name: 'Gildan 2400 LS / OPT OnDemand' },
  // HEADWEAR
  { bp: 1744, provider: 410, name: 'Structured Cap / Printful' },
  { bp: 1691, provider: 410, name: 'Cuffed Beanie / Printful' },
  { bp: 1743, provider: 410, name: 'Snapback Trucker / Printful' },
  { bp: 1729, provider: 410, name: 'Dad Hat / Printful' },
  // TUMBLERS
  { bp: 1927, provider: 410, name: 'SS Tumbler 20oz / Printful' },
  { bp: 966, provider: 86, name: 'Vagabond 20oz / Chill' },
  // STICKERS
  { bp: 476, provider: 30, name: 'Square Vinyl / OPT OnDemand' },
  { bp: 1216, provider: 255, name: 'Vinyl Kiss-Cut / Sticky Products EU' },
  // BOTTLES
  { bp: 854, provider: 23, name: 'Water Bottle / WOYC' },
];

async function main() {
  console.log('Category | BP/Provider | Name | Base Cost Range | Variants');
  console.log('---|---|---|---|---');
  for (const item of items) {
    const price = await getBasePrice(item.bp, item.provider);
    if (price) {
      console.log(`BP${item.bp}/P${item.provider} | ${item.name} | $${price.min}-$${price.max} | ${price.count}v`);
    } else {
      console.log(`BP${item.bp}/P${item.provider} | ${item.name} | N/A | N/A`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

main().catch(console.error);
