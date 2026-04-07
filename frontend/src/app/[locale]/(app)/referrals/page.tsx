import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BASE_URL } from '@/lib/store-config'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, CheckCircle, Gift } from 'lucide-react'
import { CopyButton } from './CopyButton'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'referrals' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

async function getReferralData(userId: string) {
  // Get user's referral code
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('referral_code')
    .eq('id', userId)
    .single()

  // Get referral stats
  const { data: referrals } = await supabaseAdmin
    .from('referrals')
    .select('referred_id, credits_awarded, created_at')
    .eq('referrer_id', userId)

  const totalInvited = referrals?.length || 0
  const totalConverted = referrals?.filter(r => r.credits_awarded).length || 0
  const creditsEarned = totalConverted * 10 // 10 credits per successful referral

  return {
    referralCode: user?.referral_code || '',
    totalInvited,
    totalConverted,
    creditsEarned,
  }
}

export default async function ReferralsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'referrals' })

  // Get user from session
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('sb-access-token')

  if (!sessionCookie) {
    redirect(`/${locale}/login?redirect=/${locale}/referrals`)
  }

  const { data: { user } } = await supabaseAdmin.auth.getUser(sessionCookie.value)

  if (!user) {
    redirect(`/${locale}/login?redirect=/${locale}/referrals`)
  }

  const stats = await getReferralData(user.id)
  const referralLink = `${BASE_URL}/${locale}?ref=${stats.referralCode}`

  return (
    <div className="min-h-screen px-6 py-24 md:py-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('title')}</h1>
        <p className="text-lg text-muted-foreground mb-12">{t('subtitle')}</p>

        {/* Referral Link Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              {t('inviteLinkTitle')}
            </CardTitle>
            <CardDescription>{t('inviteLinkDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                readOnly
                value={referralLink}
                className="font-mono text-sm"
                id="referral-link"
              />
              <CopyButton text={referralLink} label={t('copy')} />
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {t('shareInstructions')}
            </p>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Total Invited */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('totalInvited')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-8 w-8 text-muted-foreground" />
                <span className="text-4xl font-bold">{stats.totalInvited}</span>
              </div>
            </CardContent>
          </Card>

          {/* Total Converted */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('totalConverted')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <span className="text-4xl font-bold">{stats.totalConverted}</span>
              </div>
            </CardContent>
          </Card>

          {/* Credits Earned */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('creditsEarned')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Gift className="h-8 w-8 text-purple-500" />
                <span className="text-4xl font-bold">{stats.creditsEarned}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>{t('howItWorksTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Badge className="shrink-0">1</Badge>
              <p className="text-muted-foreground">{t('step1')}</p>
            </div>
            <div className="flex gap-3">
              <Badge className="shrink-0">2</Badge>
              <p className="text-muted-foreground">{t('step2')}</p>
            </div>
            <div className="flex gap-3">
              <Badge className="shrink-0">3</Badge>
              <p className="text-muted-foreground">{t('step3')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
