'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Settings, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    // PodClaw settings
    podclawEnabled: true,
    podclawBridgeUrl: process.env.NEXT_PUBLIC_PODCLAW_BRIDGE_URL || 'http://localhost:8000',

    // Store settings
    storeName: 'POD AI',
    storeEmail: 'support@podai.com',
    defaultCurrency: 'EUR',
    defaultLocale: 'en',

    // Feature flags
    maintenanceMode: false,
    registrationEnabled: true,
    guestCheckoutEnabled: true,
    reviewsEnabled: true,
    wishlistsEnabled: true,

    // Email settings
    orderConfirmationEmails: true,
    shippingNotificationEmails: true,
    marketingEmails: false,
  })

  const handleSave = async () => {
    setLoading(true)
    try {
      // In a real implementation, this would save to database
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Settings saved successfully')
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (key: string, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <span>Settings</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Settings</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Configure store settings and feature flags
          </p>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* PodClaw Settings */}
      <Card>
        <CardHeader>
          <CardTitle>PodClaw Agent</CardTitle>
          <CardDescription>
            Configure the autonomous store management agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable PodClaw</Label>
              <p className="text-sm text-muted-foreground">
                Allow PodClaw to manage products, marketing, and customer interactions
              </p>
            </div>
            <Switch
              checked={settings.podclawEnabled}
              onCheckedChange={(checked) => handleChange('podclawEnabled', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bridge-url">Bridge URL</Label>
            <Input
              id="bridge-url"
              value={settings.podclawBridgeUrl}
              onChange={(e) => handleChange('podclawBridgeUrl', e.target.value)}
              placeholder="http://localhost:8000"
            />
            <p className="text-xs text-muted-foreground">
              PodClaw FastAPI bridge endpoint
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Store Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
          <CardDescription>
            Basic store configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name</Label>
              <Input
                id="store-name"
                value={settings.storeName}
                onChange={(e) => handleChange('storeName', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-email">Support Email</Label>
              <Input
                id="store-email"
                type="email"
                value={settings.storeEmail}
                onChange={(e) => handleChange('storeEmail', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Input
                id="currency"
                value={settings.defaultCurrency}
                onChange={(e) => handleChange('defaultCurrency', e.target.value)}
                maxLength={3}
              />
              <p className="text-xs text-muted-foreground">ISO 4217 code (e.g., EUR, USD, GBP)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locale">Default Locale</Label>
              <Input
                id="locale"
                value={settings.defaultLocale}
                onChange={(e) => handleChange('defaultLocale', e.target.value)}
                maxLength={2}
              />
              <p className="text-xs text-muted-foreground">ISO 639-1 code (e.g., en, es, de)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>
            Enable or disable platform features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>Maintenance Mode</Label>
                {settings.maintenanceMode && (
                  <Badge variant="outline" className="bg-warning/10 text-warning">
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Show maintenance page to all visitors
              </p>
            </div>
            <Switch
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) => handleChange('maintenanceMode', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>User Registration</Label>
              <p className="text-sm text-muted-foreground">
                Allow new users to create accounts
              </p>
            </div>
            <Switch
              checked={settings.registrationEnabled}
              onCheckedChange={(checked) => handleChange('registrationEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Guest Checkout</Label>
              <p className="text-sm text-muted-foreground">
                Allow purchases without account creation
              </p>
            </div>
            <Switch
              checked={settings.guestCheckoutEnabled}
              onCheckedChange={(checked) => handleChange('guestCheckoutEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Product Reviews</Label>
              <p className="text-sm text-muted-foreground">
                Enable customer product reviews
              </p>
            </div>
            <Switch
              checked={settings.reviewsEnabled}
              onCheckedChange={(checked) => handleChange('reviewsEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Wishlists</Label>
              <p className="text-sm text-muted-foreground">
                Enable wishlist functionality
              </p>
            </div>
            <Switch
              checked={settings.wishlistsEnabled}
              onCheckedChange={(checked) => handleChange('wishlistsEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Configure automated email notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Order Confirmation</Label>
              <p className="text-sm text-muted-foreground">
                Send email when order is placed
              </p>
            </div>
            <Switch
              checked={settings.orderConfirmationEmails}
              onCheckedChange={(checked) => handleChange('orderConfirmationEmails', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Shipping Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send email when order ships with tracking
              </p>
            </div>
            <Switch
              checked={settings.shippingNotificationEmails}
              onCheckedChange={(checked) => handleChange('shippingNotificationEmails', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Send promotional and newsletter emails
              </p>
            </div>
            <Switch
              checked={settings.marketingEmails}
              onCheckedChange={(checked) => handleChange('marketingEmails', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
