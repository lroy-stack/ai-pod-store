'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

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

export function ProfileForm({ locale }: ProfileFormProps) {
  const t = useTranslations('Profile');
  const router = useRouter();
  const pathname = usePathname();

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
  });

  // Fetch user profile on mount
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

      // If locale changed, redirect to new locale
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-destructive">{t('errorLoading')}</div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar Upload Area */}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name || 'Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                className="w-12 h-12 text-muted-foreground"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            )}
          </div>
        </div>
        <button
          type="button"
          className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {t('uploadAvatar')}
        </button>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
            {t('name')}
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            placeholder={t('namePlaceholder')}
          />
        </div>

        {/* Email Field (Read-only) */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
            {t('email')}
          </label>
          <input
            type="email"
            id="email"
            value={profile.email}
            disabled
            className="w-full px-3 py-2 border border-border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
          />
          {profile.email_verified && (
            <p className="mt-1 text-xs text-success">{t('emailVerified')}</p>
          )}
        </div>

        {/* Phone Field */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">
            {t('phone')}
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            placeholder={t('phonePlaceholder')}
          />
        </div>

        {/* Locale Field */}
        <div>
          <label htmlFor="locale" className="block text-sm font-medium text-foreground mb-1">
            {t('language')}
          </label>
          <select
            id="locale"
            value={formData.locale}
            onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
          </select>
        </div>

        {/* Currency Field */}
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-foreground mb-1">
            {t('currency')}
          </label>
          <select
            id="currency"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-md bg-success/10 text-success text-sm">
          {success}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={saving}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? t('saving') : t('saveChanges')}
      </button>
    </form>
  );
}
