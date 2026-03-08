'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

interface ContactFormTranslations {
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  subjectLabel: string
  subjectGeneral: string
  subjectTech: string
  subjectOrder: string
  subjectProduct: string
  subjectPartnership: string
  subjectFeedback: string
  messageLabel: string
  messagePlaceholder: string
  sendButton: string
  sending: string
  successTitle: string
  successDesc: string
  errorTitle: string
  errorDesc: string
  errorFallback: string
}

interface ContactFormProps {
  locale: string
  translations: ContactFormTranslations
}

export function ContactForm({ locale, translations: t }: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general',
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await apiFetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          locale,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(t.successTitle, {
          description: t.successDesc,
        })
        // Reset form
        setFormData({
          name: '',
          email: '',
          subject: 'general',
          message: '',
        })
      } else {
        toast.error(t.errorTitle, {
          description: data.error || t.errorDesc,
        })
      }
    } catch (error) {
      console.error('Contact form error:', error)
      toast.error(t.errorTitle, {
        description: t.errorFallback,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{t.nameLabel}</Label>
          <Input
            id="name"
            type="text"
            placeholder={t.namePlaceholder}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t.emailPlaceholder}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">{t.subjectLabel}</Label>
        <Select
          value={formData.subject}
          onValueChange={(value) => setFormData({ ...formData, subject: value })}
          disabled={isSubmitting}
        >
          <SelectTrigger id="subject">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">{t.subjectGeneral}</SelectItem>
            <SelectItem value="support">{t.subjectTech}</SelectItem>
            <SelectItem value="order">{t.subjectOrder}</SelectItem>
            <SelectItem value="product">{t.subjectProduct}</SelectItem>
            <SelectItem value="partnership">{t.subjectPartnership}</SelectItem>
            <SelectItem value="feedback">{t.subjectFeedback}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{t.messageLabel}</Label>
        <Textarea
          id="message"
          placeholder={t.messagePlaceholder}
          rows={6}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          required
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
        {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
        {isSubmitting ? t.sending : t.sendButton}
      </Button>
    </form>
  )
}
