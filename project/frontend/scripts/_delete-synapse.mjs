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

const PRINTIFY_ID = '69a225597ab6ca00740891b4'
const DB_ID = '48051acc-95be-498f-8ae0-ec1b018efdd5'

console.log('Deleting Synapse v1...')
const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${PRINTIFY_ID}.json`, { method: 'DELETE', headers })
console.log(`  Printify: ${r.status}`)

const { error: e1 } = await supabase.from('product_variants').delete().eq('product_id', DB_ID)
console.log(`  Variants: ${e1 ? e1.message : 'deleted'}`)
const { error: e2 } = await supabase.from('products').delete().eq('id', DB_ID)
console.log(`  Product: ${e2 ? e2.message : 'deleted'}`)
console.log('Done.')
