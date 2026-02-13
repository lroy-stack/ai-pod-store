'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function LogoutButton({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Logout failed')
      }

      // Clear any local storage session data
      localStorage.removeItem('sb-session')

      // Redirect to login page
      router.push(`/${locale}/auth/login`)
    } catch (error) {
      console.error('Logout error:', error)
      // Even if there's an error, redirect to login page
      router.push(`/${locale}/auth/login`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? t('loggingOut') : t('logoutButton')}
    </button>
  )
}
