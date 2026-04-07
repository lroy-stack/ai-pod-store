/**
 * fix-turbopack-deps.cjs
 *
 * Turbopack (Next.js 16) cannot resolve dependencies that are hoisted to
 * a parent node_modules in npm workspaces. It expects every dependency to
 * exist in the same node_modules tree as the requiring package.
 *
 * This script scans ALL packages in each workspace's node_modules (including
 * nested ones like next/node_modules/*) and copies any missing dependencies
 * from the root node_modules into the correct location.
 *
 * Runs automatically via "postinstall" in the root package.json.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const ROOT_NM = path.join(ROOT, 'node_modules')
const WORKSPACES = ['frontend', 'admin']

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue // don't recurse into nested nm
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyRecursive(s, d)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}

function getDeps(pkgDir) {
  const pkgFile = path.join(pkgDir, 'package.json')
  if (!fs.existsSync(pkgFile)) return []
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
    return Object.keys(pkg.dependencies || {})
  } catch { return [] }
}

function findNestedNodeModules(baseNm) {
  // Find all node_modules dirs inside packages (e.g. next/node_modules)
  const results = [baseNm]
  try {
    for (const entry of fs.readdirSync(baseNm, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.startsWith('@')) continue
      const nested = path.join(baseNm, entry.name, 'node_modules')
      if (fs.existsSync(nested)) results.push(nested)
    }
    // Also check scoped packages
    for (const entry of fs.readdirSync(baseNm, { withFileTypes: true })) {
      if (!entry.name.startsWith('@') || !entry.isDirectory()) continue
      const scopeDir = path.join(baseNm, entry.name)
      for (const scoped of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        const nested = path.join(scopeDir, scoped.name, 'node_modules')
        if (fs.existsSync(nested)) results.push(nested)
      }
    }
  } catch {}
  return results
}

let fixed = 0

for (const ws of WORKSPACES) {
  const wsNm = path.join(ROOT, ws, 'node_modules')
  if (!fs.existsSync(wsNm)) continue

  for (const nmDir of findNestedNodeModules(wsNm)) {
    // Get all packages in this node_modules
    const packages = []
    try {
      for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        if (entry.name.startsWith('@') && entry.isDirectory()) {
          const scopeDir = path.join(nmDir, entry.name)
          for (const scoped of fs.readdirSync(scopeDir)) {
            packages.push(path.join(entry.name, scoped))
          }
        } else {
          packages.push(entry.name)
        }
      }
    } catch { continue }

    for (const pkg of packages) {
      const pkgDir = path.join(nmDir, pkg)
      const deps = getDeps(pkgDir)

      for (const dep of deps) {
        // Check if dep exists locally (same node_modules or parent)
        const inSameNm = fs.existsSync(path.join(nmDir, dep))
        const inWsNm = fs.existsSync(path.join(wsNm, dep))

        if (inSameNm || inWsNm) continue

        // Missing locally — find in root
        const rootSource = path.join(ROOT_NM, dep)
        if (!fs.existsSync(rootSource)) continue

        const target = path.join(nmDir, dep)

        // Remove stale symlink
        try {
          if (fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target)
        } catch {}

        if (fs.existsSync(target)) continue

        copyRecursive(rootSource, target)
        fixed++
      }
    }
  }
}

if (fixed > 0) {
  console.log(`[turbopack-fix] Copied ${fixed} package(s) for Turbopack compatibility`)
} else {
  console.log('[turbopack-fix] All dependencies resolved correctly')
}
