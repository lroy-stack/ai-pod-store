import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const TOKEN = envFile.match(/PRINTIFY_API_TOKEN=(.*)/)?.[1]

async function main() {
  const r = await fetch(`https://api.printify.com/v1/catalog/blueprints/6/print_providers/26/variants.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const data = await r.json();
  if (data.variants?.length > 0) {
    console.log('Full first variant:');
    console.log(JSON.stringify(data.variants[0], null, 2));
    console.log('\nAll keys:', Object.keys(data.variants[0]));
  }
}

main().catch(console.error);
