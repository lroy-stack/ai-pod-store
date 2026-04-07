/**
 * Artifact Detector — detects rich content patterns in markdown
 *
 * Identifies tables, code blocks, mermaid diagrams, and chart data
 * so they can be rendered with dedicated components instead of plain text.
 */

export type ArtifactType = 'table' | 'code' | 'mermaid' | 'chart'

export interface Artifact {
  type: ArtifactType
  content: string
  language?: string
  startIndex: number
  endIndex: number
}

/**
 * Detect if content contains a markdown table (|---|--- pattern)
 */
export function hasTable(content: string): boolean {
  return /\|[\s-]+\|/.test(content)
}

/**
 * Extract table data from markdown table format.
 * Returns headers and rows as string arrays.
 */
export function parseMarkdownTable(
  tableText: string
): { headers: string[]; rows: string[][] } | null {
  const lines = tableText
    .trim()
    .split('\n')
    .filter((l) => l.trim())

  if (lines.length < 3) return null

  // Find the separator line (|---|---|)
  const sepIdx = lines.findIndex((l) => /^\|[\s:-]+\|/.test(l.trim()))
  if (sepIdx < 1) return null

  const parseLine = (line: string): string[] =>
    line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c !== '')

  const headers = parseLine(lines[sepIdx - 1])
  const rows = lines
    .slice(sepIdx + 1)
    .filter((l) => l.includes('|'))
    .map(parseLine)

  return { headers, rows }
}

/**
 * Detect code blocks with language identifiers.
 */
export function detectCodeBlocks(
  content: string
): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = []
  const regex = /```(\w+)?\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(content)) !== null) {
    const language = match[1] || 'text'
    const code = match[2].trim()

    // Skip mermaid and chart blocks (handled separately)
    if (language === 'mermaid' || language === 'chart') continue

    blocks.push({ language, code })
  }

  return blocks
}

/**
 * Detect mermaid diagram blocks.
 */
export function detectMermaid(content: string): string[] {
  const blocks: string[] = []
  const regex = /```mermaid\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim())
  }

  return blocks
}

/**
 * Detect chart data blocks (```chart or JSON with chart-like structure).
 */
export function detectChartData(
  content: string
): Array<{ type: string; data: unknown }> {
  const charts: Array<{ type: string; data: unknown }> = []
  const regex = /```chart\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.type && parsed.data) {
        charts.push(parsed)
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return charts
}

/**
 * Detect all artifacts in a markdown string.
 */
export function detectArtifacts(content: string): Artifact[] {
  const artifacts: Artifact[] = []

  // Detect mermaid diagrams
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g
  let match
  while ((match = mermaidRegex.exec(content)) !== null) {
    artifacts.push({
      type: 'mermaid',
      content: match[1].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  // Detect chart data
  const chartRegex = /```chart\n([\s\S]*?)```/g
  while ((match = chartRegex.exec(content)) !== null) {
    artifacts.push({
      type: 'chart',
      content: match[1].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  // Detect code blocks (excluding mermaid and chart)
  const codeRegex = /```(\w+)?\n([\s\S]*?)```/g
  while ((match = codeRegex.exec(content)) !== null) {
    const lang = match[1] || 'text'
    if (lang === 'mermaid' || lang === 'chart') continue
    artifacts.push({
      type: 'code',
      content: match[2].trim(),
      language: lang,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  return artifacts.sort((a, b) => a.startIndex - b.startIndex)
}
