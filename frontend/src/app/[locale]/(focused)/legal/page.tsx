import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchLegalSettings } from '@/lib/legal-utils'
import { CONTACT } from '@/lib/store-config'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ExternalLink, Mail, Scale, Building2, Shield } from 'lucide-react'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'legalNotice' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function LegalNoticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'legalNotice' })

  // Fetch legal settings from database
  const settings = await fetchLegalSettings()

  // Use fallback values if settings not available
  const companyName = settings?.company_name ?? 'Company Name Not Set'
  const companyAddress = settings?.company_address ?? 'Address Not Set'
  const taxId = settings?.tax_id ?? 'Not Set'
  const tradeRegisterCourt = settings?.trade_register_court ?? ''
  const tradeRegisterNumber = settings?.trade_register_number ?? ''
  const dpoName = settings?.dpo_name ?? ''
  const dpoEmail = settings?.dpo_email ?? ''
  const companyEmail = settings?.company_email ?? CONTACT.general

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

        {/* Company Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('sections.company.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {t('sections.company.companyName')}
              </h3>
              <p className="text-foreground font-medium">{companyName}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {t('sections.company.address')}
              </h3>
              <p className="text-foreground whitespace-pre-line">{companyAddress}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {t('sections.company.contact')}
              </h3>
              <a
                href={`mailto:${companyEmail}`}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <Mail className="h-4 w-4" />
                {companyEmail}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Tax and Registration Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              {t('sections.registration.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {t('sections.registration.taxId')}
              </h3>
              <p className="text-foreground font-mono">{taxId}</p>
            </div>

            {tradeRegisterCourt && tradeRegisterNumber && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {t('sections.registration.tradeRegister')}
                </h3>
                <p className="text-foreground">
                  {tradeRegisterCourt}, {t('sections.registration.registerNumber')}{' '}
                  {tradeRegisterNumber}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Protection Officer (only if configured) */}
        {dpoName && dpoEmail && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('sections.dpo.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {t('sections.dpo.name')}
                </h3>
                <p className="text-foreground">{dpoName}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {t('sections.dpo.contact')}
                </h3>
                <a
                  href={`mailto:${dpoEmail}`}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Mail className="h-4 w-4" />
                  {dpoEmail}
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* EU Online Dispute Resolution */}
        <Card className="mb-6 bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <ExternalLink className="h-5 w-5" />
              {t('sections.disputeResolution.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t('sections.disputeResolution.description')}
            </p>
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1 text-sm font-medium"
            >
              https://ec.europa.eu/consumers/odr
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              {t('footer')}{' '}
              <Link href={`/${locale}/privacy`} className="text-primary hover:underline">
                {t('privacyPolicyLink')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
