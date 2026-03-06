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

// Step 1: Delete Vibe Coded beanie
console.log('=== DELETING Vibe Coded (beanie) ===')
const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/69a22fa7efc94038120f22e3.json`, {
  method: 'DELETE', headers
})
console.log(`  Printify: ${r.status}`)
await supabase.from('product_variants').delete().eq('product_id', 'f19c755f-b936-4f97-bf38-799101400035')
const { error } = await supabase.from('products').delete().eq('id', 'f19c755f-b936-4f97-bf38-799101400035')
console.log(`  Supabase: ${error ? error.message : 'deleted'}`)

console.log('\nVibe Coded borrado. Ahora re-creando Prompt Me y NPC...\n')
