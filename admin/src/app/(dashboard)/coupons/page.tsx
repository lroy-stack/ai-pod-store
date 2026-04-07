'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Ticket,
  Plus,
  Wand2,
  Copy,
  MoreHorizontal,
  Pencil,
  Power,
  Download,
} from 'lucide-react'

import { adminFetch } from '@/lib/admin-api'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// --- Types ---
interface Coupon {
  id: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  min_purchase_amount: number | null
  max_discount_amount: number | null
  usage_limit: number | null
  times_used: number
  per_user_limit: number | null
  first_purchase_only: boolean
  user_id: string | null
  code_type: 'public' | 'personal' | 'bulk'
  campaign_name: string | null
  valid_from: string
  valid_until: string | null
  active: boolean
  created_at: string
  stats: {
    total_uses: number
    total_discount: number
    last_used: string | null
  }
}

interface CouponsResponse {
  coupons: Coupon[]
  total: number
  page: number
  limit: number
  campaigns: string[]
}

// --- Form defaults ---
const defaultFormData = {
  code: '',
  description: '',
  discount_type: 'percentage' as 'percentage' | 'fixed_amount',
  discount_value: 10,
  min_purchase_amount: null as number | null,
  max_discount_amount: null as number | null,
  usage_limit: null as number | null,
  per_user_limit: 1,
  first_purchase_only: false,
  valid_until: '',
  code_type: 'public' as 'public' | 'personal' | 'bulk',
  campaign_name: '',
}

