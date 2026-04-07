'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Save, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/admin-api'

export default function MessagingPage() {
  const [loading, setLoading] = useState(false)
  const [telegram, setTelegram] = useState({
    enabled: false,
    botToken: '',
    webhookUrl: '',
    chatId: '',
  })
  const [whatsapp, setWhatsapp] = useState({
    enabled: false,
    phoneNumberId: '',
    accessToken: '',
    webhookVerifyToken: '',
    businessAccountId: '',
  })

  // Load existing config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await adminFetch('/api/messaging/config')
        if (response.ok) {
          const data = await response.json()
          if (data.telegram) {
            setTelegram(data.telegram)
          }
          if (data.whatsapp) {
            setWhatsapp(data.whatsapp)
          }
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    }
    loadConfig()
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      // Save to database via API
      const response = await adminFetch('/api/messaging/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram, whatsapp }),
      })

      if (!response.ok) {
        throw new Error('Failed to save configuration')
      }

      toast.success('Messaging configuration saved successfully')
    } catch (error) {
      toast.error('Failed to save configuration')
    } finally {
      setLoading(false)
    }
  }

  const testTelegram = async () => {
    try {
      const response = await adminFetch('/api/messaging/telegram/test', {
        method: 'POST',
      })
      if (response.ok) {
        toast.success('Test message sent to Telegram')
      } else {
        toast.error('Failed to send test message')
      }
    } catch (error) {
      toast.error('Failed to send test message')
    }
  }

  const testWhatsApp = async () => {
    try {
      const response = await adminFetch('/api/messaging/whatsapp/test', {
        method: 'POST',
      })
      if (response.ok) {
        toast.success('Test message sent to WhatsApp')
      } else {
        toast.error('Failed to send test message')
      }
    } catch (error) {
      toast.error('Failed to send test message')
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <span>Messaging</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Messaging Configuration</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Configure Telegram and WhatsApp channels for customer notifications
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
              Save Configuration
            </>
          )}
        </Button>
      </div>

      {/* Telegram Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Telegram Bot</CardTitle>
              <CardDescription>
                Configure Telegram bot for customer notifications and support
              </CardDescription>
            </div>
            <Badge variant={telegram.enabled ? "default" : "outline"}>
              {telegram.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Telegram</Label>
              <p className="text-sm text-muted-foreground">
                Allow customers to receive notifications via Telegram
              </p>
            </div>
            <Switch
              checked={telegram.enabled}
              onCheckedChange={(checked) =>
                setTelegram((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram-token">Bot Token</Label>
            <Input
              id="telegram-token"
              type="password"
              value={telegram.botToken}
              onChange={(e) =>
                setTelegram((prev) => ({ ...prev, botToken: e.target.value }))
              }
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              disabled={!telegram.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Get from @BotFather on Telegram
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram-webhook">Webhook URL</Label>
            <Input
              id="telegram-webhook"
              value={telegram.webhookUrl}
              onChange={(e) =>
                setTelegram((prev) => ({ ...prev, webhookUrl: e.target.value }))
              }
              placeholder="https://yourdomain.com/api/webhooks/telegram"
              disabled={!telegram.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Public URL for receiving Telegram updates
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram-chat">Default Chat ID</Label>
            <Input
              id="telegram-chat"
              value={telegram.chatId}
              onChange={(e) =>
                setTelegram((prev) => ({ ...prev, chatId: e.target.value }))
              }
              placeholder="-1001234567890"
              disabled={!telegram.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Chat ID for admin notifications (optional)
            </p>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              onClick={testTelegram}
              disabled={!telegram.enabled || !telegram.botToken}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Test Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>WhatsApp Business</CardTitle>
              <CardDescription>
                Configure WhatsApp Business API for customer notifications
              </CardDescription>
            </div>
            <Badge variant={whatsapp.enabled ? "default" : "outline"}>
              {whatsapp.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable WhatsApp</Label>
              <p className="text-sm text-muted-foreground">
                Allow customers to receive notifications via WhatsApp
              </p>
            </div>
            <Switch
              checked={whatsapp.enabled}
              onCheckedChange={(checked) =>
                setWhatsapp((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp-phone">Phone Number ID</Label>
            <Input
              id="whatsapp-phone"
              value={whatsapp.phoneNumberId}
              onChange={(e) =>
                setWhatsapp((prev) => ({ ...prev, phoneNumberId: e.target.value }))
              }
              placeholder="123456789012345"
              disabled={!whatsapp.enabled}
            />
            <p className="text-xs text-muted-foreground">
              From Meta Business Suite → WhatsApp → Phone Numbers
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp-token">Access Token</Label>
            <Input
              id="whatsapp-token"
              type="password"
              value={whatsapp.accessToken}
              onChange={(e) =>
                setWhatsapp((prev) => ({ ...prev, accessToken: e.target.value }))
              }
              placeholder="EAAxxxxxxxxx"
              disabled={!whatsapp.enabled}
            />
            <p className="text-xs text-muted-foreground">
              WhatsApp Business API access token
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp-verify">Webhook Verify Token</Label>
            <Input
              id="whatsapp-verify"
              type="password"
              value={whatsapp.webhookVerifyToken}
              onChange={(e) =>
                setWhatsapp((prev) => ({ ...prev, webhookVerifyToken: e.target.value }))
              }
              placeholder="your-secure-verify-token"
              disabled={!whatsapp.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Custom token for webhook verification
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp-business">Business Account ID</Label>
            <Input
              id="whatsapp-business"
              value={whatsapp.businessAccountId}
              onChange={(e) =>
                setWhatsapp((prev) => ({ ...prev, businessAccountId: e.target.value }))
              }
              placeholder="123456789012345"
              disabled={!whatsapp.enabled}
            />
            <p className="text-xs text-muted-foreground">
              WhatsApp Business Account ID (optional)
            </p>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              onClick={testWhatsApp}
              disabled={!whatsapp.enabled || !whatsapp.accessToken}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Test Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            Quick guide to configure messaging channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Telegram Setup:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Create a bot via @BotFather on Telegram</li>
              <li>Copy the bot token provided by BotFather</li>
              <li>Set webhook URL to your domain: /api/webhooks/telegram</li>
              <li>Enable the toggle above and save configuration</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold mb-2">WhatsApp Setup:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Register at Meta Business Suite (business.facebook.com)</li>
              <li>Add WhatsApp Business API product</li>
              <li>Create a phone number and get Phone Number ID</li>
              <li>Generate an access token in App Dashboard</li>
              <li>Configure webhook URL: /api/webhooks/whatsapp</li>
              <li>Enable the toggle above and save configuration</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
