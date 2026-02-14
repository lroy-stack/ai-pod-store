import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    // Read MEMORY.md from workspace
    const memoryPath = join(process.cwd(), '../../memory/MEMORY.md')
    const content = await readFile(memoryPath, 'utf-8')

    return NextResponse.json({ content })
  } catch (err) {
    console.error('Failed to read MEMORY.md:', err)
    return NextResponse.json(
      { error: 'Failed to read memory file' },
      { status: 500 }
    )
  }
}
