'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, Download } from 'lucide-react'
import { parseMarkdownTable } from '@/lib/artifact-detector'

interface DataTableProps {
  markdown: string
}

export function DataTable({ markdown }: DataTableProps) {
  const parsed = useMemo(() => parseMarkdownTable(markdown), [markdown])
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  if (!parsed) return null

  const { headers, rows } = parsed

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows
    return [...rows].sort((a, b) => {
      const va = a[sortCol] || ''
      const vb = b[sortCol] || ''
      // Try numeric sort first
      const na = parseFloat(va.replace(/[^0-9.-]/g, ''))
      const nb = parseFloat(vb.replace(/[^0-9.-]/g, ''))
      if (!isNaN(na) && !isNaN(nb)) {
        return sortAsc ? na - nb : nb - na
      }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [rows, sortCol, sortAsc])

  function handleSort(colIndex: number) {
    if (sortCol === colIndex) {
      setSortAsc(!sortAsc)
    } else {
      setSortCol(colIndex)
      setSortAsc(true)
    }
  }

  function exportCSV() {
    const csvLines = [
      headers.join(','),
      ...sortedRows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      ),
    ]
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `table-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="my-2 space-y-1">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={exportCSV} className="h-7 text-xs gap-1">
          <Download className="h-3 w-3" />
          CSV
        </Button>
      </div>
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, i) => (
                <TableHead
                  key={i}
                  className="cursor-pointer hover:bg-muted/50 transition-colors text-xs whitespace-nowrap"
                  onClick={() => handleSort(i)}
                >
                  <span className="flex items-center gap-1">
                    {header}
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, ri) => (
              <TableRow key={ri}>
                {row.map((cell, ci) => (
                  <TableCell key={ci} className="text-xs whitespace-nowrap">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-[10px] text-muted-foreground px-1">
        {sortedRows.length} rows
      </p>
    </div>
  )
}
