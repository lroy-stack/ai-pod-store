import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const { data } = await sb.from('products').select('id, title, images, status')
  .not('status', 'eq', 'deleted').order('title')

let strImgs = 0, objImgs = 0, noImgs = 0
for (const p of data) {
  if (!Array.isArray(p.images) || p.images.length === 0) { noImgs++; continue }
  const first = p.images[0]
  if (typeof first === 'string') {
    strImgs++
    console.log(`STRING: ${p.title} (${p.images.length} imgs) → ${first.substring(0, 100)}`)
  } else if (first && first.src) {
    objImgs++
  } else {
    console.log(`UNKNOWN: ${p.title} → ${JSON.stringify(first).substring(0, 100)}`)
  }
}
console.log(`\nObject: ${objImgs} | String: ${strImgs} | No images: ${noImgs}`)
