'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { BrandMark } from '@/components/ui/brand-mark'
import { BRAND } from '@/lib/store-config'
import Link from 'next/link'
import { Shield, Eye, ShoppingCart, X } from 'lucide-react'

/**
 * MCP OAuth Consent Page (Phase 3 — upstream Supabase PKCE)
 *
 * No longer requires Supabase session. The user approves the MCP client here,
 * then is redirected to the MCP server which handles Supabase Auth login.
 * Identity is established at Google/Email login, NOT at this consent step.
 */

const MCP_BASE_URL = process.env.NEXT_PUBLIC_MCP_BASE_URL || process.env.MCP_BASE_URL || 'http://localhost:8002'

const SCOPE_LABELS: Record<string, { label: string; description: string; icon: typeof Eye }> = {
  read: {
    label: 'Read access',
    description: 'View your profile, orders, wishlist, and cart',
    icon: Eye,
  },
  write: {
    label: 'Write access',
    description: 'Manage your cart, wishlist, addresses, and place orders',
    icon: ShoppingCart,
  },
}

export default function McpConsentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const requestId = searchParams.get('request_id')
  const clientName = searchParams.get('client_name') || 'Unknown App'
  const scopesParam = searchParams.get('scopes') || 'read write'
  const scopes = scopesParam.split(' ').filter(Boolean)

  const [isApproving, setIsApproving] = useState(false)

  if (!requestId) {
    return (
      <div className="mx-auto max-w-md flex flex-col items-center">
        <BrandMark size={48} />
        <Card className="mt-6 w-full bg-card/80 backdrop-blur-xl border-border/60 shadow-xl">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">Invalid authorization request. Missing request ID.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  function handleApprove() {
    setIsApproving(true)
    // Redirect to MCP server approval endpoint — sets cookie + redirects to Supabase Auth
    window.location.href = `${MCP_BASE_URL}/oauth/authorize/approved?request_id=${encodeURIComponent(requestId!)}`
  }

  function handleDeny() {
    if (window.opener) {
      window.close()
    } else {
      router.back()
    }
  }

  return (
    <div className="mx-auto max-w-md flex flex-col items-center">
      <Link href="/" className="mb-6 group" aria-label="Home">
        <BrandMark size={48} />
      </Link>

      <Card className="w-full bg-card/80 backdrop-blur-xl border-border/60 shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Authorize {clientName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>{clientName}</strong> wants to access your {BRAND.name} account
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Info: user will authenticate next */}
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-sm text-muted-foreground">
              You will sign in with Google after approving
            </p>
          </div>

          <Separator />

          {/* Requested permissions */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">This will allow {clientName} to:</p>
            {scopes.map((scope) => {
              const info = SCOPE_LABELS[scope]
              if (!info) return null
              const Icon = info.icon
              return (
                <div key={scope} className="flex items-start gap-3 p-2 rounded-md">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{info.label}</p>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
                    {scope}
                  </Badge>
                </div>
              )
            })}
          </div>

          <Separator />

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDeny}
              disabled={isApproving}
            >
              <X className="h-4 w-4 mr-2" />
              Deny
            </Button>
            <Button
              className="flex-1"
              onClick={handleApprove}
              disabled={isApproving}
            >
              {isApproving ? 'Redirecting...' : 'Authorize'}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            You can revoke access at any time from your account settings.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
