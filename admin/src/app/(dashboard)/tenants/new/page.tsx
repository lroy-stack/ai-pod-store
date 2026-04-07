'use client'

/**
 * Tenant Creation Wizard
 * Route: /panel/tenants/new
 *
 * 4-step wizard:
 *   Step 1: Name, slug, domain with availability check
 *   Step 2: Branding (logo, colors, fonts)
 *   Step 3: Stripe Connect onboarding
 *   Step 4: Plan selection and activation
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, apiUrl } from '@/lib/admin-api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Building2, Palette, CreditCard, Rocket,
  CheckCircle2, AlertCircle, ChevronRight, ChevronLeft,
  Loader2, Globe,
} from 'lucide-react'

// Step data
interface Step1Data { name: string; slug: string; domain: string }
interface Step2Data { logo_url: string; primary_color: string; secondary_color: string; font_heading: string; font_body: string; store_name: string }
interface Step3Data { stripe_connected_account_id: string }
interface Step4Data { plan: 'free' | 'starter' | 'pro' | 'enterprise' }

const STEPS = [
  { id: 1, label: 'Identity', icon: Building2, desc: 'Name, slug, domain' },
  { id: 2, label: 'Branding', icon: Palette, desc: 'Colors & fonts' },
  { id: 3, label: 'Payments', icon: CreditCard, desc: 'Stripe Connect' },
  { id: 4, label: 'Plan', icon: Rocket, desc: 'Select plan tier' },
]

const PLANS = [
  { id: 'free', label: 'Free', price: '$0/mo', products: '10 products', fee: '10% fee', custom_domain: false },
  { id: 'starter', label: 'Starter', price: '$29/mo', products: '50 products', fee: '5% fee', custom_domain: true },
  { id: 'pro', label: 'Pro', price: '$79/mo', products: '200 products', fee: '3% fee', custom_domain: true },
  { id: 'enterprise', label: 'Enterprise', price: '$249/mo', products: 'Unlimited', fee: '2% fee', custom_domain: true },
]

export default function NewTenantPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step form data
  const [step1, setStep1] = useState<Step1Data>({ name: '', slug: '', domain: '' })
  const [step2, setStep2] = useState<Step2Data>({ logo_url: '', primary_color: '', secondary_color: '', font_heading: '', font_body: '', store_name: '' })
  const [step3, setStep3] = useState<Step3Data>({ stripe_connected_account_id: '' })
  const [step4, setStep4] = useState<Step4Data>({ plan: 'free' })

  // Slug availability check state
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [slugTimer, setSlugTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const autoSlug = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
    setStep1((prev) => ({ ...prev, name, slug: autoSlug }))
    checkSlug(autoSlug)
  }

  const checkSlug = useCallback((slug: string) => {
    if (slugTimer) clearTimeout(slugTimer)
    if (!slug || slug.length < 3) {
      setSlugStatus('idle')
      return
    }
    setSlugStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await adminFetch(`/api/tenants/check-slug?slug=${encodeURIComponent(slug)}`)
        const data = await res.json()
        if (data.reason === 'invalid_format') {
          setSlugStatus('invalid')
        } else {
          setSlugStatus(data.available ? 'available' : 'taken')
        }
      } catch {
        setSlugStatus('idle')
      }
    }, 400)
    setSlugTimer(timer)
  }, [slugTimer])

  const handleSlugChange = (slug: string) => {
    setStep1((prev) => ({ ...prev, slug }))
    checkSlug(slug)
  }

  // Step navigation
  const canAdvanceStep1 = step1.name.trim().length >= 2 && slugStatus === 'available'
  const canAdvanceStep2 = true // Branding is optional
  const canAdvanceStep3 = true // Stripe Connect is optional
  const canAdvanceStep4 = true // Plan defaults to free

  const canAdvance = [
    null,
    canAdvanceStep1,
    canAdvanceStep2,
    canAdvanceStep3,
    canAdvanceStep4,
  ][currentStep]

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep((s) => s + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1)
  }

  const handleCreate = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await adminFetch('/api/tenants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step1, step2, step3, step4 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create tenant')
        return
      }
      // Redirect to tenant billing page
      router.push(apiUrl(`/tenants/${data.tenant_id}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create New Tenant</h1>
        <p className="text-sm text-muted-foreground">
          Set up a new multi-tenant store in 4 steps.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          const isActive = currentStep === step.id
          const isDone = currentStep > step.id
          return (
            <div key={step.id} className="flex items-center gap-1">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isDone
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                {step.label}
              </div>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1: Identity */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Tenant Identity
            </CardTitle>
            <CardDescription>Set up the store name, slug (URL path), and optional custom domain.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Store Name *</Label>
              <Input
                id="name"
                placeholder="My Awesome Store"
                value={step1.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="slug">Slug (URL identifier) *</Label>
              <div className="relative">
                <Input
                  id="slug"
                  placeholder="my-awesome-store"
                  value={step1.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={
                    slugStatus === 'available'
                      ? 'border-green-500 pr-8'
                      : slugStatus === 'taken' || slugStatus === 'invalid'
                      ? 'border-destructive pr-8'
                      : 'pr-8'
                  }
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {slugStatus === 'available' && <CheckCircle2 className="h-4 w-4 text-success" />}
                  {(slugStatus === 'taken' || slugStatus === 'invalid') && <AlertCircle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {slugStatus === 'available' && 'Available ✓'}
                {slugStatus === 'taken' && 'Already taken — choose another slug.'}
                {slugStatus === 'invalid' && 'Invalid format: lowercase letters, numbers, hyphens only, 3–50 chars.'}
                {slugStatus === 'idle' && 'Used in URLs: /tenants/your-slug'}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="domain">Custom Domain (optional)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="domain"
                  placeholder="shop.example.com"
                  value={step1.domain}
                  onChange={(e) => setStep1((prev) => ({ ...prev, domain: e.target.value }))}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Requires Starter plan or higher. Point DNS to this server.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Branding */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Branding Configuration
            </CardTitle>
            <CardDescription>Customize colors and fonts for this tenant. All fields are optional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="store_name">Display Name Override</Label>
              <Input
                id="store_name"
                placeholder="Leave blank to use store name"
                value={step2.store_name}
                onChange={(e) => setStep2((prev) => ({ ...prev, store_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                placeholder="https://example.com/logo.svg"
                value={step2.logo_url}
                onChange={(e) => setStep2((prev) => ({ ...prev, logo_url: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="primary_color">Primary Color</Label>
                <Input
                  id="primary_color"
                  placeholder="oklch(0.55 0.20 245)"
                  value={step2.primary_color}
                  onChange={(e) => setStep2((prev) => ({ ...prev, primary_color: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="secondary_color">Secondary Color</Label>
                <Input
                  id="secondary_color"
                  placeholder="oklch(0.96 0.005 245)"
                  value={step2.secondary_color}
                  onChange={(e) => setStep2((prev) => ({ ...prev, secondary_color: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="font_heading">Heading Font</Label>
                <Input
                  id="font_heading"
                  placeholder="Playfair Display"
                  value={step2.font_heading}
                  onChange={(e) => setStep2((prev) => ({ ...prev, font_heading: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="font_body">Body Font</Label>
                <Input
                  id="font_body"
                  placeholder="Inter"
                  value={step2.font_body}
                  onChange={(e) => setStep2((prev) => ({ ...prev, font_body: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Stripe Connect */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Stripe Connect
            </CardTitle>
            <CardDescription>
              Link a Stripe Connected Account so this tenant receives payments directly.
              Payments will route to their account minus the platform fee.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="stripe_account">Stripe Connected Account ID</Label>
              <Input
                id="stripe_account"
                placeholder="acct_1XXXXXXXXXX (leave blank to skip)"
                value={step3.stripe_connected_account_id}
                onChange={(e) => setStep3({ stripe_connected_account_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Found in your Stripe Dashboard → Connect → Accounts.
                If left blank, all payments go to the platform account.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4 text-xs space-y-1 text-muted-foreground">
              <p className="font-medium text-foreground">How Stripe Connect works:</p>
              <p>• Platform charges buyer using the tenant&apos;s connected account as destination</p>
              <p>• Platform deducts its fee automatically (see Step 4 for rates)</p>
              <p>• Tenant receives remainder directly in their Stripe account</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Plan Selection */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Select Plan
            </CardTitle>
            <CardDescription>Choose the subscription plan for this tenant.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setStep4({ plan: plan.id as Step4Data['plan'] })}
                  className={`text-left p-4 rounded-lg border-2 transition-colors space-y-1 ${
                    step4.plan === plan.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{plan.label}</span>
                    {step4.plan === plan.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="text-primary font-bold">{plan.price}</div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>{plan.products}</div>
                    <div>{plan.fee}</div>
                    <div>{plan.custom_domain ? '✓ Custom domain' : '✗ No custom domain'}</div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {currentStep < 4 ? (
          <Button onClick={handleNext} disabled={!canAdvance}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Create Tenant
              </>
            )}
          </Button>
        )}
      </div>

      {/* Summary preview on last step */}
      {currentStep === 4 && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1 text-muted-foreground">
            <div className="flex justify-between"><span>Name</span><span className="text-foreground font-medium">{step1.name}</span></div>
            <div className="flex justify-between"><span>Slug</span><span className="font-mono text-foreground">{step1.slug}</span></div>
            {step1.domain && <div className="flex justify-between"><span>Domain</span><span className="text-foreground">{step1.domain}</span></div>}
            {step2.primary_color && <div className="flex justify-between"><span>Primary color</span><span className="text-foreground">{step2.primary_color}</span></div>}
            {step3.stripe_connected_account_id && <div className="flex justify-between"><span>Stripe</span><span className="font-mono text-foreground">{step3.stripe_connected_account_id}</span></div>}
            <div className="flex justify-between"><span>Plan</span><Badge variant="outline" className="text-xs capitalize">{step4.plan}</Badge></div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
