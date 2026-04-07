'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Mail, Phone, Globe, DollarSign, Bell, Loader2, Pencil, X } from 'lucide-react';
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
import { apiFetch } from '@/lib/api-fetch';

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
    email?: boolean;
    push?: boolean;
    sms?: boolean;
    marketing_emails?: boolean;
    product_announcements?: boolean;
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

  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email change state
  const [emailEditing, setEmailEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailChanging, setEmailChanging] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    locale: locale || 'en',
    currency: 'EUR',
    notification_preferences: {
      marketing_emails: true,
      product_announcements: true,
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
          currency: data.profile.currency || 'EUR',
          notification_preferences: {
            marketing_emails: data.profile.notification_preferences?.marketing_emails ?? true,
            product_announcements: data.profile.notification_preferences?.product_announcements ?? true,
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('avatarInvalidType'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('avatarTooLarge'));
      return;
    }

    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);

      const response = await apiFetch('/api/profile/avatar', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      setProfile((prev) => prev ? { ...prev, avatar_url: data.avatar_url } : prev);
      toast.success(t('avatarUpdated'));
    } catch (err) {
      toast.error(t('avatarUploadError'));
    } finally {
      setAvatarUploading(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail || !emailPassword) {
      toast.error(t('emailPasswordRequired'));
      return;
    }

    setEmailChanging(true);
    try {
      const response = await apiFetch('/api/profile/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newEmail, password: emailPassword }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error?.includes('incorrect') || data.error?.includes('Password')) {
          toast.error(t('emailPasswordIncorrect'));
        } else {
          toast.error(data.error || t('emailChangeError'));
        }
        return;
      }

      setEmailSent(true);
      setEmailPassword('');
      toast.success(t('emailConfirmationSent'));
    } catch (err) {
      toast.error(t('emailChangeError'));
    } finally {
      setEmailChanging(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await apiFetch('/api/user/profile', {
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
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={avatarUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarUploading && <Loader2 className="size-4 animate-spin" />}
            {t('uploadAvatar')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('avatarRequirements')}</p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleAvatarChange}
        />
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

      {/* Email — read-only with change option */}
      <div className="space-y-2">
        <Label htmlFor="email" className="flex items-center gap-1.5">
          <Mail className="size-3.5" />
          {t('email')}
        </Label>
        <div className="flex gap-2">
          <Input
            id="email"
            type="email"
            value={profile.email}
            disabled
            className="bg-muted flex-1"
          />
          {!emailEditing && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                setEmailEditing(true);
                setEmailSent(false);
                setNewEmail('');
                setEmailPassword('');
              }}
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
        {profile.email_verified && !emailEditing && (
          <p className="text-xs text-success">{t('emailVerified')}</p>
        )}

        {emailEditing && !emailSent && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t('newEmailPlaceholder')}
            />
            <Input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder={t('currentPasswordPlaceholder')}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={emailChanging || !newEmail || !emailPassword}
                onClick={handleEmailChange}
              >
                {emailChanging && <Loader2 className="size-4 animate-spin" />}
                {t('sendConfirmation')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEmailEditing(false);
                  setNewEmail('');
                  setEmailPassword('');
                }}
              >
                <X className="size-4" />
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}

        {emailSent && (
          <div className="rounded-md bg-success/10 p-3 text-sm text-success">
            {t('emailConfirmationSent')}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={() => {
                setEmailEditing(false);
                setEmailSent(false);
              }}
            >
              {t('dismiss')}
            </Button>
          </div>
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
        <p className="text-xs text-muted-foreground">
          {t('notificationPreferencesHint') || 'Order updates (confirmation, shipping, delivery) are always sent.'}
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="marketing-emails" className="font-normal">
                {t('marketingEmails') || 'Marketing emails'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('marketingEmailsHint') || 'Newsletter, promotions, and exclusive offers'}
              </p>
            </div>
            <Switch
              id="marketing-emails"
              checked={formData.notification_preferences.marketing_emails ?? true}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  notification_preferences: {
                    ...formData.notification_preferences,
                    marketing_emails: checked,
                  },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="product-announcements" className="font-normal">
                {t('productAnnouncements') || 'Product announcements'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('productAnnouncementsHint') || 'New drops, limited editions, and restocks'}
              </p>
            </div>
            <Switch
              id="product-announcements"
              checked={formData.notification_preferences.product_announcements ?? true}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  notification_preferences: {
                    ...formData.notification_preferences,
                    product_announcements: checked,
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
