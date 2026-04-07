'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MailX, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function UnsubscribePage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleUnsubscribe() {
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStatus('success')
        setMessage(data.message || 'Successfully unsubscribed.')
      } else {
        setStatus('error')
        setMessage(data.error || 'Something went wrong.')
      }
    } catch {
      setStatus('error')
      setMessage('Connection error. Please try again.')
    }
  }

  // Auto-unsubscribe if token present (one-click RFC 8058)
  useEffect(() => {
    if (token) {
      handleUnsubscribe()
    }
  }, [token])

  if (!email && !token) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle>Invalid Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>This unsubscribe link is not valid. Please use the link from your email.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success mb-4" />
            <CardTitle>Unsubscribed</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {email && <><strong>{email}</strong> has been </>}
              removed from our mailing list. You will no longer receive marketing emails from {process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store'}.
            </p>
            <p className="text-sm text-muted-foreground">
              Order confirmations and shipping updates are not affected.
            </p>
            <Button variant="outline" asChild>
              <a href="/">Back to {process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store'}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Processing your request...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{message}</p>
            <Button onClick={handleUnsubscribe}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Default: confirmation screen
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader className="text-center">
          <MailX className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Unsubscribe from {process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store'}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">
            Are you sure you want to unsubscribe{email ? <> <strong>{email}</strong></> : ''}?
            You will no longer receive newsletters and promotional emails.
          </p>
          <p className="text-sm text-muted-foreground">
            Order confirmations and shipping updates are not affected.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" asChild>
              <a href="/">Cancel</a>
            </Button>
            <Button variant="destructive" onClick={handleUnsubscribe}>
              Unsubscribe
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
