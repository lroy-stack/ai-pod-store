import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { CookieSettingsButton } from '@/components/gdpr/CookieSettingsButton'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'cookiePolicy' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function CookiesPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'cookiePolicy' })

  return (
    <div className="min-h-screen bg-background py-8 px-4 md:py-12 md:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg">
            {t('description')}
          </p>
        </div>

        {/* Cookie Settings Button */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  {t('managePreferences.title')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('managePreferences.description')}
                </p>
              </div>
              <CookieSettingsButton />
            </div>
          </CardContent>
        </Card>

        {/* What Are Cookies */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-4">
              {t('whatAreCookies.title')}
            </h2>
            <p className="text-foreground leading-relaxed mb-4">
              {t('whatAreCookies.description')}
            </p>
          </CardContent>
        </Card>

        {/* Cookie Categories */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-4">
              {t('categories.title')}
            </h2>

            {/* Necessary Cookies */}
            <div className="mb-6">
              <h3 className="text-lg md:text-xl font-medium text-foreground mb-2">
                {t('categories.necessary.title')}
              </h3>
              <p className="text-muted-foreground mb-3">
                {t('categories.necessary.description')}
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="font-medium">{t('table.name')}</span>
                  <span className="font-medium">{t('table.purpose')}</span>
                  <span className="font-medium">{t('table.duration')}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-mono text-xs md:text-sm">cookie_consent</span>
                  <span className="text-muted-foreground text-xs md:text-sm flex-1 px-2 md:px-4">
                    {t('cookies.cookie_consent.purpose')}
                  </span>
                  <span className="text-muted-foreground text-xs md:text-sm">
                    {t('cookies.cookie_consent.duration')}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-mono text-xs md:text-sm">session_id</span>
                  <span className="text-muted-foreground text-xs md:text-sm flex-1 px-2 md:px-4">
                    {t('cookies.session_id.purpose')}
                  </span>
                  <span className="text-muted-foreground text-xs md:text-sm">
                    {t('cookies.session_id.duration')}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-mono text-xs md:text-sm">locale</span>
                  <span className="text-muted-foreground text-xs md:text-sm flex-1 px-2 md:px-4">
                    {t('cookies.locale.purpose')}
                  </span>
                  <span className="text-muted-foreground text-xs md:text-sm">
                    {t('cookies.locale.duration')}
                  </span>
                </div>
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="mb-6">
              <h3 className="text-lg md:text-xl font-medium text-foreground mb-2">
                {t('categories.analytics.title')}
              </h3>
              <p className="text-muted-foreground mb-3">
                {t('categories.analytics.description')}
              </p>
              <p className="text-sm text-muted-foreground italic">
                {t('categories.analytics.noCookies')}
              </p>
            </div>

            {/* Marketing Cookies */}
            <div className="mb-6">
              <h3 className="text-lg md:text-xl font-medium text-foreground mb-2">
                {t('categories.marketing.title')}
              </h3>
              <p className="text-muted-foreground mb-3">
                {t('categories.marketing.description')}
              </p>
              <p className="text-sm text-muted-foreground italic">
                {t('categories.marketing.noCookies')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Third-Party Cookies */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-4">
              {t('thirdParty.title')}
            </h2>
            <p className="text-foreground leading-relaxed mb-4">
              {t('thirdParty.description')}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-foreground">
              <li>
                <strong>Stripe</strong> - {t('thirdParty.providers.stripe')}
              </li>
              <li>
                <strong>Supabase</strong> - {t('thirdParty.providers.supabase')}
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* How to Manage Cookies */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-4">
              {t('howToManage.title')}
            </h2>
            <p className="text-foreground leading-relaxed mb-4">
              {t('howToManage.description')}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-foreground">
              <li>{t('howToManage.methods.settings')}</li>
              <li>{t('howToManage.methods.browser')}</li>
              <li>{t('howToManage.methods.optOut')}</li>
            </ul>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              {t('footer')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
