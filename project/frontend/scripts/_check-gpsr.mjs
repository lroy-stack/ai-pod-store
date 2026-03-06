import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')

const IDS = {
  'Bug Reporter':    '69a38b2546730b56700a4018',
  'Sudo Ice Cream':  '69a38b5d1ec5ca402c0352e0',
  'Bedtime 404':     '69a38b853b12a90c8e089201',
  'Ctrl+Z Homework': '69a38bac5a653e214b0be2f4',
  'AI Raised Me':    '69a38bda3b12a90c8e08920c',
  'Code Works':      '69a38c03874d66e74c0ea105',
}

for (const [name, pid] of Object.entries(IDS)) {
  const r = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products/${pid}/gpsr.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  const g = await r.json()
  console.log(`${name}: status=${r.status}`)
  console.log(`  manufacturer: ${JSON.stringify(g.manufacturer)?.slice(0,100)}`)
  console.log(`  responsible_person: ${JSON.stringify(g.responsible_person)?.slice(0,100)}`)
  console.log(`  safety_information: ${g.safety_information?.slice(0,80) || 'NONE'}`)
  console.log()
}
