/**
 * Newsletter Confirmation Email Template
 *
 * Sent after subscribing. Uses centralized emailLayout() for consistent branding.
 * Includes hero product, brand story, social links, and unsubscribe.
 */

import { emailLayout } from '@/lib/email-layout'
import { BASE_URL, EMAIL_PALETTE, BRAND, SOCIAL_LINKS } from '@/lib/store-config'
import { supabaseAdmin } from '@/lib/supabase-admin'

const C = EMAIL_PALETTE
const STORAGE = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const i18n: Record<string, {
  subject: string
  heading: string
  intro: string
  ctaButton: string
  fallbackText: string
  previewHeading: string
  brandStory: string
  followUs: string
  ignoreText: string
}> = {
  en: {
    subject: `Confirm your subscription to ${BRAND.name}`,
    heading: 'One click away',
    intro: 'Thanks for signing up! Confirm your email to start receiving new drops, exclusive offers, and early access to limited editions.',
    ctaButton: 'Confirm Subscription',
    fallbackText: 'Or copy and paste this link:',
    previewHeading: 'A taste of what\'s coming',
    brandStory: 'Unique fashion designed with you, made in Europe. Every piece is made on demand — no waste, no compromise.',
    followUs: 'Follow us',
    ignoreText: 'If you didn\'t request this, you can safely ignore this email.',
  },
  es: {
    subject: `Confirma tu suscripcion a ${BRAND.name}`,
    heading: 'A un clic de distancia',
    intro: 'Gracias por registrarte. Confirma tu email para recibir nuevos lanzamientos, ofertas exclusivas y acceso anticipado a ediciones limitadas.',
    ctaButton: 'Confirmar suscripcion',
    fallbackText: 'O copia y pega este enlace:',
    previewHeading: 'Una muestra de lo que viene',
    brandStory: 'Moda unica disenada contigo, hecha en Europa. Cada prenda se fabrica bajo demanda — sin desperdicios, sin compromisos.',
    followUs: 'Siguenos',
    ignoreText: 'Si no solicitaste esto, puedes ignorar este correo.',
  },
  de: {
    subject: `Bestatige dein Abonnement bei ${BRAND.name}`,
    heading: 'Nur noch ein Klick',
    intro: 'Danke fur deine Anmeldung! Bestatige deine E-Mail, um neue Drops, exklusive Angebote und fruhen Zugang zu limitierten Editionen zu erhalten.',
    ctaButton: 'Abonnement bestatigen',
    fallbackText: 'Oder kopiere diesen Link:',
    previewHeading: 'Ein Vorgeschmack',
    brandStory: 'Einzigartige Mode mit dir gestaltet, hergestellt in Europa. Jedes Stuck wird auf Bestellung gefertigt — kein Abfall, keine Kompromisse.',
    followUs: 'Folge uns',
    ignoreText: 'Wenn du dies nicht angefordert hast, kannst du diese E-Mail ignorieren.',
  },
}

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} \u20AC`
}

interface NewsletterConfirmParams {
  locale: string
  recipientEmail: string
  confirmUrl: string
}

export async function buildNewsletterConfirmEmail({
  locale,
  recipientEmail,
  confirmUrl,
}: NewsletterConfirmParams): Promise<{ subject: string; html: string }> {
  const t = i18n[locale] || i18n.en

  // Fetch 1 best seller for preview
  const { data: featured } = await supabaseAdmin
    .from('products')
    .select('slug, title, base_price_cents, images')
    .eq('status', 'active')
    .order('review_count', { ascending: false })
    .limit(1)
    .single()

  // Extract first image from JSONB
  let featuredImage = ''
  if (featured?.images && Array.isArray(featured.images) && featured.images.length > 0) {
    const first = featured.images[0]
    featuredImage = typeof first === 'string' ? first : first?.src || first?.url || ''
  }
  // Fallback to storage mockup pattern
  if (!featuredImage && featured?.slug) {
    featuredImage = `${STORAGE}/storage/v1/object/public/designs/mockups/${featured.slug}/black-front.png`
  }

  // Social links
  const socials = [
    SOCIAL_LINKS.instagram
      ? `<a href="${SOCIAL_LINKS.instagram}" style="color:${C.accent};font-size:13px;text-decoration:none;font-weight:600;">Instagram</a>`
      : '',
    SOCIAL_LINKS.facebook
      ? `<a href="${SOCIAL_LINKS.facebook}" style="color:${C.accent};font-size:13px;text-decoration:none;font-weight:600;">Facebook</a>`
      : '',
  ].filter(Boolean).join(` <span style="color:#d1d5db;margin:0 6px;">\u00B7</span> `)

  // Featured product block
  const featuredBlock = featured ? `
    <div style="border-top:1px solid #eee;margin:28px 0 0;padding:28px 0 0;">
      <p style="margin:0 0 16px;font-size:11px;text-transform:uppercase;letter-spacing:2.5px;color:${C.mutedText};font-weight:600;text-align:center;">${t.previewHeading}</p>
      <a href="${BASE_URL}/${locale}/shop/${featured.slug}" style="text-decoration:none;color:inherit;display:block;text-align:center;">
        ${featuredImage ? `<img src="${featuredImage}" alt="${featured.title}" width="200" style="display:block;margin:0 auto 12px;border-radius:8px;max-width:100%;">` : ''}
        <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:${C.heading};">${featured.title}</p>
        <p style="margin:0;font-size:14px;color:${C.accent};font-weight:700;">${eur(featured.base_price_cents)}</p>
      </a>
    </div>` : ''

  const content = `
    <!-- CONFIRM HEADING -->
    <h2 style="color:${C.heading};margin:0 0 12px;font-size:24px;font-weight:700;text-align:center;">${t.heading}</h2>
    <p style="font-size:15px;line-height:1.7;color:${C.bodyText};margin:0 0 28px;text-align:center;">${t.intro}</p>

    <!-- CTA BUTTON -->
    <div style="text-align:center;margin:0 0 16px;">
      <a href="${confirmUrl}" style="display:inline-block;background:${C.ctaButton};color:white;padding:14px 48px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${t.ctaButton}</a>
    </div>

    <!-- FALLBACK LINK -->
    <p style="font-size:12px;color:${C.mutedText};text-align:center;margin:0 0 4px;">${t.fallbackText}</p>
    <p style="font-size:11px;color:${C.accent};text-align:center;word-break:break-all;margin:0 0 28px;">
      <a href="${confirmUrl}" style="color:${C.accent};">${confirmUrl}</a>
    </p>

    ${featuredBlock}

    <!-- BRAND STORY -->
    <div style="border-top:1px solid #eee;margin:28px 0 0;padding:24px 0 0;">
      <p style="font-size:14px;line-height:1.7;color:${C.mutedText};margin:0 0 16px;text-align:center;font-style:italic;">"${t.brandStory}"</p>

      <!-- SOCIAL LINKS -->
      <div style="text-align:center;">
        <p style="margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:${C.mutedText};">${t.followUs}</p>
        ${socials}
      </div>
    </div>

    <!-- IGNORE DISCLAIMER -->
    <p style="font-size:12px;color:${C.footerText};text-align:center;margin:28px 0 0;">${t.ignoreText}</p>
  `

  return {
    subject: t.subject,
    html: emailLayout({ content, locale, recipientEmail }),
  }
}
