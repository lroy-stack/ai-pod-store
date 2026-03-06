import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const supabase = createClient(SB_URL, SB_KEY)
const headers = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const toDelete = [
  { name: 'Vibe Coded v3', printifyId: '69a233877ab6ca00740895ac', supabaseId: '72c48476-3bfb-4bc2-8e86-ed1648960fb8' },
  { name: 'Prompt Me v3', printifyId: '69a2339d1ec5ca402c02ff2b', supabaseId: '4a86c43f-5fc7-4c6f-80b0-606142b84169' },
]

for (const p of toDelete) {
  const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${p.printifyId}.json`, { method: 'DELETE', headers })
  console.log(`${p.name} Printify: ${r.status}`)
  await supabase.from('product_variants').delete().eq('product_id', p.supabaseId)
  const { error } = await supabase.from('products').delete().eq('id', p.supabaseId)
  console.log(`${p.name} Supabase: ${error ? error.message : 'deleted'}`)
  await delay(2000)
}
console.log('Done — NPC v3 kept')
