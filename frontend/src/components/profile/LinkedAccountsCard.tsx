'use client'

import { useTranslations } from 'next-intl'
import { Mail, Shield } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Provider {
  provider: string
  email: string | null
  created_at: string
}

interface LinkedAccountsCardProps {
  providers: Provider[]
  hasPassword: boolean
}

function ProviderIcon({ provider }: { provider: string }) {
  switch (provider) {
    case 'google':
      return (
        <svg className="size-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )
    case 'apple':
      return (
        <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
      )
    case 'email':
      return <Mail className="size-5" />
    default:
      return <Shield className="size-5" />
  }
}

function providerLabel(provider: string): string {
  switch (provider) {
    case 'google': return 'Google'
    case 'apple': return 'Apple'
    case 'email': return 'Email & Password'
    default: return provider
  }
}

export function LinkedAccountsCard({ providers, hasPassword }: LinkedAccountsCardProps) {
  const t = useTranslations('Profile')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
          <Shield className="size-5" />
          {t('linkedAccounts') || 'Linked Accounts'}
        </CardTitle>
        <CardDescription>
          {t('linkedAccountsDescription') || 'Sign-in methods connected to your account'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {providers.map((p) => (
          <div
            key={`${p.provider}-${p.email}`}
            className="flex items-center justify-between p-3 rounded-lg border border-border"
          >
            <div className="flex items-center gap-3">
              <ProviderIcon provider={p.provider} />
              <div>
                <p className="text-sm font-medium">{providerLabel(p.provider)}</p>
                {p.email && (
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                )}
              </div>
            </div>
            <Badge variant="default" className="bg-success/10 text-success border-success/20">
              {t('connected') || 'Connected'}
            </Badge>
          </div>
        ))}

        {!hasPassword && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('noPasswordSet') || 'No password set. You can set one below to also log in with email.'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
