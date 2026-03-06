/**
 * migrate-phase1-02-upload-designs.mjs
 *
 * Phase 1 Step 2: Upload rendered designs to Printful File Library.
 *
 * Strategy: Printful /files API only accepts public URLs (not base64).
 * So we first upload each PNG to Supabase Storage (public bucket "designs"),
 * then pass the public URL to Printful.
 *
 * - Reads phase1-audit.json for product list
 * - Reads rendered PNGs from public/printful-designs/
 * - Uploads each to Supabase Storage → gets public URL
 * - Creates Printful file via POST /files { url, filename }
 * - Polls file status until "ok"
 * - Outputs: scripts/printful-phase1-file-map.json
 *
 * Supports --resume (skips already-uploaded files) and --dry-run.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-02-upload-designs.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-02-upload-designs.mjs
 *   cd frontend && node scripts/migrate-phase1-02-upload-designs.mjs --resume
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')
const RESUME = process.argv.includes('--resume')

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const PRINTFUL_TOKEN = env('PRINTFUL_API_TOKEN')
const PRINTFUL_STORE = env('PRINTFUL_STORE_ID')
const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')

if (!PRINTFUL_TOKEN || !PRINTFUL_STORE) {
  console.error('ERROR: PRINTFUL_API_TOKEN and PRINTFUL_STORE_ID required in .env.local')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY required in .env.local')
  process.exit(1)
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DELAY_MS = 2000
const MAX_RETRIES = 3
const POLL_INTERVAL_MS = 5000
const MAX_POLL_ATTEMPTS = 60 // 5 min max per file

const AUDIT_PATH = join(ROOT, 'scripts', 'phase1-audit.json')
const DESIGNS_DIR = join(ROOT, 'public', 'printful-designs')
const OUTPUT_PATH = join(ROOT, 'scripts', 'printful-phase1-file-map.json')

const STORAGE_BUCKET = 'designs'
const STORAGE_FOLDER = 'printful-migration'

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ─── Supabase Storage ────────────────────────────────────────────────────────────

async function uploadToSupabaseStorage(filePath, storagePath) {
  const fileBuffer = readFileSync(filePath)
  const url = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      'Content-Type': 'image/png',
    },
    body: fileBuffer,
  })

  if (!res.ok) {
    // Try upsert if file already exists
    if (res.status === 409) {
      const upsertRes = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
          'Content-Type': 'image/png',
        },
        body: fileBuffer,
      })
      if (!upsertRes.ok) {
        const body = await upsertRes.text().catch(() => '')
        throw new Error(`Supabase Storage upsert ${upsertRes.status}: ${body.slice(0, 200)}`)
      }
    } else {
      const body = await res.text().catch(() => '')
      throw new Error(`Supabase Storage ${res.status}: ${body.slice(0, 200)}`)
    }
  }

  // Return public URL
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`
}

// ─── Printful Fetch ─────────────────────────────────────────────────────────────

async function printfulFetch(path, options = {}, retries = MAX_RETRIES) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': PRINTFUL_STORE,
      'User-Agent': 'SKAPARA-POD/1.0',
      ...options.headers,
    },
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
    console.log(`    Rate limited, waiting ${retryAfter}s...`)
    await delay(retryAfter * 1000)
    if (retries > 0) return printfulFetch(path, options, retries - 1)
    throw new Error(`Rate limited on ${path} after ${MAX_RETRIES} retries`)
  }

  if (res.status >= 500 && retries > 0) {
    const backoff = (MAX_RETRIES - retries + 1) * 2000
    console.log(`    Server error ${res.status}, retrying in ${backoff / 1000}s...`)
    await delay(backoff)
    return printfulFetch(path, options, retries - 1)
  }

  const json = await res.json()

  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(
      `Printful ${res.status}: ${json.error?.message || json.message || JSON.stringify(json).slice(0, 500)}`
    )
  }

  return json.result !== undefined ? json.result : json
}

// ─── Upload File (Supabase Storage → Printful URL) ──────────────────────────────

async function uploadFile(filePath, fileName, storageKey) {
  // Step 1: Upload to Supabase Storage
  const storagePath = `${STORAGE_FOLDER}/${storageKey}.png`
  const publicUrl = await uploadToSupabaseStorage(filePath, storagePath)
  console.log(`    → Supabase Storage: ${storagePath}`)

  // Step 2: Create Printful file via public URL
  const result = await printfulFetch('/files', {
    method: 'POST',
    body: JSON.stringify({
      url: publicUrl,
      filename: fileName,
    }),
  })

  return result
}

async function pollFileStatus(fileId) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await delay(POLL_INTERVAL_MS)

    try {
      const file = await printfulFetch(`/files/${fileId}`)
      if (file.status === 'ok') return file
      if (file.status === 'failed') throw new Error(`File ${fileId} processing failed`)
      // status is 'waiting' or 'processing' — keep polling
    } catch (err) {
      if (attempt === MAX_POLL_ATTEMPTS - 1) throw err
    }
  }

  throw new Error(`File ${fileId} timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`)
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 2: Upload Designs to Printful         ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no files will be uploaded ***')
  console.log('  Strategy: Local PNG → Supabase Storage → Printful URL')
  console.log()

  // Load audit
  if (!existsSync(AUDIT_PATH)) {
    console.error('ERROR: phase1-audit.json not found. Run step 0 first.')
    process.exit(1)
  }
  const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8'))

  // Load existing file map (for resume)
  let fileMap = {}
  if (RESUME && existsSync(OUTPUT_PATH)) {
    fileMap = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
    console.log(`  Resuming: ${Object.keys(fileMap).length} files already uploaded`)
  }

  // Build list of files to upload
  const filesToUpload = []

  // Front designs
  for (const product of audit.products) {
    const slug = slugify(product.title)
    const key = `front-${slug}`
    const path = join(DESIGNS_DIR, `${key}.png`)

    if (fileMap[key]) {
      console.log(`  -> ${key}: already uploaded (ID: ${fileMap[key].id})`)
      continue
    }

    if (!existsSync(path)) {
      console.log(`  X ${key}: file not found — run step 1 first`)
      continue
    }

    filesToUpload.push({ key, path, fileName: `skapara-${key}.png`, type: 'front' })
  }

  // Shared assets: label_outside
  const labelKey = 'label-outside-smark-white'
  const labelPath = join(DESIGNS_DIR, `${labelKey}.png`)
  if (!fileMap[labelKey] && existsSync(labelPath)) {
    filesToUpload.push({ key: labelKey, path: labelPath, fileName: 'skapara-label-outside.png', type: 'label' })
  }

  // Shared assets: back branding
  const backKey = 'back-wordmark-white'
  const backPath = join(DESIGNS_DIR, `${backKey}.png`)
  if (!fileMap[backKey] && existsSync(backPath)) {
    filesToUpload.push({ key: backKey, path: backPath, fileName: 'skapara-back-wordmark.png', type: 'back' })
  }

  console.log()
  console.log(`  Files to upload: ${filesToUpload.length}`)
  console.log()

  if (DRY_RUN) {
    console.log('  DRY RUN — would upload:')
    for (const f of filesToUpload) {
      console.log(`    ${f.key} → ${f.fileName}`)
    }
    return
  }

  // Upload files
  let uploaded = 0
  let failed = 0

  for (let i = 0; i < filesToUpload.length; i++) {
    const file = filesToUpload[i]
    const progress = `[${i + 1}/${filesToUpload.length}]`

    try {
      console.log(`${progress} Uploading ${file.key}...`)
      const result = await uploadFile(file.path, file.fileName, file.key)

      if (result.status !== 'ok') {
        console.log(`    -> Printful file ${result.id} processing... polling`)
        const completed = await pollFileStatus(result.id)
        fileMap[file.key] = {
          id: completed.id,
          url: completed.preview_url || completed.url,
          status: completed.status,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        }
      } else {
        fileMap[file.key] = {
          id: result.id,
          url: result.preview_url || result.url,
          status: result.status,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        }
      }

      uploaded++
      console.log(`  OK ${file.key}: ID=${fileMap[file.key].id}`)

      // Save progress after each upload (crash recovery)
      writeFileSync(OUTPUT_PATH, JSON.stringify(fileMap, null, 2))

      // Rate limit delay
      if (i < filesToUpload.length - 1) {
        await delay(DELAY_MS)
      }
    } catch (err) {
      console.log(`  FAIL ${file.key}: ${err.message}`)
      failed++
    }
  }

  // Final save
  writeFileSync(OUTPUT_PATH, JSON.stringify(fileMap, null, 2))

  // Summary
  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  UPLOAD SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Uploaded:  ${uploaded}`)
  console.log(`  Failed:    ${failed}`)
  console.log(`  Total in map: ${Object.keys(fileMap).length}`)
  console.log(`  Output: ${OUTPUT_PATH}`)
  console.log()

  if (failed > 0) {
    console.log('  Some uploads failed. Re-run with --resume to retry.')
  } else {
    console.log('  Next step: node scripts/migrate-phase1-03-create-products.mjs --dry-run')
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
