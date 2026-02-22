'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Loader2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    funding: string;
  } | null;
  created: number;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-md bg-muted">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded bg-muted-foreground/20" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-muted-foreground/20" />
              <div className="h-3 w-24 rounded bg-muted-foreground/20" />
            </div>
          </div>
          <div className="h-8 w-16 rounded bg-muted-foreground/20" />
        </div>
      ))}
    </div>
  );
}

function getCardIcon(brand: string) {
  const brandLower = brand.toLowerCase();

  // Return brand name as text icon
  const brandDisplay: Record<string, string> = {
    visa: 'VISA',
    mastercard: 'MC',
    amex: 'AMEX',
    discover: 'DISC',
  };

  return brandDisplay[brandLower] || brand.toUpperCase().slice(0, 4);
}

export function PaymentMethodsList() {
  const t = useTranslations('Profile');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchPaymentMethods() {
      try {
        setLoading(true);

        const response = await fetch('/api/profile/payment-methods', {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            // User not authenticated - this is handled by profile page redirect
            return;
          }
          throw new Error('Failed to fetch payment methods');
        }

        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
      } catch (err) {
        console.error('Error fetching payment methods:', err);
        setError(t('errorLoadingPaymentMethods'));
      } finally {
        setLoading(false);
      }
    }

    fetchPaymentMethods();
  }, [t]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
            <CreditCard className="size-5" />
            {t('paymentMethods')}
          </CardTitle>
          <CardDescription>{t('paymentMethodsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
          <CreditCard className="size-5" />
          {t('paymentMethods')}
        </CardTitle>
        <CardDescription>{t('paymentMethodsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="size-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t('noPaymentMethods')}</p>
            <Button variant="outline" className="mt-4" disabled>
              {t('addPaymentMethod')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md border border-border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-10 rounded bg-primary/10 text-primary text-xs font-bold">
                    {pm.card ? getCardIcon(pm.card.brand) : 'CARD'}
                  </div>
                  <div>
                    <p className="font-medium">
                      {pm.card
                        ? t('cardEndingIn', { last4: pm.card.last4 })
                        : 'Payment Method'}
                    </p>
                    {pm.card && (
                      <p className="text-sm text-muted-foreground">
                        {t('expiresOn', {
                          month: pm.card.exp_month.toString().padStart(2, '0'),
                          year: pm.card.exp_year,
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  {t('removeCard')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
