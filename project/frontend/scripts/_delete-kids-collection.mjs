import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const supabase = createClient(SB_URL, SB_KEY)
const headers = { 'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'POD-AI-Store/1.0' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

// 8 kids products — Prompt Engineer BP1534 is kids clogs, NOT BP1018 (that's the mug)
const toDelete = [
  { name: 'Compiling Tears',  printifyId: '69a373023b12a90c8e088d32', supabaseId: 'c77cf871-9440-416e-9aa5-a351b1ba347f' },
  { name: 'Bug Reporter',     printifyId: '69a373137ab6ca007408e495', supabaseId: '96f31cb4-5152-4132-b0e2-6469d5bf8274' },
  { name: 'Sudo Ice Cream',   printifyId: '69a37328339f8a44c50ddf2d', supabaseId: '486942f9-8e81-4a88-9f65-98c04d64deff' },
  { name: 'Bedtime 404',      printifyId: '69a3733a3f0e39248902aba2', supabaseId: '004cbcd4-1341-4dbc-9766-fd86605e7988' },
  { name: 'Ctrl+Z Homework',  printifyId: '69a3734d17323cea060b2d45', supabaseId: '9beae959-b9a7-4e31-8bc9-669e007e6603' },
  { name: 'AI Raised Me',     printifyId: '69a3736aeb470f86b105cb04', supabaseId: 'e5a541cb-0623-4656-8aa7-baf8ccc52cd0' },
  { name: 'Code Works',       printifyId: '69a3737ff4bd86b0d2086f07', supabaseId: '439bda6b-8d0a-4c51-9806-a4d9e4beb2e7' },
  { name: 'Prompt Engineer',  printifyId: '69a373947ab6ca007408e4b6', supabaseId: '2eab7fd8-6253-478e-842b-1426b546948d' },
]

console.log(`Deleting ${toDelete.length} kids products...\n`)

for (const p of toDelete) {
  // Delete from Printify
  const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${p.printifyId}.json`, { method: 'DELETE', headers })
  console.log(`${p.name} Printify: ${r.status}`)

  // Delete variants from Supabase
  await supabase.from('product_variants').delete().eq('product_id', p.supabaseId)

  // Delete product from Supabase
  const { error } = await supabase.from('products').delete().eq('id', p.supabaseId)
  console.log(`${p.name} Supabase: ${error ? error.message : 'deleted'}`)

  await delay(2000)
}

console.log('\nDone — all 8 kids products deleted')
