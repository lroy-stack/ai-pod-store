'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-fetch'

export default function LogoutButton({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)

    try {
      const response = await apiFetch('/api/auth/logout', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Logout failed')
      }

      localStorage.removeItem('sb-session')
      router.push(`/${locale}/auth/login`)
    } catch (error) {
      console.error('Logout error:', error)
      router.push(`/${locale}/auth/login`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="destructive" onClick={handleLogout} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {t('loggingOut')}
        </>
      ) : (
        <>
          <LogOut className="size-4" />
          {t('logoutButton')}
        </>
      )}
    </Button>
  )
}
