'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Globe, DollarSign, Bell, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

interface ProfileFormProps {
  locale: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  locale: string;
  currency: string;
  phone?: string;
  email_verified: boolean;
  notification_preferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col items-center md:items-start gap-4">
        <div className="size-20 rounded-full bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-9 rounded-md bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-9 rounded-md bg-muted" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-9 rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-9 rounded-md bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-9 rounded-md bg-muted" />
        </div>
      </div>
      <div className="h-px bg-muted" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-5 w-8 rounded-full bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-9 rounded-md bg-muted" />
    </div>
  );
}

export function ProfileForm({ locale }: ProfileFormProps) {
  const t = useTranslations('Profile');
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    locale: locale || 'en',
    currency: 'USD',
    notification_preferences: {
      email: true,
      push: true,
      sms: false,
    },
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);

        const response = await fetch('/api/user/profile', {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push(`/${locale}/auth/login?returnUrl=${encodeURIComponent(`/${locale}/profile`)}`);
            return;
          }
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        setProfile(data.profile);
        setFormData({
          name: data.profile.name || '',
          phone: data.profile.phone || '',
          locale: data.profile.locale || locale,
          currency: data.profile.currency || 'USD',
          notification_preferences: data.profile.notification_preferences || {
            email: true,
            push: true,
            sms: false,
          },
        });
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(t('errorLoading'));
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [locale, router, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/${locale}/auth/login?returnUrl=${encodeURIComponent(`/${locale}/profile`)}`);
          return;
        }
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      setProfile(data.profile);
      setSuccess(t('successMessage'));

      const newLocale = data.profile.locale?.trim();
      const currentLocale = locale?.trim();

      if (newLocale && currentLocale && newLocale !== currentLocale) {
        setTimeout(() => {
          router.push(`/${newLocale}/profile`);
        }, 1000);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(t('errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!profile) {
    return (
      <div className="text-destructive">{t('errorLoading')}</div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar */}
      <div className="flex flex-col items-center md:flex-row md:items-center gap-4">
        <Avatar className="size-20">
          {profile.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={profile.name || 'Avatar'} />
          ) : null}
          <AvatarFallback className="text-lg">
            {profile.name ? getInitials(profile.name) : <User className="size-8" />}
          </AvatarFallback>
        </Avatar>
        <Button type="button" variant="outline" size="sm" disabled>
          {t('uploadAvatar')}
        </Button>
      </div>

      <Separator />

      {/* Name + Phone — side by side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-1.5">
            <User className="size-3.5" />
            {t('name')}
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t('namePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-1.5">
            <Phone className="size-3.5" />
            {t('phone')}
          </Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder={t('phonePlaceholder')}
          />
        </div>
      </div>

      {/* Email — full width, read-only */}
      <div className="space-y-2">
        <Label htmlFor="email" className="flex items-center gap-1.5">
          <Mail className="size-3.5" />
          {t('email')}
        </Label>
        <Input
          id="email"
          type="email"
          value={profile.email}
          disabled
          className="bg-muted"
        />
        {profile.email_verified && (
          <p className="text-xs text-success">{t('emailVerified')}</p>
        )}
      </div>

      {/* Language + Currency — side by side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Globe className="size-3.5" />
            {t('language')}
          </Label>
          <Select
            value={formData.locale}
            onValueChange={(value) => setFormData({ ...formData, locale: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <DollarSign className="size-3.5" />
            {t('currency')}
          </Label>
          <Select
            value={formData.currency}
            onValueChange={(value) => setFormData({ ...formData, currency: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Notification Preferences */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Bell className="size-3.5" />
          {t('notificationPreferences')}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifications" className="font-normal">
              {t('emailNotifications')}
            </Label>
            <Switch
              id="email-notifications"
              checked={formData.notification_preferences.email}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  notification_preferences: {
                    ...formData.notification_preferences,
                    email: checked,
                  },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="push-notifications" className="font-normal">
              {t('pushNotifications')}
            </Label>
            <Switch
              id="push-notifications"
              checked={formData.notification_preferences.push}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  notification_preferences: {
                    ...formData.notification_preferences,
                    push: checked,
                  },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sms-notifications" className="font-normal">
              {t('smsNotifications')}
            </Label>
            <Switch
              id="sms-notifications"
              checked={formData.notification_preferences.sms}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  notification_preferences: {
                    ...formData.notification_preferences,
                    sms: checked,
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-success/10 p-3 text-sm text-success">
          {success}
        </div>
      )}

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t('saving')}
          </>
        ) : (
          t('saveChanges')
        )}
      </Button>
    </form>
  );
}
