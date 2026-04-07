import { withAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

let cache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const GET = withAuth(async (req, session) => {
  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data)
    }

    const scriptPath = path.resolve(process.cwd(), '..', 'scripts', 'analytics', 'rfm.py')
    const { stdout, stderr } = await execFileAsync('python3', [scriptPath], {
      timeout: 30000,
      env: { ...process.env, PYTHONPATH: path.resolve(process.cwd(), '..', 'scripts') },
    })

    if (stderr) {
      console.warn('RFM analytics stderr:', stderr)
    }

    const data = JSON.parse(stdout)
    cache = { data, timestamp: Date.now() }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error running RFM analytics:', error)
    return NextResponse.json(
      { error: 'Failed to run RFM analytics' },
      { status: 500 }
    )
  }
})
