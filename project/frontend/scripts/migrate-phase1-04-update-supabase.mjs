/**
 * migrate-phase1-04-update-supabase.mjs
 *
 * Phase 1 Step 4: Update Supabase with Printful product data.
 *
 * - Reads phase1-audit.json (product mapping, prices, tiers)
 * - Reads printful-phase1-products.json (sync product IDs, variant IDs)
 * - Updates products: pod_provider, provider_product_id, prices, descriptions (en/es/de), product_details
 * - Creates new product_variants for Printful color/size combinations
 * - Generates phase1-backup.json before any modifications
 *
 * Supports --dry-run and --resume.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-04-update-supabase.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-04-update-supabase.mjs
 *   cd frontend && node scripts/migrate-phase1-04-update-supabase.mjs --resume
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { randomUUID } from 'crypto'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')
const RESUME = process.argv.includes('--resume')

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const SUPABASE_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required in .env.local')
  process.exit(1)
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const AUDIT_PATH = join(ROOT, 'scripts', 'phase1-audit.json')
const PRODUCTS_PATH = join(ROOT, 'scripts', 'printful-phase1-products.json')
const BACKUP_PATH = join(ROOT, 'scripts', 'phase1-backup.json')
const PROGRESS_PATH = join(ROOT, 'scripts', 'phase1-update-progress.json')

// ─── Descriptions per product (en/es/de) ────────────────────────────────────────

// Design-specific creative text for each product, plus tier-specific garment description.
const DESCRIPTIONS = {
  // ── PREMIUM tier (MC1087) ──
  'Soup Fork': {
    en: 'Life is soup. You are fork. The existential crisis of cutlery, captured in cotton. Printed on 7oz combed ringspun cotton with a relaxed boxy silhouette. Garment-dyed for a soft, lived-in feel from day one.',
    es: 'La vida es sopa. Tú eres tenedor. La crisis existencial de los cubiertos, capturada en algodón. Impresa en algodón peinado ring-spun de 7oz con silueta boxy relajada. Teñida en prenda para un tacto suave y natural desde el primer día.',
    de: 'Das Leben ist Suppe. Du bist Gabel. Die existenzielle Krise des Bestecks, eingefangen in Baumwolle. Gedruckt auf 7oz gekämmter Ringspun-Baumwolle mit entspannter Boxy-Silhouette. Garment-dyed für ein weiches, eingetragenes Gefühl vom ersten Tag an.',
  },
  'Existential Dread': {
    en: 'The familiar weight of wondering why you opened this app again. Wearable philosophy for the chronically online. Printed on 7oz combed ringspun cotton with a relaxed boxy silhouette. Garment-dyed for a soft, lived-in feel from day one.',
    es: 'El peso familiar de preguntarte por qué abriste esta app otra vez. Filosofía vestible para los crónicamente conectados. Impresa en algodón peinado ring-spun de 7oz con silueta boxy relajada. Teñida en prenda para un tacto suave y natural desde el primer día.',
    de: 'Das vertraute Gewicht der Frage, warum du diese App schon wieder geöffnet hast. Tragbare Philosophie für chronisch Online-Sein. Gedruckt auf 7oz gekämmter Ringspun-Baumwolle mit entspannter Boxy-Silhouette. Garment-dyed für ein weiches, eingetragenes Gefühl vom ersten Tag an.',
  },
  'Social Battery': {
    en: 'Currently at 2%. Please do not interact. The introvert energy meter everyone needs. Printed on 7oz combed ringspun cotton with a relaxed boxy silhouette. Garment-dyed for a soft, lived-in feel from day one.',
    es: 'Actualmente al 2%. No interactuar, por favor. El medidor de energía introvertida que todos necesitan. Impresa en algodón peinado ring-spun de 7oz con silueta boxy relajada. Teñida en prenda para un tacto suave y natural desde el primer día.',
    de: 'Aktuell bei 2%. Bitte nicht ansprechen. Das Introvertierte-Energie-Messgerät, das jeder braucht. Gedruckt auf 7oz gekämmter Ringspun-Baumwolle mit entspannter Boxy-Silhouette. Garment-dyed für ein weiches, eingetragenes Gefühl vom ersten Tag an.',
  },
  'Plans Cancelled': {
    en: 'The sweet relief of a cancelled plan. Celebrate the art of staying in. Printed on 7oz combed ringspun cotton with a relaxed boxy silhouette. Garment-dyed for a soft, lived-in feel from day one.',
    es: 'El dulce alivio de un plan cancelado. Celebra el arte de quedarse en casa. Impresa en algodón peinado ring-spun de 7oz con silueta boxy relajada. Teñida en prenda para un tacto suave y natural desde el primer día.',
    de: 'Die süße Erleichterung eines abgesagten Plans. Feiere die Kunst des Zuhausebleibens. Gedruckt auf 7oz gekämmter Ringspun-Baumwolle mit entspannter Boxy-Silhouette. Garment-dyed für ein weiches, eingetragenes Gefühl vom ersten Tag an.',
  },
  'Caffeine Anxiety': {
    en: 'Fueled by caffeine, powered by anxiety. The modern developer stack. Printed on 7oz combed ringspun cotton with a relaxed boxy silhouette. Garment-dyed for a soft, lived-in feel from day one.',
    es: 'Alimentado por cafeína, potenciado por ansiedad. El stack del desarrollador moderno. Impresa en algodón peinado ring-spun de 7oz con silueta boxy relajada. Teñida en prenda para un tacto suave y natural desde el primer día.',
    de: 'Angetrieben von Koffein, betrieben von Angst. Der moderne Entwickler-Stack. Gedruckt auf 7oz gekämmter Ringspun-Baumwolle mit entspannter Boxy-Silhouette. Garment-dyed für ein weiches, eingetragenes Gefühl vom ersten Tag an.',
  },
  'Self-Care Mode': {
    en: 'Self-care is aggressive. Boundaries are non-negotiable. The wellness manifesto for realists. Printed on 7oz combed ringspun cotton with a relaxed boxy silhouette. Garment-dyed for a soft, lived-in feel from day one.',
    es: 'El autocuidado es agresivo. Los límites no son negociables. El manifiesto wellness para realistas. Impresa en algodón peinado ring-spun de 7oz con silueta boxy relajada. Teñida en prenda para un tacto suave y natural desde el primer día.',
    de: 'Selbstfürsorge ist aggressiv. Grenzen sind nicht verhandelbar. Das Wellness-Manifest für Realisten. Gedruckt auf 7oz gekämmter Ringspun-Baumwolle mit entspannter Boxy-Silhouette. Garment-dyed für ein weiches, eingetragenes Gefühl vom ersten Tag an.',
  },

  // ── SIGNATURE tier (CC1717) ──
  'Absolutely Right': {
    en: 'When the AI agrees with everything you say. Who needs human validation? Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Cuando la IA está de acuerdo con todo lo que dices. ¿Quién necesita validación humana? Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Wenn die KI allem zustimmt, was du sagst. Wer braucht menschliche Bestätigung? Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Vibe Coder': {
    en: 'Coding by vibes, not by logic. The prompt-first development manifesto. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Programar por vibras, no por lógica. El manifiesto de desarrollo prompt-first. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Programmieren nach Vibes, nicht nach Logik. Das Prompt-First-Entwicklungsmanifest. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Zero Bugs': {
    en: 'Zero bugs in production. Because we never tested it. The honest engineering disclaimer. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Cero bugs en producción. Porque nunca lo probamos. La honesta cláusula de ingeniería. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Null Bugs in Produktion. Weil wir es nie getestet haben. Der ehrliche Ingenieurs-Haftungsausschluss. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Strawberry Count': {
    en: 'How many R\'s in strawberry? The question that humbled AI forever. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Cuántas R hay en strawberry? La pregunta que humilló a la IA para siempre. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Wie viele R\'s in Strawberry? Die Frage, die KI für immer demütigte. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Under Where': {
    en: 'The classic underwear prompt injection. Sometimes the simplest exploits are the funniest. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'La clásica inyección de prompt con ropa interior. A veces los exploits más simples son los más graciosos. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Die klassische Unterwäsche-Prompt-Injection. Manchmal sind die einfachsten Exploits die lustigsten. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Three Models': {
    en: 'Haiku, Sonnet, Opus — the holy trinity of AI. Choose your model wisely. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Haiku, Sonnet, Opus — la santa trinidad de la IA. Elige tu modelo sabiamente. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Haiku, Sonnet, Opus — die heilige Dreifaltigkeit der KI. Wähle dein Modell weise. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Ghost Tee': {
    en: 'Present but invisible. The developer who merges at 2am and disappears. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Presente pero invisible. El desarrollador que mergea a las 2am y desaparece. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Anwesend aber unsichtbar. Der Entwickler, der um 2 Uhr nachts merged und verschwindet. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Shadow Tee': {
    en: 'Working in the shadows. The silent contributor who keeps everything running. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Trabajando en las sombras. El contribuidor silencioso que mantiene todo funcionando. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Im Schatten arbeiten. Der stille Beitragende, der alles am Laufen hält. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Prism Tee': {
    en: 'Every button has a different shade of blue. The frontend developer paradox. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Cada botón tiene un tono diferente de azul. La paradoja del desarrollador frontend. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Jeder Button hat einen anderen Blauton. Das Frontend-Entwickler-Paradoxon. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Scope Creep': {
    en: 'It started as a button. Now it has its own API. Classic scope creep, captured in cotton. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Empezó como un botón. Ahora tiene su propia API. El clásico scope creep, capturado en algodón. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Es begann als Button. Jetzt hat es seine eigene API. Klassischer Scope Creep, eingefangen in Baumwolle. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Dangerous Flag': {
    en: 'This flag is considered dangerous. Proceed with caution and good intentions. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Este flag se considera peligroso. Proceder con precaución y buenas intenciones. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Dieses Flag gilt als gefährlich. Mit Vorsicht und guten Absichten fortfahren. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Option Two': {
    en: 'There were three options. You chose the second one. Nobody knows why. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Había tres opciones. Elegiste la segunda. Nadie sabe por qué. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Es gab drei Optionen. Du hast die zweite gewählt. Niemand weiß warum. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Next Line': {
    en: 'The cursor blinks. The next line could change everything. Or just print hello world. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'El cursor parpadea. La siguiente línea podría cambiarlo todo. O solo imprimir hola mundo. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Der Cursor blinkt. Die nächste Zeile könnte alles ändern. Oder einfach Hallo Welt ausgeben. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
  'Just For You': {
    en: 'Made just for you. Actually, made on demand. Because you deserve something that didn\'t exist until you wanted it. Heavyweight 6.1oz garment-dyed cotton. Pre-shrunk with a relaxed, comfortable fit that gets better with every wash.',
    es: 'Hecho solo para ti. En realidad, hecho bajo demanda. Porque mereces algo que no existía hasta que lo quisiste. Algodón heavyweight de 6.1oz teñido en prenda. Pre-encogida con un fit relajado y cómodo que mejora con cada lavado.',
    de: 'Nur für dich gemacht. Eigentlich on demand produziert. Weil du etwas verdienst, das es nicht gab, bis du es wolltest. Schweres 6.1oz garment-dyed Baumwoll-T-Shirt. Vorgewaschen mit entspannter, bequemer Passform, die mit jeder Wäsche besser wird.',
  },
}

// ─── Product Details Templates ──────────────────────────────────────────────────

const PRODUCT_DETAILS = {
  premium: {
    brand: 'SKAPARA',
    model: 'Cotton Heritage MC1087',
    material: '100% combed ringspun cotton, 7oz (237gsm)',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'LV',
    care_instructions: 'Machine wash cold inside out. Tumble dry low. Do not bleach. Do not iron on print.',
    provider_name: 'Printful',
  },
  signature: {
    brand: 'SKAPARA',
    model: 'Comfort Colors 1717',
    material: '100% ring-spun cotton, 6.1oz (207gsm), garment-dyed',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'LV',
    care_instructions: 'Machine wash cold inside out. Tumble dry low. Do not bleach. Do not iron on print.',
    provider_name: 'Printful',
  },
}

// GPSR safety information (Printful EU)
const GPSR_SAFETY = `<div class="gpsr-info"><h4>EU Product Safety (GPSR 2023/988)</h4><p><strong>Manufacturer:</strong> SIA Printful Latvia, Gandiju iela 88, Marupe, LV-2167, Latvia</p><p><strong>EU Responsible Person:</strong> SIA Printful Latvia</p><p><strong>Contact:</strong> compliance@printful.com</p><p>This product complies with EU Regulation 2023/988 (General Product Safety Regulation). DTG water-based eco-friendly inks. OEKO-TEX Standard 100 certified fabric.</p></div>`

// Printful catalog IDs
const CATALOG_IDS = {
  premium: 917,   // Cotton Heritage MC1087
  signature: 586, // Comfort Colors 1717
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Printful Fetch (for catalog variant lookup) ────────────────────────────────

const PRINTFUL_TOKEN = env('PRINTFUL_API_TOKEN')
const PRINTFUL_STORE = env('PRINTFUL_STORE_ID')

async function printfulFetch(path) {
  if (!PRINTFUL_TOKEN) return null
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': PRINTFUL_STORE,
      'User-Agent': 'SKAPARA-POD/1.0',
    },
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.result !== undefined ? json.result : json
}

// ─── Supabase Fetch ─────────────────────────────────────────────────────────────

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`)
  }

  const text = await res.text()
  if (!text) return null
  return JSON.parse(text)
}

async function supabaseUpdate(table, id, data) {
  return supabaseFetch(`/${table}?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    prefer: 'return=minimal',
  })
}

async function supabaseInsert(table, data) {
  return supabaseFetch(`/${table}`, {
    method: 'POST',
    body: JSON.stringify(data),
    prefer: 'return=representation',
  })
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 4: Update Supabase                    ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no database changes ***')
  console.log()

  // Load inputs
  if (!existsSync(AUDIT_PATH)) {
    console.error('ERROR: phase1-audit.json not found. Run step 0 first.')
    process.exit(1)
  }
  if (!existsSync(PRODUCTS_PATH)) {
    console.error('ERROR: printful-phase1-products.json not found. Run step 3 first.')
    process.exit(1)
  }

  const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8'))
  const printfulProducts = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))
  console.log(`  Loaded: ${audit.totalProducts} products, ${Object.keys(printfulProducts).length} Printful results`)

  // Load progress (for resume)
  let progress = {}
  if (RESUME && existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(readFileSync(PROGRESS_PATH, 'utf8'))
    console.log(`  Resuming: ${Object.keys(progress).length} products already updated`)
  }

  // ── Step 1: Create backup ──
  if (!existsSync(BACKUP_PATH) || !RESUME) {
    console.log()
    console.log('→ Creating backup of current product data...')
    const backup = []

    for (const product of audit.products) {
      const rows = await supabaseFetch(
        `/products?id=eq.${product.id}&select=*,product_variants(*)`
      )
      if (rows?.[0]) backup.push(rows[0])
    }

    writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2))
    console.log(`  ✓ Backup saved: ${backup.length} products → ${BACKUP_PATH}`)
  } else {
    console.log('  ⊘ Backup already exists, skipping')
  }

  // ── Step 1b: Fetch Printful catalog variants for color/size mapping ──
  console.log()
  console.log('→ Fetching Printful catalog variants for color/size mapping...')
  const catalogVariantMap = new Map() // variantId → { color, size }

  for (const catId of Object.values(CATALOG_IDS)) {
    await delay(1500)
    const product = await printfulFetch(`/products/${catId}`)
    if (product?.variants) {
      for (const v of product.variants) {
        catalogVariantMap.set(v.id, { color: v.color, size: v.size })
      }
      console.log(`  Catalog ${catId}: ${product.variants.length} variants mapped`)
    }
  }

  // ── Step 2: Update each product ──
  console.log()
  console.log('→ Updating products...')

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < audit.products.length; i++) {
    const product = audit.products[i]
    const pfResult = printfulProducts[product.id]
    const prog = `[${i + 1}/${audit.products.length}]`

    // Skip if already processed (resume)
    if (progress[product.id]?.status === 'ok') {
      console.log(`${prog} ⊘ ${product.title}: already updated`)
      skipped++
      continue
    }

    // Skip if Printful creation failed
    if (!pfResult || pfResult.status !== 'ok') {
      console.log(`${prog} ✗ ${product.title}: Printful product not created — skipping`)
      progress[product.id] = { status: 'skipped', reason: 'no Printful product' }
      failed++
      continue
    }

    const tier = product.tier
    const descriptions = DESCRIPTIONS[product.title]
    const productDetails = {
      ...PRODUCT_DETAILS[tier],
      safety_information: GPSR_SAFETY,
    }

    // Build product update
    const productUpdate = {
      pod_provider: 'printful',
      provider_product_id: String(pfResult.syncProductId),
      product_template_id: String(product.printful_catalog_id),
      provider_facility_id: null,
      base_price_cents: product.new_price_eur_cents['S'],
      cost_cents: tier === 'premium' ? 2510 : 1840, // EUR cents estimated
      product_details: productDetails,
    }

    if (descriptions) {
      productUpdate.description = descriptions.en
      productUpdate.translations = {
        es: { title: product.title, description: descriptions.es },
        de: { title: product.title, description: descriptions.de },
      }
    }

    console.log(`${prog} ${product.title} (${tier.toUpperCase()})`)

    if (DRY_RUN) {
      console.log(`  → Would update: pod_provider=printful, price=${productUpdate.base_price_cents}c, model=${PRODUCT_DETAILS[tier].model}`)
      console.log(`  → Would create ${pfResult.variantsCreated} new variants`)
      progress[product.id] = { status: 'dry_run' }
      continue
    }

    try {
      // Update product
      await supabaseUpdate('products', product.id, productUpdate)
      console.log(`  ✓ Product updated`)

      // Disable old variants
      const oldVariants = await supabaseFetch(
        `/product_variants?product_id=eq.${product.id}&select=id`
      )
      if (oldVariants?.length > 0) {
        for (const ov of oldVariants) {
          await supabaseUpdate('product_variants', ov.id, { is_enabled: false })
        }
        console.log(`  ✓ Disabled ${oldVariants.length} old variants`)
      }

      // Create new variants from Printful sync variants
      let variantsCreated = 0
      if (pfResult.syncVariants) {
        for (const sv of pfResult.syncVariants) {
          // Look up color/size from catalog variant
          const catVariant = catalogVariantMap.get(sv.variantId)
          const color = catVariant?.color || 'Unknown'
          const size = catVariant?.size || 'M'

          // Use EUR pricing from audit data, keyed by size
          const eurPriceCents = product.new_price_eur_cents[size] || product.new_price_eur_cents['S']
          const baseCostCents = tier === 'premium' ? 2510 : 1840
          // Adjust cost for larger sizes
          const costOversize = ['2XL', '3XL', '4XL', '5XL'].includes(size) ? 200 : 0
          const costCents = baseCostCents + costOversize

          const newVariant = {
            id: randomUUID(),
            product_id: product.id,
            external_variant_id: String(sv.syncVariantId),
            printify_variant_id: null,
            sku: `SKP-${slugify(product.title).toUpperCase().slice(0, 8)}-${color.replace(/\s+/g, '').slice(0, 4).toUpperCase()}-${size}`,
            title: `${color} / ${size}`,
            color,
            size,
            price_cents: eurPriceCents,
            cost_cents: costCents,
            is_enabled: true,
            is_available: true,
          }

          try {
            await supabaseInsert('product_variants', newVariant)
            variantsCreated++
          } catch (err) {
            console.log(`  ⚠ Variant insert failed: ${err.message}`)
          }
        }
        console.log(`  ✓ Created ${variantsCreated} new variants`)
      }

      progress[product.id] = {
        status: 'ok',
        syncProductId: pfResult.syncProductId,
        variantsDisabled: oldVariants?.length || 0,
        variantsCreated,
        updatedAt: new Date().toISOString(),
      }
      updated++

      // Save progress
      writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))
    } catch (err) {
      console.log(`  ✗ Failed: ${err.message}`)
      progress[product.id] = { status: 'failed', error: err.message }
      failed++
      writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))
    }
  }

  // Save final progress
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))

  // Summary
  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  UPDATE SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Updated:  ${updated}`)
  console.log(`  Skipped:  ${skipped}`)
  console.log(`  Failed:   ${failed}`)
  console.log(`  Backup:   ${BACKUP_PATH}`)
  console.log(`  Progress: ${PROGRESS_PATH}`)
  console.log()

  if (failed > 0) {
    console.log('  ⚠ Some updates failed. Re-run with --resume to retry.')
  } else if (!DRY_RUN) {
    console.log('  Next step: node scripts/migrate-phase1-05-archive-printify.mjs')
  }
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
