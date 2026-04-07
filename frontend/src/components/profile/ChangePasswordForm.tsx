'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { apiFetch } from '@/lib/api-fetch';

interface ChangePasswordFormProps {
  hasPassword?: boolean
}

export function ChangePasswordForm({ hasPassword = true }: ChangePasswordFormProps) {
  const t = useTranslations('Profile');
  const isSetMode = !hasPassword

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validation
    if (!isSetMode && !formData.currentPassword) {
      setError(t('errorChangingPassword'));
      return;
    }
    if (!formData.newPassword || !formData.confirmPassword) {
      setError(t('errorChangingPassword'));
      return;
    }

    if (formData.newPassword.length < 8) {
      setError(t('passwordRequirement'));
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setLoading(true);

    try {
      const endpoint = isSetMode ? '/api/profile/set-password' : '/api/profile/change-password'
      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(
          isSetMode
            ? { newPassword: formData.newPassword }
            : { currentPassword: formData.currentPassword, newPassword: formData.newPassword }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes('incorrect')) {
          setError(t('incorrectCurrentPassword'));
        } else {
          setError(data.error || t('errorChangingPassword'));
        }
        return;
      }

      setSuccess(t('passwordChanged'));
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Error changing password:', err);
      setError(t('errorChangingPassword'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
          <Lock className="size-5" />
          {isSetMode ? (t('setPassword') || 'Set Password') : t('changePassword')}
        </CardTitle>
        <CardDescription>
          {isSetMode
            ? (t('setPasswordDescription') || 'You signed in with Google/Apple. Set a password to also log in with email.')
            : t('changePasswordDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password (hidden in set-password mode) */}
          {!isSetMode && <div className="space-y-2">
            <Label htmlFor="currentPassword">
              {t('currentPassword')}
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={formData.currentPassword}
                onChange={(e) =>
                  setFormData({ ...formData, currentPassword: e.target.value })
                }
                placeholder={t('currentPasswordPlaceholder')}
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showCurrentPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>}

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">
              {t('newPassword')}
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) =>
                  setFormData({ ...formData, newPassword: e.target.value })
                }
                placeholder={t('newPasswordPlaceholder')}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNewPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('passwordRequirement')}
            </p>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t('confirmPassword')}
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                placeholder={t('confirmPasswordPlaceholder')}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
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

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('changingPassword')}
              </>
            ) : (
              <>
                <Lock className="size-4" />
                {t('changePasswordButton')}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
