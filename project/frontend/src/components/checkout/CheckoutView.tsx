'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, ArrowLeft, MapPin, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPrice } from '@/lib/currency'
import { useState, useEffect } from 'react'
import AddressForm, { AddressFormData } from './AddressForm'
import CheckoutBreadcrumb from './CheckoutBreadcrumb'

interface ShippingAddress {
  id: string
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

export default function CheckoutView({ locale }: { locale: string }) {
  const t = useTranslations('Checkout')
  const tCart = useTranslations('Cart')
  const { user, authenticated } = useAuth()
  const { items: cartItems, loading } = useCart()
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)
  const [calculatedTax, setCalculatedTax] = useState<number | null>(null)
  const [calculatingTax, setCalculatingTax] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [guestEmail, setGuestEmail] = useState('')
  const [guestEmailError, setGuestEmailError] = useState('')

  // Get user's preferred currency, fallback to locale default
  const userCurrency = user?.currency || (locale === 'es' || locale === 'de' ? 'EUR' : 'USD')

  const cartTotal = cartItems.reduce((total, item) => total + (item.product_price * item.quantity), 0)
  const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0)

  // Fetch saved addresses for authenticated users
  useEffect(() => {
    if (authenticated && user) {
      fetchAddresses()
    }
  }, [authenticated, user])

  const fetchAddresses = async () => {
    setLoadingAddresses(true)
    try {
      const response = await fetch('/api/shipping-addresses')
      if (response.ok) {
        const data = await response.json()
        setAddresses(data)
        // Auto-select default address
        const defaultAddress = data.find((addr: ShippingAddress) => addr.is_default)
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id)
        }
      }
    } catch (error) {
      console.error('Error fetching addresses:', error)
    } finally {
      setLoadingAddresses(false)
    }
  }

  // Calculate tax when shipping address is selected
  useEffect(() => {
    const calculateTaxForAddress = async () => {
      if (!selectedAddressId || cartItems.length === 0) {
        setCalculatedTax(null)
        return
      }

      const selectedAddress = addresses.find((addr) => addr.id === selectedAddressId)
      if (!selectedAddress) return

      setCalculatingTax(true)
      try {
        // Convert cart items to the format expected by the API
        const formattedCartItems = cartItems.map((item) => ({
          productId: item.product_id,
          name: item.product_name,
          amount: Math.round(item.product_price * 100), // Convert to cents
          quantity: item.quantity,
        }))

        const response = await fetch('/api/checkout/calculate-tax', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cartItems: formattedCartItems,
            shippingAddress: {
              line1: selectedAddress.street_address,
              line2: selectedAddress.street_address_2,
              city: selectedAddress.city,
              state: selectedAddress.state,
              postal_code: selectedAddress.postal_code,
              country: selectedAddress.country_code,
            },
            currency: userCurrency.toLowerCase(),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          // Tax is returned in cents, convert to dollars
          setCalculatedTax(data.tax / 100)
        } else {
          console.error('Tax calculation failed')
          setCalculatedTax(null)
        }
      } catch (error) {
        console.error('Error calculating tax:', error)
        setCalculatedTax(null)
      } finally {
        setCalculatingTax(false)
      }
    }

    calculateTaxForAddress()
  }, [selectedAddressId, addresses, cartItems, userCurrency])

  // Handle address form submission
  const handleAddressSubmit = async (addressData: AddressFormData) => {
    try {
      const response = await fetch('/api/shipping-addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: addressData.label,
          full_name: addressData.full_name,
          street_line1: addressData.street_address,
          street_line2: addressData.street_address_2,
          city: addressData.city,
          state: addressData.state,
          postal_code: addressData.postal_code,
          country_code: addressData.country_code,
          phone: addressData.phone,
          is_default: addressData.is_default,
        }),
      })

      if (response.ok) {
        // Refresh addresses
        await fetchAddresses()
        // Close form
        setShowNewAddressForm(false)
      } else {
        console.error('Failed to save address')
        alert('Failed to save address. Please try again.')
      }
    } catch (error) {
      console.error('Error saving address:', error)
      alert('Failed to save address. Please try again.')
    }
  }

  // Validate guest email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Handle proceeding to Stripe Checkout
  const handleProceedToPayment = async () => {
    // Validate guest email if not authenticated
    if (!authenticated) {
      if (!guestEmail.trim()) {
        setGuestEmailError('Email is required for guest checkout')
        return
      }
      if (!validateEmail(guestEmail)) {
        setGuestEmailError('Please enter a valid email address')
        return
      }
      setGuestEmailError('')
    }

    setCreatingSession(true)
    try {
      const body: any = {
        cartItems,
        locale,
        currency: userCurrency.toLowerCase(),
      }

      // Add guest email if not authenticated
      if (!authenticated && guestEmail) {
        body.customerEmail = guestEmail
      }

      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        // Redirect to Stripe Checkout
        if (data.url) {
          window.location.href = data.url
        }
      } else {
        console.error('Failed to create checkout session')
        alert('Failed to proceed to payment. Please try again.')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to proceed to payment. Please try again.')
    } finally {
      setCreatingSession(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-10 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <div className="size-20 md:size-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <ShoppingCart className="size-10 md:size-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t('emptyCart')}
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('emptyCartDescription')}
          </p>
          <Button asChild size="lg">
            <Link href={`/${locale}/shop`}>
              {t('continueShopping')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <Button variant="ghost" asChild className="mb-4 -ml-2">
          <Link href={`/${locale}/cart`}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Cart
          </Link>
        </Button>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
          {t('title')}
        </h1>
      </div>

      {/* Checkout Breadcrumb */}
      <CheckoutBreadcrumb currentStep="shipping" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping Address Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <MapPin className="size-5" />
                {t('shippingAddress')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {authenticated ? (
                <div className="space-y-4">
                  {loadingAddresses ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-24 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : addresses.length > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('selectAddress')}
                      </p>
                      <div className="space-y-3">
                        {addresses.map((address) => (
                          <div
                            key={address.id}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                              selectedAddressId === address.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => {
                              setSelectedAddressId(address.id)
                              setShowNewAddressForm(false)
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-foreground">
                                    {address.label}
                                  </span>
                                  {address.is_default && (
                                    <Badge variant="secondary" className="text-xs">
                                      {t('default')}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-foreground">{address.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {address.street_address}
                                  {address.street_address_2 && `, ${address.street_address_2}`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {address.city}, {address.state} {address.postal_code}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {address.country_code}
                                </p>
                                {address.phone && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {address.phone}
                                  </p>
                                )}
                              </div>
                              {selectedAddressId === address.id && (
                                <div className="size-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                  <Check className="size-4 text-primary-foreground" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {!showNewAddressForm && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowNewAddressForm(true)
                            setSelectedAddressId(null)
                          }}
                          className="w-full mt-4"
                        >
                          {t('addNewAddress')}
                        </Button>
                      )}
                      {showNewAddressForm && (
                        <div className="mt-4">
                          <AddressForm
                            onSubmit={handleAddressSubmit}
                            onCancel={() => setShowNewAddressForm(false)}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">{t('noSavedAddresses')}</p>
                      {!showNewAddressForm && (
                        <Button
                          onClick={() => setShowNewAddressForm(true)}
                        >
                          {t('addNewAddress')}
                        </Button>
                      )}
                      {showNewAddressForm && (
                        <div className="mt-4 text-left">
                          <AddressForm
                            onSubmit={handleAddressSubmit}
                            onCancel={() => setShowNewAddressForm(false)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('guestCheckoutDescription')}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="guest-email">{t('email')}</Label>
                    <Input
                      id="guest-email"
                      type="email"
                      placeholder="your@email.com"
                      value={guestEmail}
                      onChange={(e) => {
                        setGuestEmail(e.target.value)
                        setGuestEmailError('')
                      }}
                      className={guestEmailError ? 'border-destructive' : ''}
                    />
                    {guestEmailError && (
                      <p className="text-sm text-destructive">{guestEmailError}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('guestCheckoutNote')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Section (placeholder) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Payment Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Payment form (Stripe integration) will be implemented here.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary - Right Side */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-foreground">{t('orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items Count */}
              <div className="text-sm text-muted-foreground">
                {t('items', { count: itemCount })}
              </div>

              <Separator />

              {/* Cart Items */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative size-16 md:size-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <Image
                        src={item.product_image || 'https://via.placeholder.com/150'}
                        alt={item.product_name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-foreground line-clamp-1">
                        {item.product_name}
                      </h3>
                      {item.variant_name && (
                        <p className="text-xs text-muted-foreground">
                          {item.variant_name}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          Qty: {item.quantity}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {formatPrice(item.product_price * item.quantity, locale, userCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Price Summary */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{t('subtotal')}</span>
                  <span className="text-foreground font-medium">
                    {formatPrice(cartTotal, locale, userCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{t('shipping')}</span>
                  <span className="text-muted-foreground text-sm">
                    {t('calculatedAtNextStep')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{t('tax')}</span>
                  {calculatingTax ? (
                    <span className="text-muted-foreground text-sm">Calculating...</span>
                  ) : calculatedTax !== null ? (
                    <span className="text-foreground font-medium">
                      {formatPrice(calculatedTax, locale, userCurrency)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {t('calculatedAtNextStep')}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between">
                <span className="text-lg font-bold text-foreground">{t('total')}</span>
                <span className="text-lg font-bold text-foreground">
                  {formatPrice(
                    cartTotal + (calculatedTax || 0),
                    locale,
                    userCurrency
                  )}
                </span>
              </div>

              <Separator />

              {/* Proceed to Payment Button */}
              <Button
                onClick={handleProceedToPayment}
                disabled={creatingSession || cartItems.length === 0}
                className="w-full"
                size="lg"
              >
                {creatingSession ? 'Processing...' : t('proceedToPayment')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
