'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

interface UserProfile {
  tier: 'free' | 'premium';
  credit_balance: number;
  subscription_status?: 'active' | 'past_due' | 'cancelled' | 'none';
}

interface BillingSettingsProps {
  locale: string;
}

export function BillingSettings({ locale }: BillingSettingsProps) {
  const t = useTranslations('Billing');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        throw new Error('Failed to fetch profile');
      }
      const data = await res.json();
      setProfile({
        tier: data.user.tier || 'free',
        credit_balance: data.user.credit_balance || 0,
        subscription_status: data.user.subscription_status || 'none',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error(t('fetchError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await apiFetch('/api/billing/portal', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create portal session');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      toast.error(error instanceof Error ? error.message : t('portalError'));
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('noProfile')}
      </div>
    );
  }

  const tierDisplay = profile.tier === 'premium' ? t('tierPremium') : t('tierFree');
  const statusDisplay = profile.subscription_status === 'active'
    ? t('statusActive')
    : profile.subscription_status === 'past_due'
    ? t('statusPastDue')
    : profile.subscription_status === 'cancelled'
    ? t('statusCancelled')
    : t('statusNone');

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{t('currentPlan')}</h3>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{tierDisplay}</span>
              {profile.tier === 'premium' && (
                <Badge variant="default">{t('premium')}</Badge>
              )}
            </div>
            {profile.subscription_status && profile.subscription_status !== 'none' && (
              <p className="text-sm text-muted-foreground">
                {t('status')}: <span className={
                  profile.subscription_status === 'past_due'
                    ? 'text-destructive font-medium'
                    : 'text-foreground'
                }>{statusDisplay}</span>
              </p>
            )}
          </div>
          {profile.tier === 'free' && (
            <Button asChild>
              <a href={`/${locale}/pricing`}>{t('upgradeToPremium')}</a>
            </Button>
          )}
        </div>
      </div>

      {/* Credits & Manage Billing — Premium only */}
      {profile.tier === 'premium' && (
        <>
          <Separator />

          {/* Credits */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{t('credits')}</h3>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-2xl font-bold">{profile.credit_balance}</p>
                <p className="text-sm text-muted-foreground">{t('creditsAvailable')}</p>
              </div>
              <Button variant="outline" asChild>
                <a href={`/${locale}/pricing#credits`}>{t('buyMoreCredits')}</a>
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Manage Billing */}
      {profile.tier === 'premium' && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{t('manageBilling')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('manageBillingDescription')}
            </p>
            <Button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="w-full md:w-auto"
            >
              {portalLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('openBillingPortal')}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
