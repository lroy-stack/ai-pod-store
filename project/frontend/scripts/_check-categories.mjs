import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const { data } = await sb.from('categories').select('id, slug, name, parent_id, is_active').eq('is_active', true).order('slug')
for (const c of data || []) {
  console.log(`${c.slug.padEnd(30)} id:${c.id} parent:${c.parent_id || '-'} ${c.name}`)
}
