import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function TermsOfServicePage() {
  const t = useTranslations('terms');

  const sections = [
    {
      key: 'acceptance',
      icon: '✅',
    },
    {
      key: 'services',
      icon: '🛍️',
    },
    {
      key: 'userAccounts',
      icon: '👤',
    },
    {
      key: 'intellectualProperty',
      icon: '©️',
    },
    {
      key: 'ordersAndPayments',
      icon: '💳',
    },
    {
      key: 'prohibitedUses',
      icon: '🚫',
    },
    {
      key: 'limitationOfLiability',
      icon: '⚠️',
    },
    {
      key: 'termination',
      icon: '🔚',
    },
    {
      key: 'governingLaw',
      icon: '⚖️',
    },
    {
      key: 'contact',
      icon: '📧',
    },
  ];

  return (
    <div className="min-h-screen bg-background py-8 px-4 md:py-12 md:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg">
            {t('lastUpdated')}: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Introduction */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">{t('intro.title')}</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm md:prose-base max-w-none">
            <p className="text-foreground leading-relaxed">{t('intro.content')}</p>
          </CardContent>
        </Card>

        {/* Sections */}
        {sections.map((section, index) => (
          <div key={section.key}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl md:text-2xl">
                  <span className="text-2xl">{section.icon}</span>
                  {t(`${section.key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-foreground leading-relaxed">
                  {t(`${section.key}.content`)}
                </p>
                {/* Check if there are list items */}
                {t.has(`${section.key}.items.0`) && (
                  <ul className="list-disc pl-6 space-y-2 text-foreground">
                    {Array.from({ length: 10 }).map((_, i) => {
                      if (t.has(`${section.key}.items.${i}`)) {
                        return (
                          <li key={i} className="leading-relaxed">
                            {t(`${section.key}.items.${i}`)}
                          </li>
                        );
                      }
                      return null;
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
            {index < sections.length - 1 && <Separator className="my-6" />}
          </div>
        ))}

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
  );
}