// --- Page ---
export default function CouponsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [bulkCount, setBulkCount] = useState(10)
  const [bulkPrefix, setBulkPrefix] = useState('')

  // --- Data fetching ---
  const { data, isLoading } = useQuery<CouponsResponse>({
    queryKey: ['admin-coupons', page],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/coupons?page=${page}&limit=20`)
      if (!res.ok) throw new Error('Failed to fetch coupons')
      return res.json()
    },
  })

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: async (payload: typeof defaultFormData) => {
      const body = {
        ...payload,
        code: payload.code || undefined,
        description: payload.description || undefined,
        min_purchase_amount: payload.min_purchase_amount || undefined,
        max_discount_amount: payload.max_discount_amount || undefined,
        usage_limit: payload.usage_limit || undefined,
        valid_until: payload.valid_until || undefined,
        campaign_name: payload.campaign_name || undefined,
      }
      const res = await adminFetch('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create')
      }
      return res.json()
    },
    onSuccess: (coupon) => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast.success(`Coupon ${coupon.code} created`)
      setCreateOpen(false)
      setFormData(defaultFormData)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, any>) => {
      const res = await adminFetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast.success('Coupon updated')
      setEditCoupon(null)
    },
    onError: () => toast.error('Failed to update coupon'),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await adminFetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      })
      if (!res.ok) throw new Error('Failed to toggle')
      return res.json()
    },
    onSuccess: (coupon) => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast.success(`Coupon ${coupon.active ? 'activated' : 'deactivated'}`)
    },
  })

  const bulkMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await adminFetch('/api/admin/coupons/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to generate')
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast.success(`Generated ${result.created} coupons`)
      setBulkOpen(false)
    },
    onError: () => toast.error('Failed to generate coupons'),
  })

  // --- Copy code ---
  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code)
    toast.success(`Copied: ${code}`)
  }, [])

  // --- Export CSV ---
  const exportCSV = useCallback(() => {
    if (!data?.coupons) return
    const headers = ['Code', 'Type', 'Value', 'Min Purchase', 'Usage Limit', 'Times Used', 'Valid Until', 'Status', 'Campaign']
    const rows = data.coupons.map(c => [
      c.code,
      c.discount_type,
      c.discount_value,
      c.min_purchase_amount || '',
      c.usage_limit || 'unlimited',
      c.times_used,
      c.valid_until || 'no expiry',
      c.active ? 'active' : 'inactive',
      c.campaign_name || '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coupons-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data])

  // --- Columns ---
  const columns = useMemo<ColumnDef<Coupon>[]>(() => [
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono font-semibold">{row.original.code}</code>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(row.original.code)}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      accessorKey: 'discount_type',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Discount" />,
      cell: ({ row }) => {
        const c = row.original
        return c.discount_type === 'percentage'
          ? <span className="font-medium">{c.discount_value}%</span>
          : <span className="font-medium">€{c.discount_value}</span>
      },
    },
    {
      accessorKey: 'code_type',
      header: 'Type',
      cell: ({ row }) => {
        const t = row.original.code_type
        return (
          <Badge variant="outline" className="text-xs">
            {t}
          </Badge>
        )
      },
    },
    {
      id: 'rules',
      header: 'Rules',
      cell: ({ row }) => {
        const c = row.original
        const rules: string[] = []
        if (c.first_purchase_only) rules.push('1st purchase')
        if (c.per_user_limit === 1) rules.push('1/user')
        else if (c.per_user_limit) rules.push(`${c.per_user_limit}/user`)
        if (c.min_purchase_amount) rules.push(`min €${c.min_purchase_amount}`)
        if (c.user_id) rules.push('personal')
        return (
          <div className="flex flex-wrap gap-1">
            {rules.map(r => (
              <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
            ))}
            {rules.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
          </div>
        )
      },
    },
    {
      id: 'usage',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Usage" />,
      cell: ({ row }) => {
        const c = row.original
        return (
          <span className="text-sm">
            {c.times_used}{c.usage_limit ? `/${c.usage_limit}` : ''}
          </span>
        )
      },
    },
    {
      accessorKey: 'valid_until',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Expires" />,
      cell: ({ row }) => {
        const d = row.original.valid_until
        if (!d) return <span className="text-xs text-muted-foreground">never</span>
        const date = new Date(d)
        const expired = date < new Date()
        return (
          <span className={`text-xs ${expired ? 'text-destructive' : ''}`}>
            {date.toLocaleDateString()}
          </span>
        )
      },
    },
    {
      id: 'revenue',
      header: 'Revenue Impact',
      cell: ({ row }) => {
        const s = row.original.stats
        if (s.total_discount === 0) return <span className="text-xs text-muted-foreground">—</span>
        return <span className="text-xs font-medium">-€{(s.total_discount / 100).toFixed(2)}</span>
      },
    },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => {
        const c = row.original
        const expired = c.valid_until && new Date(c.valid_until) < new Date()
        if (!c.active) return <Badge variant="secondary">Inactive</Badge>
        if (expired) return <Badge variant="destructive">Expired</Badge>
        return <Badge className="bg-success text-success-foreground">Active</Badge>
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const c = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setEditCoupon(c)
                setFormData({
                  code: c.code,
                  description: c.description || '',
                  discount_type: c.discount_type,
                  discount_value: Number(c.discount_value),
                  min_purchase_amount: c.min_purchase_amount ? Number(c.min_purchase_amount) : null,
                  max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : null,
                  usage_limit: c.usage_limit,
                  per_user_limit: c.per_user_limit ?? 1,
                  first_purchase_only: c.first_purchase_only,
                  valid_until: c.valid_until ? c.valid_until.slice(0, 16) : '',
                  code_type: c.code_type,
                  campaign_name: c.campaign_name || '',
                })
              }}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyCode(c.code)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleMutation.mutate({ id: c.id, active: !c.active })}>
                <Power className="h-4 w-4 mr-2" />
                {c.active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [copyCode, toggleMutation])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6" />
            Coupons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage discount codes, campaigns, and promotions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Wand2 className="h-4 w-4 mr-2" />
            Bulk Generate
          </Button>
          <Button onClick={() => { setFormData(defaultFormData); setCreateOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Coupon
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Coupons</p>
            <p className="text-2xl font-bold">{data.total}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold">{data.coupons.filter(c => c.active).length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Redemptions</p>
            <p className="text-2xl font-bold">{data.coupons.reduce((s, c) => s + c.times_used, 0)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Discount Given</p>
            <p className="text-2xl font-bold">
              €{(data.coupons.reduce((s, c) => s + c.stats.total_discount, 0) / 100).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={data?.coupons || []}
        isLoading={isLoading}
        enableSorting
        enablePagination
        pageSize={20}
        tableId="coupons"
        searchColumn="code"
        searchPlaceholder="Search by code..."
        filters={[
          {
            columnId: 'active',
            label: 'Status',
            options: [
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' },
            ],
          },
          {
            columnId: 'discount_type',
            label: 'Discount Type',
            options: [
              { label: 'Percentage', value: 'percentage' },
              { label: 'Fixed Amount', value: 'fixed_amount' },
            ],
          },
          {
            columnId: 'code_type',
            label: 'Code Type',
            options: [
              { label: 'Public', value: 'public' },
              { label: 'Personal', value: 'personal' },
              { label: 'Bulk', value: 'bulk' },
            ],
          },
        ]}
        emptyTitle="No coupons yet"
        emptyDescription="Create your first coupon to start offering discounts"
        emptyCtaLabel="Create Coupon"
        onEmptyCta={() => { setFormData(defaultFormData); setCreateOpen(true) }}
      />

      {/* Create / Edit Dialog */}
      <CouponFormDialog
        open={createOpen || !!editCoupon}
        onClose={() => { setCreateOpen(false); setEditCoupon(null); setFormData(defaultFormData) }}
        title={editCoupon ? 'Edit Coupon' : 'Create Coupon'}
        formData={formData}
        setFormData={setFormData}
        isEditing={!!editCoupon}
        onSubmit={() => {
          if (editCoupon) {
            const { code, ...updateData } = formData
            updateMutation.mutate({ id: editCoupon.id, ...updateData })
          } else {
            createMutation.mutate(formData)
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Bulk Generate Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Bulk Generate Coupons
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Count (1-1000)</Label>
                <Input type="number" min={1} max={1000} value={bulkCount} onChange={e => setBulkCount(parseInt(e.target.value) || 10)} />
              </div>
              <div>
                <Label>Prefix (optional)</Label>
                <Input placeholder="e.g. SPRING" value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value)} maxLength={10} />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Type</Label>
                <Select value={formData.discount_type} onValueChange={v => setFormData(f => ({ ...f, discount_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{formData.discount_type === 'percentage' ? 'Percentage (%)' : 'Amount (€)'}</Label>
                <Input type="number" min={0.01} step={0.01} value={formData.discount_value} onChange={e => setFormData(f => ({ ...f, discount_value: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Campaign Name</Label>
              <Input placeholder="e.g. Spring Sale 2026" value={formData.campaign_name} onChange={e => setFormData(f => ({ ...f, campaign_name: e.target.value }))} />
            </div>
            <div>
              <Label>Expires</Label>
              <Input type="datetime-local" value={formData.valid_until} onChange={e => setFormData(f => ({ ...f, valid_until: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button
              onClick={() => bulkMutation.mutate({
                count: bulkCount,
                prefix: bulkPrefix || undefined,
                discount_type: formData.discount_type,
                discount_value: formData.discount_value,
                campaign_name: formData.campaign_name || undefined,
                valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : undefined,
                per_user_limit: 1,
              })}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending ? 'Generating...' : `Generate ${bulkCount} Codes`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Coupon Form Dialog ---
function CouponFormDialog({
  open,
  onClose,
  title,
  formData,
  setFormData,
  isEditing,
  onSubmit,
  isPending,
}: {
  open: boolean
  onClose: () => void
  title: string
  formData: typeof defaultFormData
  setFormData: React.Dispatch<React.SetStateAction<typeof defaultFormData>>
  isEditing: boolean
  onSubmit: () => void
  isPending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Code */}
          <div>
            <Label>Code {!isEditing && '(leave empty to auto-generate)'}</Label>
            <Input
              value={formData.code}
              onChange={e => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. WELCOME20"
              disabled={isEditing}
              className="font-mono"
              maxLength={50}
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description (internal)</Label>
            <Input
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Spring campaign for new users"
              maxLength={200}
            />
          </div>

          <Separator />

          {/* Discount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Discount Type</Label>
              <Select value={formData.discount_type} onValueChange={v => setFormData(f => ({ ...f, discount_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed_amount">Fixed Amount (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{formData.discount_type === 'percentage' ? 'Percentage' : 'Amount (€)'}</Label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                max={formData.discount_type === 'percentage' ? 100 : undefined}
                value={formData.discount_value}
                onChange={e => setFormData(f => ({ ...f, discount_value: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Min Purchase (€)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formData.min_purchase_amount ?? ''}
                onChange={e => setFormData(f => ({ ...f, min_purchase_amount: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="No minimum"
              />
            </div>
            <div>
              <Label>Max Discount (€)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formData.max_discount_amount ?? ''}
                onChange={e => setFormData(f => ({ ...f, max_discount_amount: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="No cap"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Usage Limit</Label>
              <Input
                type="number"
                min={1}
                value={formData.usage_limit ?? ''}
                onChange={e => setFormData(f => ({ ...f, usage_limit: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <Label>Per-User Limit</Label>
              <Input
                type="number"
                min={1}
                value={formData.per_user_limit ?? ''}
                onChange={e => setFormData(f => ({ ...f, per_user_limit: e.target.value ? parseInt(e.target.value) : 1 }))}
              />
            </div>
          </div>

          <Separator />

          {/* Rules */}
          <div className="flex items-center justify-between">
            <Label>First Purchase Only</Label>
            <Switch
              checked={formData.first_purchase_only}
              onCheckedChange={v => setFormData(f => ({ ...f, first_purchase_only: v }))}
            />
          </div>

          {/* Validity */}
          <div>
            <Label>Expires At</Label>
            <Input
              type="datetime-local"
              value={formData.valid_until}
              onChange={e => setFormData(f => ({ ...f, valid_until: e.target.value }))}
            />
          </div>

          {/* Code type & campaign */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Code Type</Label>
              <Select value={formData.code_type} onValueChange={v => setFormData(f => ({ ...f, code_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="bulk">Bulk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campaign</Label>
              <Input
                value={formData.campaign_name}
                onChange={e => setFormData(f => ({ ...f, campaign_name: e.target.value }))}
                placeholder="Optional grouping"
                maxLength={100}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
