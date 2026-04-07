import { NextRequest } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

// Cache: { [type]: { data, timestamp } }
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const VALID_TYPES = ['rfm', 'demand', 'pricing', 'basket', 'trends', 'cohorts'] as const

// Map type to script filename
const SCRIPT_MAP: Record<string, string> = {
  rfm: 'rfm.py',
  demand: 'demand_forecast.py',
  pricing: 'pricing.py',
  basket: 'basket.py',
  trends: 'trends.py',
  cohorts: 'cohorts.py',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    await requireAdmin(request)
  } catch (error) {
    return authErrorResponse(error)
  }

  const { type } = await params

  if (!VALID_TYPES.includes(type as any)) {
    return Response.json({ error: 'Invalid analytics type' }, { status: 400 })
  }

  // Check cache
  const cached = cache.get(type)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return Response.json(cached.data)
  }

  const scriptPath = path.resolve(process.cwd(), '..', 'scripts', 'analytics', SCRIPT_MAP[type])

  try {
    const { stdout, stderr } = await execFileAsync('python3', [scriptPath], {
      timeout: 30000,
      env: { ...process.env, PYTHONPATH: path.resolve(process.cwd(), '..', 'scripts') },
    })

    if (stderr) {
      console.warn(`Analytics ${type} stderr:`, stderr)
    }

    const data = JSON.parse(stdout)
    cache.set(type, { data, timestamp: Date.now() })
    return Response.json(data)
  } catch (error: any) {
    console.error(`Analytics ${type} error:`, error)
    return Response.json(
      { error: `Failed to run ${type} analytics`, details: error.message },
      { status: 500 }
    )
  }
}
