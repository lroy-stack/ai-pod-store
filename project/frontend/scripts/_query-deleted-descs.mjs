/**
 * Query deleted product descriptions from Supabase for recreating products.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

async function main() {
  const titles = [
    'Ghost Tee', 'Shadow Tee', 'Prism Tee', 'GPU',
    'Absolutely Right', 'Vibe Coder', 'Zero Bugs',
    'Prompt Life', 'Career.js', 'Hard Reset',
    'Refactor Anyway', 'Full Credit', '404: Dev',
  ]

  const { data, error } = await sb.from('products')
    .select('title, description, translations, tags, base_price_cents, blueprint_id, print_provider_id')
    .eq('status', 'deleted')
    .order('title')

  if (error) { console.error('Error:', error.message); return }

  for (const t of titles) {
    const match = data.find(p => p.title?.includes(t))
    if (match) {
      console.log(`\n=== ${match.title} ===`)
      console.log(`  Price: €${(match.base_price_cents/100).toFixed(2)}`)
      console.log(`  BP${match.blueprint_id}/P${match.print_provider_id}`)
      console.log(`  Tags: ${(match.tags || []).join(', ')}`)
      console.log(`  Desc EN: ${(match.description || '').substring(0, 200)}`)
      if (match.translations?.es) {
        console.log(`  Desc ES: ${(match.translations.es.description || '').substring(0, 200)}`)
      }
      if (match.translations?.de) {
        console.log(`  Desc DE: ${(match.translations.de.description || '').substring(0, 200)}`)
      }
    } else {
      console.log(`\n=== ${t} === NOT FOUND`)
    }
  }
}

main().catch(e => console.error('FATAL:', e.message))
