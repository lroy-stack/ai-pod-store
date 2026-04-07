import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'
import { cookies } from 'next/headers'
import { checkApiRateLimit } from '@/lib/rate-limit'

const PODCLAW_ROOT = path.join(process.cwd(), '..', 'podclaw')
const CONTEXT_DIR = path.join(PODCLAW_ROOT, 'context')
const MEMORY_DIR = path.join(PODCLAW_ROOT, 'memory')

export async function GET(request: NextRequest) {
  // Rate limit filesystem reads
  const rateLimitResult = await checkApiRateLimit(request)
  if (rateLimitResult) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // Check admin authentication
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    if (!session.isLoggedIn || session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'context', 'logs', 'memory.md', 'soul.md'
    const file = searchParams.get('file') // specific file to read

    // Type: List context files
    if (type === 'context' && !file) {
      const files = await fs.readdir(CONTEXT_DIR)
      const mdFiles = files
        .filter(f => f.endsWith('.md') && !f.startsWith('.'))
        .sort()
      return NextResponse.json({ files: mdFiles })
    }

    // Type: Read specific context file
    if (type === 'context' && file) {
      const filePath = path.join(CONTEXT_DIR, file)
      // Security: prevent directory traversal
      if (!filePath.startsWith(CONTEXT_DIR)) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
      }
      const content = await fs.readFile(filePath, 'utf-8')
      return NextResponse.json({ content, filename: file })
    }

    // Type: List daily logs
    if (type === 'logs' && !file) {
      const files = await fs.readdir(MEMORY_DIR)
      const logFiles = files
        .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
        .sort()
        .reverse() // Most recent first
      return NextResponse.json({ files: logFiles })
    }

    // Type: Read specific daily log
    if (type === 'logs' && file) {
      const filePath = path.join(MEMORY_DIR, file)
      // Security: prevent directory traversal
      if (!filePath.startsWith(MEMORY_DIR)) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
      }
      const content = await fs.readFile(filePath, 'utf-8')
      return NextResponse.json({ content, filename: file })
    }

    // Type: Read MEMORY.md
    if (type === 'memory.md') {
      const memoryPath = path.join(MEMORY_DIR, 'MEMORY.md')
      try {
        const content = await fs.readFile(memoryPath, 'utf-8')
        return NextResponse.json({ content, filename: 'MEMORY.md' })
      } catch (error) {
        return NextResponse.json({ content: '# MEMORY.md\n\nNo memory file found.', filename: 'MEMORY.md' })
      }
    }

    // Type: Read SOUL.md
    if (type === 'soul.md') {
      const soulPath = path.join(PODCLAW_ROOT, 'SOUL.md')
      try {
        const content = await fs.readFile(soulPath, 'utf-8')
        return NextResponse.json({ content, filename: 'SOUL.md' })
      } catch (error) {
        return NextResponse.json({ content: '# SOUL.md\n\nNo soul file found.', filename: 'SOUL.md' })
      }
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching memory files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memory files' },
      { status: 500 }
    )
  }
}
