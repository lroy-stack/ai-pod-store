/**
 * Query placeholders/print areas for BP/Provider
 */
import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}` }

const [bp, prov] = process.argv.slice(2).map(Number)

async function tryFetch(url, label) {
  try {
    const r = await fetch(url, { headers })
    if (!r.ok) {
      console.log(`${label}: ${r.status}`)
      return null
    }
    const data = await r.json()
    console.log(`${label}: OK`)
    console.log(JSON.stringify(data, null, 2).substring(0, 3000))
    return data
  } catch (e) {
    console.log(`${label}: ERROR - ${e.message}`)
    return null
  }
}

async function main() {
  // Try different endpoint formats
  await tryFetch(
    `${API}/catalog/blueprints/${bp}/print_providers/${prov}/placeholders.json`,
    'placeholders.json'
  )

  await tryFetch(
    `${API}/catalog/blueprints/${bp}/print_providers/${prov}/print_areas.json`,
    'print_areas.json'
  )

  // Blueprint info (has print areas info)
  await tryFetch(
    `${API}/catalog/blueprints/${bp}.json`,
    'blueprint info'
  )
}

main().catch(e => console.error('FATAL:', e.message))
