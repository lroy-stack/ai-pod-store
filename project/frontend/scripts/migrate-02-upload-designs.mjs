/**
 * migrate-02-upload-designs.mjs
 *
 * Block 2D — Script 2: Upload Design Files to Printful File Library
 *
 * Uploads ~115 design files from public/ directories to Printful's File Library.
 * Printful deduplicates by file hash, so the same PNG uploaded twice returns
 * the same file ID.
 *
 * Input:  Design files in public/ directories
 * Output: frontend/scripts/printful-file-map.json
 * Flags:  --dry-run (no actual uploads), --resume (skip already-uploaded files)
 *
 * Usage:
 *   cd frontend && node scripts/migrate-02-upload-designs.mjs --dry-run
 *   cd frontend && node scripts/migrate-02-upload-designs.mjs --resume
 *   cd frontend && node scripts/migrate-02-upload-designs.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join, relative, extname } from 'path'

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
const STORE_URL = env('NEXT_PUBLIC_BASE_URL') || 'https://skapara.com'

if (!PRINTFUL_TOKEN) {
  console.error('ERROR: PRINTFUL_API_TOKEN not found in .env.local')
  process.exit(1)
}
if (!PRINTFUL_STORE) {
  console.error('ERROR: PRINTFUL_STORE_ID not found in .env.local')
  process.exit(1)
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DELAY_MS = 2000 // 2 seconds between API calls
const POLL_INTERVAL_MS = 3000 // 3 seconds between status polls
const MAX_POLL_ATTEMPTS = 30 // Max 30 polls (90 seconds)

const DESIGN_DIRS = [
  'public/meme-designs',
  'public/meme-previews',
  'public/branded-previews',
  'public/brand-designs',
  'public/hat-designs',
  'public/kids-designs',
  'public/fleece-designs',
  'public/expansion-designs',
  'public/zip-hoodie-designs',
  'public/brand',
]

// File extensions to upload (design/print files only)
const UPLOAD_EXTENSIONS = new Set(['.png', '.svg', '.jpg', '.jpeg'])

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

const OUTPUT_PATH = join(ROOT, 'scripts', 'printful-file-map.json')

function loadExistingMap() {
  if (existsSync(OUTPUT_PATH)) {
    try {
      return JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
    } catch {
      return {}
    }
  }
  return {}
}

function saveMap(fileMap) {
  writeFileSync(OUTPUT_PATH, JSON.stringify(fileMap, null, 2))
}

// ─── Printful Fetch Helper ──────────────────────────────────────────────────────

async function printfulFetch(path, options = {}) {
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
    console.log(`  Rate limited, waiting ${retryAfter}s...`)
    await delay(retryAfter * 1000)
    return printfulFetch(path, options)
  }

  const json = await res.json()

  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(
      `Printful ${res.status}: ${json.error?.message || json.message || JSON.stringify(json).slice(0, 300)}`
    )
  }

  return json.result !== undefined ? json.result : json
}

// ─── Collect Design Files ───────────────────────────────────────────────────────

function collectDesignFiles() {
  const files = []

  for (const dir of DESIGN_DIRS) {
    const fullDir = join(ROOT, dir)
    if (!existsSync(fullDir)) {
      console.log(`  SKIP: ${dir} (directory not found)`)
      continue
    }

    walkDir(fullDir, dir, files)
  }

  return files
}

function walkDir(fullDir, relBase, files) {
  const entries = readdirSync(fullDir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(fullDir, entry.name)
    const relPath = join(relBase, entry.name)

    if (entry.isDirectory()) {
      walkDir(fullPath, relPath, files)
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      if (UPLOAD_EXTENSIONS.has(ext)) {
        const stat = statSync(fullPath)
        // The key used in the file map is the path relative to public/
        // e.g., "meme-designs/01-ghost-prompt.png"
        const mapKey = relPath.replace(/^public\//, '')
        files.push({
          mapKey,
          fullPath,
          relPath,
          filename: entry.name,
          sizeKB: Math.round(stat.size / 1024),
          ext,
        })
      }
    }
  }
}

// ─── Upload a Single File ───────────────────────────────────────────────────────

async function uploadFile(file) {
  // Build the public URL that Printful will fetch from
  const publicUrl = `${STORE_URL}/${file.mapKey}`

  const body = {
    url: publicUrl,
    type: 'default',
    filename: file.filename,
    visible: true,
  }

  const result = await printfulFetch('/files', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return result
}

// ─── Poll File Status ───────────────────────────────────────────────────────────

async function waitForFileReady(fileId) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await delay(POLL_INTERVAL_MS)

    try {
      const result = await printfulFetch(`/files/${fileId}`)
      const status = result.status || 'unknown'

      if (status === 'ok') {
        return { ok: true, result }
      }
      if (status === 'failed') {
        return { ok: false, error: 'File processing failed at Printful', result }
      }

      // Still pending/waiting — continue polling
    } catch (err) {
      // Transient error during poll — keep trying
      console.log(`    Poll error (attempt ${attempt + 1}): ${err.message}`)
    }
  }

  return { ok: false, error: `Timed out after ${MAX_POLL_ATTEMPTS} poll attempts` }
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70))
  console.log('  SKAPARA Migration — Script 2: Upload Designs to Printful')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : RESUME ? 'RESUME' : 'FULL UPLOAD'}`)
  console.log(`  Store URL: ${STORE_URL}`)
  console.log('='.repeat(70))

  // Collect all design files
  console.log('\n--- Scanning design directories ---\n')
  const allFiles = collectDesignFiles()
  console.log(`\n  Total design files found: ${allFiles.length}`)

  // Print breakdown by directory
  const byDir = {}
  for (const f of allFiles) {
    const dir = f.mapKey.split('/')[0]
    byDir[dir] = (byDir[dir] || 0) + 1
  }
  for (const [dir, count] of Object.entries(byDir).sort()) {
    console.log(`    ${dir}: ${count} files`)
  }

  // Load existing map for resume
  const existingMap = RESUME ? loadExistingMap() : {}
  const fileMap = { ...existingMap }

  // Filter files to upload
  const toUpload = allFiles.filter((f) => {
    if (RESUME && existingMap[f.mapKey]) {
      return false // Already uploaded
    }
    return true
  })

  const skipped = allFiles.length - toUpload.length
  if (skipped > 0) {
    console.log(`\n  Skipping ${skipped} already-uploaded files (resume mode)`)
  }
  console.log(`  Files to upload: ${toUpload.length}\n`)

  if (DRY_RUN) {
    console.log('--- DRY RUN: Files that would be uploaded ---\n')
    for (const f of toUpload) {
      console.log(`  ${f.mapKey} (${f.sizeKB}KB, ${f.ext})`)
      console.log(`    -> URL: ${STORE_URL}/${f.mapKey}`)
    }
    console.log(`\n  Total: ${toUpload.length} files would be uploaded`)
    console.log('  DRY RUN complete. No files were uploaded.\n')
    return
  }

  // Upload files
  console.log('--- Uploading files to Printful File Library ---\n')

  const stats = { success: 0, failed: 0, alreadyExists: 0 }
  const errors = []

  for (const [idx, file] of toUpload.entries()) {
    const progress = `[${idx + 1}/${toUpload.length}]`
    console.log(`  ${progress} ${file.mapKey} (${file.sizeKB}KB)`)

    try {
      await delay(DELAY_MS)
      const result = await uploadFile(file)

      const fileId = result.id
      const status = result.status || 'unknown'

      console.log(`    -> Uploaded: id=${fileId}, status=${status}`)

      // If status is not 'ok', poll until ready
      if (status !== 'ok') {
        console.log(`    -> Polling for completion...`)
        const pollResult = await waitForFileReady(fileId)

        if (pollResult.ok) {
          console.log(`    -> Ready: ${pollResult.result.url || 'ok'}`)
        } else {
          console.log(`    -> WARNING: ${pollResult.error}`)
          // Still record the file ID — it may become ready later
        }
      }

      fileMap[file.mapKey] = {
        id: fileId,
        url: result.url || result.preview_url || null,
        hash: result.hash || null,
        status: result.status || 'ok',
        filename: file.filename,
        uploadedAt: new Date().toISOString(),
      }
      stats.success++

      // Save after every successful upload (crash-safe)
      saveMap(fileMap)
    } catch (err) {
      console.error(`    -> FAILED: ${err.message}`)
      errors.push({ file: file.mapKey, error: err.message })
      stats.failed++

      // Continue with next file
    }
  }

  // Final save
  saveMap(fileMap)

  // ─── Summary ────────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(70))
  console.log('  UPLOAD SUMMARY')
  console.log('='.repeat(70))
  console.log(`\n  Total files scanned:   ${allFiles.length}`)
  console.log(`  Skipped (resume):      ${skipped}`)
  console.log(`  Uploaded successfully:  ${stats.success}`)
  console.log(`  Failed:                ${stats.failed}`)
  console.log(`  Total in file map:     ${Object.keys(fileMap).length}`)
  console.log(`\n  Output: ${OUTPUT_PATH}`)

  if (errors.length > 0) {
    console.log('\n  FAILED UPLOADS:')
    for (const e of errors) {
      console.log(`    - ${e.file}: ${e.error}`)
    }
  }

  // Warn if there are many failures
  const failRate = toUpload.length > 0 ? stats.failed / toUpload.length : 0
  if (failRate > 0.1) {
    console.log(
      `\n  WARNING: ${Math.round(failRate * 100)}% of uploads failed. ` +
        'Review errors above before proceeding to Script 3.'
    )
    console.log('  Consider re-running with --resume to retry failed files.\n')
  }

  console.log('\n  Done.\n')
}

main().catch((e) => {
  console.error('\nFATAL:', e.message, e.stack)
  process.exit(1)
})
