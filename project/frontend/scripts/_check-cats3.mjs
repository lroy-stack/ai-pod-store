import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const { data, error } = await sb.from('categories').select('*').order('slug')
if (error) { console.error(error); process.exit(1) }
if (data.length > 0) console.log('Columns:', Object.keys(data[0]).join(', '))
for (const c of data || []) {
  const active = c.is_active ? '' : ' [INACTIVE]'
  const label = c.title_en || c.title || c.slug
  console.log(`${c.slug.padEnd(30)} id:${String(c.id).padEnd(6)} parent:${String(c.parent_id || '-').padEnd(6)} ${label}${active}`)
}
