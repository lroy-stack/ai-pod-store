import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

// Get a sample product to see all column names
const { data } = await sb.from('products').select('*').limit(1)
if (data?.length) {
  console.log('Product columns:', Object.keys(data[0]).join(', '))
  // Check which category fields exist
  console.log('category:', data[0].category)
  console.log('category_id:', data[0].category_id)
}

// Check product_translations columns
const { data: tr } = await sb.from('product_translations').select('*').limit(1)
if (tr?.length) {
  console.log('\nTranslation columns:', Object.keys(tr[0]).join(', '))
} else {
  console.log('\nNo translations found, checking schema...')
  // Try insert with bad data to see error
  const { error } = await sb.from('product_translations').select('locale').limit(0)
  console.log('Translation table exists:', !error)
  if (error) console.log('Error:', error.message)
}

// Check how existing products store category
const { data: cats } = await sb.from('products').select('title, category, category_id').not('category', 'is', null).limit(3)
console.log('\nSample products with category:')
for (const c of cats || []) {
  console.log(`  "${c.title}" → category="${c.category}" category_id="${c.category_id}"`)
}
