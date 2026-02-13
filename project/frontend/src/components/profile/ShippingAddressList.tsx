'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AddressForm } from './AddressForm';

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

export function ShippingAddressList() {
  const t = useTranslations('Profile');
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await fetch('/api/shipping-addresses');
      if (!response.ok) {
        throw new Error('Failed to fetch addresses');
      }
      const data = await response.json();
      setAddresses(data);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error(t('errorFetchingAddresses'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDeleteAddress'))) {
      return;
    }

    try {
      const response = await fetch(`/api/shipping-addresses/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete address');
      }

      toast.success(t('addressDeleted'));
      fetchAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error(t('errorDeletingAddress'));
    }
  };

  const handleSetDefault = async (id: string) => {
    const address = addresses.find((a) => a.id === id);
    if (!address) return;

    try {
      const response = await fetch(`/api/shipping-addresses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...address,
          is_default: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set default address');
      }

      toast.success(t('defaultAddressSet'));
      fetchAddresses();
    } catch (error) {
      console.error('Error setting default address:', error);
      toast.error(t('errorSettingDefault'));
    }
  };

  const handleFormSuccess = () => {
    setShowAddForm(false);
    setEditingAddress(null);
    fetchAddresses();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('shippingAddresses')}</h3>
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  if (showAddForm || editingAddress) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {editingAddress ? t('editAddress') : t('addNewAddress')}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddForm(false);
              setEditingAddress(null);
            }}
          >
            {t('cancel')}
          </Button>
        </div>
        <AddressForm
          address={editingAddress || undefined}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowAddForm(false);
            setEditingAddress(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('shippingAddresses')}</h3>
        <Button onClick={() => setShowAddForm(true)} size="sm">
          {t('addAddress')}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              {t('noAddresses')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {address.label || t('address')}
                    </CardTitle>
                    {address.is_default && (
                      <Badge variant="default">{t('default')}</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAddress(address)}
                    >
                      {t('edit')}
                    </Button>
                    {!address.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(address.id)}
                      >
                        {t('setDefault')}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(address.id)}
                    >
                      {t('delete')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  {address.full_name && (
                    <p className="font-medium">{address.full_name}</p>
                  )}
                  <p>{address.street_line1}</p>
                  {address.street_line2 && <p>{address.street_line2}</p>}
                  <p>
                    {address.city}
                    {address.state && `, ${address.state}`} {address.postal_code}
                  </p>
                  <p>{address.country_code}</p>
                  {address.phone && <p className="text-muted-foreground">{address.phone}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
