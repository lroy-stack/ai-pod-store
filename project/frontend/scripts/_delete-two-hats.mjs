import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync('/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/.env.local', 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const supabase = createClient(SB_URL, SB_KEY)
const headers = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const toDelete = [
  { name: 'Prompt Me (Cap)', printifyId: '69a22fc40a8a4d5b290e0300', supabaseId: '19e53f3d-b840-453b-aec2-a6ebae8a61c5' },
  { name: 'NPC (Bucket)', printifyId: '69a22fdb7fc2996b8d0a4020', supabaseId: '17e091db-2a12-4898-a8d0-3a481e60777f' },
]

for (const p of toDelete) {
  // Delete from Printify
  const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${p.printifyId}.json`, {
    method: 'DELETE', headers
  })
  console.log(`${p.name} Printify: ${r.status}`)
  
  // Delete variants then product from Supabase
  await supabase.from('product_variants').delete().eq('product_id', p.supabaseId)
  const { error } = await supabase.from('products').delete().eq('id', p.supabaseId)
  console.log(`${p.name} Supabase: ${error ? error.message : 'deleted'}`)
  
  await delay(2000)
}
console.log('\nDone — Vibe Coded beanie kept')
