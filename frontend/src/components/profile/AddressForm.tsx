'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

interface ShippingAddress {
  id: string;
  label?: string;
  full_name?: string;
  street_line1: string;
  street_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country_code: string;
  phone?: string;
  is_default: boolean;
}

interface AddressFormProps {
  address?: ShippingAddress;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddressForm({ address, onSuccess, onCancel }: AddressFormProps) {
  const t = useTranslations('Profile');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    label: address?.label || '',
    full_name: address?.full_name || '',
    street_line1: address?.street_line1 || '',
    street_line2: address?.street_line2 || '',
    city: address?.city || '',
    state: address?.state || '',
    postal_code: address?.postal_code || '',
    country_code: address?.country_code || '',
    phone: address?.phone || '',
    is_default: address?.is_default || false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = address
        ? `/api/shipping-addresses/${address.id}`
        : '/api/shipping-addresses';
      const method = address ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save address');
      }

      toast.success(address ? t('addressUpdated') : t('addressAdded'));
      onSuccess();
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error(
        error instanceof Error ? error.message : t('errorSavingAddress')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="label">{t('addressLabel')}</Label>
          <Input
            id="label"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            placeholder={t('addressLabelPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="full_name">{t('fullName')}</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) =>
              setFormData({ ...formData, full_name: e.target.value })
            }
            placeholder={t('fullNamePlaceholder')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="street_line1">
          {t('streetAddress')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="street_line1"
          value={formData.street_line1}
          onChange={(e) =>
            setFormData({ ...formData, street_line1: e.target.value })
          }
          placeholder={t('streetAddressPlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="street_line2">{t('streetAddress2')}</Label>
        <Input
          id="street_line2"
          value={formData.street_line2}
          onChange={(e) =>
            setFormData({ ...formData, street_line2: e.target.value })
          }
          placeholder={t('streetAddress2Placeholder')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">
            {t('city')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder={t('cityPlaceholder')}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">{t('state')}</Label>
          <Input
            id="state"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            placeholder={t('statePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postal_code">
            {t('postalCode')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="postal_code"
            value={formData.postal_code}
            onChange={(e) =>
              setFormData({ ...formData, postal_code: e.target.value })
            }
            placeholder={t('postalCodePlaceholder')}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country_code">
            {t('countryCode')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="country_code"
            value={formData.country_code}
            onChange={(e) =>
              setFormData({ ...formData, country_code: e.target.value.toUpperCase() })
            }
            placeholder={t('countryCodePlaceholder')}
            maxLength={2}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t('phone')}</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder={t('phonePlaceholder')}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_default"
          checked={formData.is_default}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, is_default: checked === true })
          }
        />
        <Label htmlFor="is_default" className="cursor-pointer">
          {t('setAsDefault')}
        </Label>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? t('saving') : address ? t('updateAddress') : t('addAddress')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
