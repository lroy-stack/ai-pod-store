import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN'), SHOP_ID = env('PRINTIFY_SHOP_ID')
const supabase = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))
const headers = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const toDelete = [
  { name: 'Dark Mode', pid: '69a237d40a8a4d5b290e0530', sid: '45ef6325-fbb7-4eb0-9a1c-cc2dcfd13e2c' },
  { name: 'It Works', pid: '69a237ec3b12a90c8e084034', sid: '5b00221f-8c40-4965-971d-7400ab060ec5' },
  { name: 'AI Wrote This', pid: '69a238020a8a4d5b290e0536', sid: 'c7f645f4-3692-4818-9f13-66e728f40fa6' },
  { name: 'Friday Deploy', pid: '69a23819414758b6c602a2c4', sid: '023f3f98-9352-4e3f-aa26-c8335fdb8a5b' },
]
for (const p of toDelete) {
  const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${p.pid}.json`, { method: 'DELETE', headers })
  await supabase.from('product_variants').delete().eq('product_id', p.sid)
  await supabase.from('products').delete().eq('id', p.sid)
  console.log(`${p.name}: ${r.status}`)
  await delay(1500)
}
console.log('Done — GPT + GPU buckets kept')
