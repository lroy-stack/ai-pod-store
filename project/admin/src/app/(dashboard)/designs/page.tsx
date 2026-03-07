'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { useDesigns, Design } from '@/hooks/queries/useDesigns'
import { Eye } from 'lucide-react'

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  approved: 'default',
  pending: 'secondary',
  rejected: 'destructive',
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  fal: 'FAL',
  gemini: 'Gemini',
  sourced: 'Sourced',
}

function truncate(str: string | null, len: number) {
  if (!str) return '—'
  return str.length > len ? str.slice(0, len) + '…' : str
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DesignsPage() {
  const router = useRouter()
  const { data, isLoading } = useDesigns({ page: 1, limit: 200 })
  const designs = data?.designs || []

  // Extract unique models for the filter
  const modelOptions = useMemo(() => {
    const models = Array.from(new Set(designs.map((d) => d.model).filter(Boolean))) as string[]
    return models.map((m) => ({ label: m, value: m }))
  }, [designs])

  const columns = useMemo<ColumnDef<Design>[]>(
    () => [
      // Thumbnail
      {
        id: 'thumbnail',
        header: 'Thumb',
        cell: ({ row }) => {
          const d = row.original
          const src = d.thumbnail_url || d.image_url
          if (!src) {
            return (
              <div className="w-[50px] h-[50px] rounded bg-muted flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                —
              </div>
            )
          }
          return (
            <div className="relative w-[50px] h-[50px] rounded overflow-hidden bg-muted flex-shrink-0">
              <Image
                src={src}
                alt={truncate(d.prompt, 40)}
                width={100}
                height={100}
                quality={60}
                className="object-cover w-full h-full"
                unoptimized={src.startsWith('http') && !src.includes('localhost')}
              />
            </div>
          )
        },
        enableSorting: false,
      },
      // Prompt
      {
        accessorKey: 'prompt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Prompt" />,
        cell: ({ row }) => (
          <span className="text-sm max-w-[260px] block truncate" title={row.original.prompt}>
            {truncate(row.original.prompt, 60)}
          </span>
        ),
      },
      // Model
      {
        accessorKey: 'model',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Model" />,
        cell: ({ row }) => {
          const m = row.original.model
          if (!m) return <span className="text-muted-foreground text-xs">—</span>
          return <Badge variant="outline" className="text-xs whitespace-nowrap">{m}</Badge>
        },
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true
          return row.original.model === filterValue
        },
      },
      // Source Type
      {
        accessorKey: 'source_type',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
        cell: ({ row }) => {
          const s = row.original.source_type
          if (!s) return <span className="text-muted-foreground text-xs">—</span>
          return (
            <Badge variant="outline" className="text-xs">
              {SOURCE_TYPE_LABELS[s] || s}
            </Badge>
          )
        },
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true
          return row.original.source_type === filterValue
        },
      },
      // Dimensions
      {
        id: 'dimensions',
        header: 'Dimensions',
        cell: ({ row }) => {
          const { width, height } = row.original
          if (!width || !height) return <span className="text-muted-foreground text-xs">—</span>
          return <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">{width}×{height}</span>
        },
        enableSorting: false,
      },
      // Status
      {
        accessorKey: 'moderation_status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const s = row.original.moderation_status
          return (
            <Badge variant={STATUS_VARIANTS[s] || 'secondary'} className="text-xs capitalize">
              {s}
            </Badge>
          )
        },
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true
          return row.original.moderation_status === filterValue
        },
      },
      // Used In
      {
        accessorKey: 'used_in_count',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Used In" />,
        cell: ({ row }) => {
          const count = row.original.used_in_count ?? 0
          if (count === 0) {
            return <Badge variant="destructive" className="text-xs">Orphaned</Badge>
          }
          return (
            <span className="text-sm font-medium tabular-nums">{count}</span>
          )
        },
      },
      // Created
      {
        accessorKey: 'created_at',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      // Tags
      {
        accessorKey: 'tags',
        header: 'Tags',
        cell: ({ row }) => {
          const tags: string[] = row.original.tags || []
          if (!tags.length) return <span className="text-muted-foreground text-xs">—</span>
          return (
            <div className="flex flex-wrap gap-1 max-w-[160px]">
              {tags.slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0">{t}</Badge>
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
              )}
            </div>
          )
        },
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true
          return (row.original.tags || []).includes(filterValue)
        },
        enableSorting: false,
      },
      // Actions
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Link href={`/designs/${row.original.id}`}>
              <Eye className="h-4 w-4" />
              <span className="sr-only">View design</span>
            </Link>
          </Button>
        ),
        enableSorting: false,
      },
    ],
    []
  )

  const renderMobileCard = (design: Design) => {
    const src = design.thumbnail_url || design.image_url
    const count = design.used_in_count ?? 0
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-start gap-3">
          {src ? (
            <div className="relative w-[50px] h-[50px] rounded overflow-hidden bg-muted flex-shrink-0">
              <Image
                src={src}
                alt={truncate(design.prompt, 30)}
                width={100}
                height={100}
                quality={60}
                className="object-cover w-full h-full"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-[50px] h-[50px] rounded bg-muted flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate">{truncate(design.prompt, 60)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(design.created_at)}</p>
          </div>
          <Badge
            variant={STATUS_VARIANTS[design.moderation_status] || 'secondary'}
            className="text-xs capitalize flex-shrink-0"
          >
            {design.moderation_status}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex gap-2">
            {design.model && (
              <Badge variant="outline" className="text-xs">{design.model}</Badge>
            )}
            {count === 0
              ? <Badge variant="destructive" className="text-xs">Orphaned</Badge>
              : <span className="text-muted-foreground">Used in {count} product{count !== 1 ? 's' : ''}</span>
            }
          </div>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
            <Link href={`/designs/${design.id}`}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              View
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Designs</h1>
          <p className="text-muted-foreground">AI-generated designs and their product usage</p>
        </div>

        <DataTable
          columns={columns}
          data={designs}
          isLoading={isLoading}
          enableSorting
          enablePagination
          enableColumnVisibility
          pageSize={25}
          tableId="designs"
          searchColumn="prompt"
          searchPlaceholder="Search by prompt…"
          filters={[
            {
              columnId: 'moderation_status',
              label: 'Status',
              options: [
                { label: 'Approved', value: 'approved' },
                { label: 'Pending', value: 'pending' },
                { label: 'Rejected', value: 'rejected' },
              ],
            },
            {
              columnId: 'model',
              label: 'Model',
              options: modelOptions,
            },
            {
              columnId: 'source_type',
              label: 'Source',
              options: [
                { label: 'FAL', value: 'fal' },
                { label: 'Gemini', value: 'gemini' },
                { label: 'Sourced', value: 'sourced' },
              ],
            },
            {
              columnId: 'tags',
              label: 'Tag',
              options: ['animals', 'easter', 'feminist', 'groovy', 'meme', 'branded', 'minimalist', 'tech'].map(
                (t) => ({ label: t, value: t })
              ),
            },
          ]}
          onRowClick={(row) => router.push(`/designs/${row.id}`)}
          renderMobileCard={renderMobileCard}
          emptyTitle="No designs found"
          emptyDescription="Designs will appear here once generated."
        />
      </div>
    </main>
  )
}
