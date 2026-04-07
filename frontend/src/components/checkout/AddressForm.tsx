'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'
import { LOCALE_COUNTRY, STORE_DEFAULTS } from '@/lib/store-config'

interface AddressFormProps {
  onSubmit: (address: AddressFormData) => Promise<void>
  onCancel: () => void
}

export interface AddressFormData {
  label: string
  full_name: string
  street_address: string
  street_address_2?: string
  city: string
  state: string
  postal_code: string
  country_code: string
  phone?: string
  is_default: boolean
}

interface FormErrors {
  label?: string
  full_name?: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  country_code?: string
}

export default function AddressForm({ onSubmit, onCancel }: AddressFormProps) {
  const t = useTranslations('Checkout')
  const params = useParams()
  const locale = (params?.locale as string) || 'en'

  const [formData, setFormData] = useState<AddressFormData>({
    label: '',
    full_name: '',
    street_address: '',
    street_address_2: '',
    city: '',
    state: '',
    postal_code: '',
    country_code: LOCALE_COUNTRY[locale] || STORE_DEFAULTS.country,
    phone: '',
    is_default: false,
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.label.trim()) {
      newErrors.label = t('validation.labelRequired')
    }
    if (!formData.full_name.trim()) {
      newErrors.full_name = t('validation.fullNameRequired')
    }
    if (!formData.street_address.trim()) {
      newErrors.street_address = t('validation.streetAddressRequired')
    }
    if (!formData.city.trim()) {
      newErrors.city = t('validation.cityRequired')
    }
    if (!formData.state.trim()) {
      newErrors.state = t('validation.stateRequired')
    }
    if (!formData.postal_code.trim()) {
      newErrors.postal_code = t('validation.postalCodeRequired')
    }
    if (!formData.country_code.trim()) {
      newErrors.country_code = t('validation.countryRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Error submitting address:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof AddressFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field when user types
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border-2 border-primary rounded-lg bg-primary/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">{t('newAddress')}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="size-8 p-0"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="label">
          {t('addressLabel')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="label"
          value={formData.label}
          onChange={(e) => handleChange('label', e.target.value)}
          placeholder={t('addressLabelPlaceholder')}
          className={errors.label ? 'border-destructive' : ''}
        />
        {errors.label && (
          <p className="text-sm text-destructive">{errors.label}</p>
        )}
      </div>

      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="full_name">
          {t('fullName')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="full_name"
          autoComplete="name"
          value={formData.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          placeholder={t('fullNamePlaceholder')}
          className={errors.full_name ? 'border-destructive' : ''}
        />
        {errors.full_name && (
          <p className="text-sm text-destructive">{errors.full_name}</p>
        )}
      </div>

      {/* Street Address */}
      <div className="space-y-2">
        <Label htmlFor="street_address">
          {t('streetAddress')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="street_address"
          autoComplete="street-address"
          value={formData.street_address}
          onChange={(e) => handleChange('street_address', e.target.value)}
          placeholder={t('streetAddressPlaceholder')}
          className={errors.street_address ? 'border-destructive' : ''}
        />
        {errors.street_address && (
          <p className="text-sm text-destructive">{errors.street_address}</p>
        )}
      </div>

      {/* Street Address 2 (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="street_address_2">{t('streetAddress2')}</Label>
        <Input
          id="street_address_2"
          autoComplete="address-line2"
          value={formData.street_address_2}
          onChange={(e) => handleChange('street_address_2', e.target.value)}
          placeholder={t('streetAddress2Placeholder')}
        />
      </div>

      {/* City and State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">
            {t('city')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="city"
            autoComplete="address-level2"
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder={t('cityPlaceholder')}
            className={errors.city ? 'border-destructive' : ''}
          />
          {errors.city && (
            <p className="text-sm text-destructive">{errors.city}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">
            {t('state')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="state"
            autoComplete="address-level1"
            value={formData.state}
            onChange={(e) => handleChange('state', e.target.value)}
            placeholder={t('statePlaceholder')}
            className={errors.state ? 'border-destructive' : ''}
          />
          {errors.state && (
            <p className="text-sm text-destructive">{errors.state}</p>
          )}
        </div>
      </div>

      {/* Postal Code and Country */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postal_code">
            {t('postalCode')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="postal_code"
            autoComplete="postal-code"
            inputMode="numeric"
            value={formData.postal_code}
            onChange={(e) => handleChange('postal_code', e.target.value)}
            placeholder={t('postalCodePlaceholder')}
            className={errors.postal_code ? 'border-destructive' : ''}
          />
          {errors.postal_code && (
            <p className="text-sm text-destructive">{errors.postal_code}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="country_code">
            {t('country')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="country_code"
            autoComplete="country"
            value={formData.country_code}
            onChange={(e) => handleChange('country_code', e.target.value)}
            placeholder={t('countryPlaceholder')}
            className={errors.country_code ? 'border-destructive' : ''}
            maxLength={2}
          />
          {errors.country_code && (
            <p className="text-sm text-destructive">{errors.country_code}</p>
          )}
        </div>
      </div>

      {/* Phone (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder={t('phonePlaceholder')}
        />
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1"
        >
          {loading ? t('saving') : t('saveAddress')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}
