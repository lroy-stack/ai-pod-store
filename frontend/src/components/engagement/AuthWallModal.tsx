'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Check } from 'lucide-react'
import { BrandMark } from '@/components/ui/brand-mark'

interface AuthWallModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
  variant?: 'subtle' | 'wall'
}

export function AuthWallModal({ open, onOpenChange, reason, variant = 'subtle' }: AuthWallModalProps) {
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const t = useTranslations('engagement.authWall')

  const benefits = [t('benefit1'), t('benefit2'), t('benefit3'), t('benefit4'), t('benefit5')]

  const isWall = variant === 'wall'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isWall ? 'sm:max-w-2xl' : 'sm:max-w-md'}>
        <DialogHeader className={isWall ? 'text-center items-center' : ''}>
          {isWall && (
            <BrandMark size={56} className="justify-center mb-2" />
          )}
          <DialogTitle className={isWall ? 'text-2xl' : 'text-xl'}>
            {isWall ? t('wallTitle', { count: 5 }) : t('title')}
          </DialogTitle>
          {isWall && (
            <DialogDescription className="text-base">
              {t('wallSubtitle')}
            </DialogDescription>
          )}
          {!isWall && reason && (
            <DialogDescription>{reason}</DialogDescription>
          )}
        </DialogHeader>

        <div className={`space-y-3 ${isWall ? 'py-4 bg-muted/30 rounded-xl px-6' : 'py-2'}`}>
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            onClick={() => {
              onOpenChange(false)
              router.push(`/${locale}/auth/register`)
            }}
            className="w-full"
            size={isWall ? 'lg' : 'default'}
          >
            {t('signUp')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              router.push(`/${locale}/auth/login`)
            }}
            className="w-full"
            size={isWall ? 'lg' : 'default'}
          >
            {t('logIn')}
          </Button>
        </div>

        {isWall && (
          <>
            <Separator />
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">{t('premiumTeaser')}</p>
              <p className="text-xs text-muted-foreground">{t('premiumSummary')}</p>
              <Button
                variant="link"
                onClick={() => {
                  onOpenChange(false)
                  router.push(`/${locale}/pricing`)
                }}
                className="text-primary"
              >
                {t('seePremium')} →
              </Button>
            </div>
          </>
        )}

        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {isWall ? t('continueBrowsing') : t('continueGuest')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
