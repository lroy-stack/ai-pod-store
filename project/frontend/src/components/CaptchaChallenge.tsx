'use client'

import { useCallback, useRef } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface CaptchaChallengeProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerified: () => void
}

export function CaptchaChallenge({ open, onOpenChange, onVerified }: CaptchaChallengeProps) {
  const captchaRef = useRef<HCaptcha>(null)

  const handleVerify = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (res.ok) {
        onVerified()
        onOpenChange(false)
      }
    } catch {
      // Allow retry
    }
  }, [onVerified, onOpenChange])

  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick Verification</DialogTitle>
          <DialogDescription>
            Please complete this quick check to continue chatting.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <HCaptcha
            ref={captchaRef}
            sitekey={siteKey}
            onVerify={handleVerify}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
