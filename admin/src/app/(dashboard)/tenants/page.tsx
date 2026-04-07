'use client'

/**
 * Tenants list page
 * Route: /panel/tenants
 *
 * Lists all multi-tenant stores with plan, status, and quick link to billing.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch, apiUrl } from '@/lib/admin-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Building2, RefreshCw, CreditCard, Plus } from 'lucide-react'

interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  domain: string | null
  created_at: string
}

const PLAN_BADGES: Record<string, 'default' | 'secondary' | 'outline'> = {
  free: 'secondary',
  starter: 'outline',
  pro: 'default',
  enterprise: 'default',
}

const STATUS_BADGES: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  suspended: 'destructive',
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await adminFetch('/api/tenants')
      const data = await res.json()
      setTenants(data.tenants ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Tenants</h1>
            <p className="text-sm text-muted-foreground">Manage multi-tenant stores</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href={apiUrl('/tenants/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Tenant
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{tenants.length} tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No tenants found
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.domain ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={PLAN_BADGES[t.plan] ?? 'secondary'} className="text-xs capitalize">
                        {t.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGES[t.status] ?? 'secondary'} className="text-xs capitalize">
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={apiUrl(`/tenants/${t.id}`)}>
                          <CreditCard className="h-4 w-4 mr-1" />
                          Billing
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
