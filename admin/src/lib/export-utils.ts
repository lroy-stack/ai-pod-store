/**
 * Export utilities for chat artifacts.
 *
 * CSV export is built-in (no deps). Excel and PDF exports use
 * optional dependencies — functions gracefully degrade if not installed.
 */

import type { ChatMessage } from '@/hooks/usePodClawChat'

/**
 * Export tabular data to CSV and trigger download.
 */
export function exportToCSV(
  headers: string[],
  rows: string[][],
  filename = 'export.csv'
) {
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ]
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

/**
 * Export tabular data to Excel (.xlsx) using SheetJS.
 * Returns false if xlsx is not installed.
 */
export async function exportToExcel(
  headers: string[],
  rows: string[][],
  filename = 'export.xlsx'
): Promise<boolean> {
  try {
    const XLSX = await import('xlsx')
    const wsData = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, filename)
    return true
  } catch {
    // xlsx not installed — fall back to CSV
    exportToCSV(headers, rows, filename.replace('.xlsx', '.csv'))
    return false
  }
}

/**
 * Export a conversation as a text/markdown file.
 */
export function exportConversation(messages: ChatMessage[], filename?: string) {
  const lines: string[] = [
    '# PodClaw Chat Export',
    `Exported: ${new Date().toISOString()}`,
    `Messages: ${messages.length}`,
    '',
    '---',
    '',
  ]

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'Admin' : 'PodClaw'
    const time = msg.timestamp.toLocaleString()

    lines.push(`## ${role} — ${time}`)
    lines.push('')
    lines.push(msg.content)

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push('')
      lines.push('**Tool Calls:**')
      for (const tc of msg.toolCalls) {
        lines.push(`- \`${tc.tool}\` (${tc.status})`)
        if (tc.result) {
          lines.push(`  Result: ${tc.result.slice(0, 200)}`)
        }
      }
    }

    if (msg.costUsd) {
      lines.push(`\n*Cost: $${msg.costUsd.toFixed(4)}*`)
    }

    lines.push('')
    lines.push('---')
    lines.push('')
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' })
  downloadBlob(blob, filename || `podclaw-chat-${Date.now()}.md`)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
