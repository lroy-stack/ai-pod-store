'use client'

import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm'
import { PlanCard } from '@/components/profile/PlanCard'
import { RecentOrdersPreview } from '@/components/profile/RecentOrdersPreview'
import { PaymentMethodsList } from '@/components/profile/PaymentMethodsList'
import { ShippingAddressList } from '@/components/profile/ShippingAddressList'
import { DataExportSection } from '@/components/profile/DataExportSection'
import { DeleteAccountSection } from '@/components/profile/DeleteAccountSection'

interface ProfilePageClientProps {
  locale: string
}

export function ProfilePageClient({ locale }: ProfilePageClientProps) {
  const t = useTranslations('Profile')
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'account'

  return (
    <div className="py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-0 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="account" className="flex-1">
              {t('tabAccount')}
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex-1">
              {t('tabOrders')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              {t('tabSettings')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6 mt-6">
            <Card>
              <CardContent className="pt-6">
                <ProfileForm locale={locale} />
              </CardContent>
            </Card>
            <ChangePasswordForm />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6 mt-6">
            <RecentOrdersPreview />
            <PlanCard />
            <PaymentMethodsList />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardContent className="pt-6">
                <ShippingAddressList />
              </CardContent>
            </Card>
            <DataExportSection />
            <DeleteAccountSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
