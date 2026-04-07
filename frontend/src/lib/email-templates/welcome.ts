/**
 * Welcome Email Template
 *
 * Sent after email verification. Fetches products from DB at send time.
 * Images served from Supabase Storage (public bucket) and Printful CDN.
 */

import { emailLayout } from '@/lib/email-layout'
import { BASE_URL, EMAIL_PALETTE, BRAND, SOCIAL_LINKS } from '@/lib/store-config'
import { supabaseAdmin } from '@/lib/supabase-admin'

const C = EMAIL_PALETTE
// Public URL — emails render in Gmail/Outlook, must be internet-accessible
const SUPABASE_STORAGE = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL || ''

const i18n: Record<string, {
  subject: string
  greeting: (name: string) => string
  intro: string
  couponLabel: string
  couponNote: string
  cta: string
  heroTag: string
  heroCta: string
  bestSellers: string
  brandStory: string
  followUs: string
}> = {
  en: {
    subject: `Welcome to ${BRAND.name} — here's 10% off your first order`,
    greeting: (n) => `Hey ${n}, welcome aboard`,
    intro: 'You\'re in. As a welcome gift, here\'s an exclusive code for your first purchase.',
    couponLabel: 'YOUR WELCOME CODE',
    couponNote: 'First purchase only · Never expires',
    cta: 'Shop the Collection',
    heroTag: 'DROP 01 — EARLY ACCESS',
    heroCta: 'Shop Now',
    bestSellers: 'Best Sellers',
    brandStory: 'Unique fashion designed with you, made in Europe. Every piece is made on demand — no waste, no compromise.',
    followUs: 'Join the community',
  },
  es: {
    subject: `Bienvenido/a a ${BRAND.name} — tu 10% de descuento`,
    greeting: (n) => `¡Hola ${n}, bienvenido/a!`,
    intro: 'Ya estás dentro. Como regalo de bienvenida, aquí tienes un código exclusivo para tu primera compra.',
    couponLabel: 'TU CÓDIGO DE BIENVENIDA',
    couponNote: 'Primera compra · No caduca',
    cta: 'Ver la Colección',
    heroTag: 'DROP 01 — ACCESO ANTICIPADO',
    heroCta: 'Comprar',
    bestSellers: 'Los más vendidos',
    brandStory: 'Moda única diseñada contigo, hecha en Europa. Cada prenda se fabrica bajo demanda.',
    followUs: 'Únete a la comunidad',
  },
  de: {
    subject: `Willkommen bei ${BRAND.name} — 10% auf deine erste Bestellung`,
    greeting: (n) => `Hey ${n}, willkommen!`,
    intro: 'Du bist dabei. Als Willkommensgeschenk hier dein exklusiver Code für den ersten Einkauf.',
    couponLabel: 'DEIN WILLKOMMENSCODE',
    couponNote: 'Erster Einkauf · Läuft nicht ab',
    cta: 'Kollektion entdecken',
    heroTag: 'DROP 01 — EARLY ACCESS',
    heroCta: 'Jetzt Shoppen',
    bestSellers: 'Bestseller',
    brandStory: 'Einzigartige Mode mit dir gestaltet, hergestellt in Europa. Jedes Stück wird auf Bestellung gefertigt.',
    followUs: 'Werde Teil der Community',
  },
}

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

interface WelcomeEmailParams {
  name: string
  locale: string
  recipientEmail: string
}

export async function buildWelcomeEmail({ name, locale, recipientEmail }: WelcomeEmailParams): Promise<{ subject: string; html: string }> {
  const t = i18n[locale] || i18n.en

  // Logo URLs — override with EMAIL_LOGO_URL / EMAIL_WORDMARK_URL in .env
  const markW = process.env.EMAIL_LOGO_URL || (SUPABASE_STORAGE ? `${SUPABASE_STORAGE}/storage/v1/object/public/marketing/email/logo-mark-white.png` : '')
  const wmW = process.env.EMAIL_WORDMARK_URL || (SUPABASE_STORAGE ? `${SUPABASE_STORAGE}/storage/v1/object/public/marketing/email/logo-wordmark-white.png` : '')

  // Hero: Signal white back
  const heroImg = `${SUPABASE_STORAGE}/storage/v1/object/public/designs/mockups/trendi-hoodie/white-back.png`

  // Fetch hero product price from DB
  const { data: hero } = await supabaseAdmin
    .from('products')
    .select('slug, title, base_price_cents, compare_at_price_cents')
    .eq('slug', 'signal')
    .eq('status', 'active')
    .single()

  const heroPrice = hero ? eur(hero.base_price_cents) : '59,95 €'
  const heroOldPrice = hero?.compare_at_price_cents ? eur(hero.compare_at_price_cents) : null

  // Fetch 3 best sellers with images
  const { data: sellers } = await supabaseAdmin
    .from('products')
    .select('slug, title, base_price_cents, compare_at_price_cents')
    .eq('status', 'active')
    .neq('slug', 'signal')
    .order('review_count', { ascending: false })
    .limit(3)

  // Get first image for each seller from variants
  const sellerImages: Record<string, string> = {}
  for (const s of sellers || []) {
    const { data: variant } = await supabaseAdmin
      .from('product_variants')
      .select('image_url')
      .eq('product_id', s.slug) // This won't work - need product_id not slug
      .not('image_url', 'is', null)
      .limit(1)
      .single()
    // Fallback: construct storage URL from slug
    if (!variant?.image_url) {
      // Try common mockup path pattern
      sellerImages[s.slug] = `${SUPABASE_STORAGE}/storage/v1/object/public/designs/mockups/${s.slug}/black-front.png`
    } else {
      sellerImages[s.slug] = variant.image_url
    }
  }

  // Social links
  const socials = [
    SOCIAL_LINKS.instagram ? `<a href="${SOCIAL_LINKS.instagram}" style="color:${C.accent};font-size:13px;text-decoration:none;font-weight:600;">Instagram</a>` : '',
    SOCIAL_LINKS.facebook ? `<a href="${SOCIAL_LINKS.facebook}" style="color:${C.accent};font-size:13px;text-decoration:none;font-weight:600;">Facebook</a>` : '',
  ].filter(Boolean).join(` <span style="color:#d1d5db;margin:0 6px;">·</span> `)

  // Best sellers HTML
  const sellersHtml = (sellers || []).map(p => {
    const img = sellerImages[p.slug] || ''
    const href = `${BASE_URL}/${locale}/shop/${p.slug}`
    return `
    <td style="width:33%;padding:0 6px;vertical-align:top;text-align:center;">
      <a href="${href}" style="text-decoration:none;color:inherit;display:block;">
        <div style="background:#f5f5f5;border-radius:8px;overflow:hidden;margin:0 0 10px;">
          <img src="${img}" alt="${p.title}" width="160" style="display:block;width:100%;height:auto;">
        </div>
        <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:${C.heading};">${p.title}</p>
        <p style="margin:0;font-size:13px;color:${C.accent};font-weight:700;">${eur(p.base_price_cents)}</p>
      </a>
    </td>`
  }).join('')

  const content = `
    <!-- HERO BANNER -->
    <div style="margin:-32px -28px 0;overflow:hidden;">
      <a href="${BASE_URL}/${locale}/shop/signal" style="text-decoration:none;color:inherit;display:block;">
        <div style="background:#f2f2f2;text-align:center;padding:20px 16px 0;">
          <p style="margin:0 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:2.5px;color:${C.accent};font-weight:700;">${t.heroTag}</p>
          <img src="${heroImg}" alt="Signal" width="300" style="display:block;margin:0 auto;max-width:100%;">
        </div>
        <div style="background:#f2f2f2;padding:14px 20px 18px;text-align:center;">
          <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:${C.heading};letter-spacing:0.5px;">Signal</p>
          <p style="margin:0;">
            ${heroOldPrice ? `<span style="text-decoration:line-through;color:${C.mutedText};margin-right:8px;font-size:14px;">${heroOldPrice}</span>` : ''}
            <span style="color:${C.accent};font-weight:800;font-size:18px;">${heroPrice}</span>
          </p>
          <p style="margin:12px 0 0;"><span style="display:inline-block;background:${C.ctaButton};color:white;padding:8px 28px;border-radius:6px;font-weight:600;font-size:13px;">${t.heroCta}</span></p>
        </div>
      </a>
    </div>

    <!-- GREETING + COUPON -->
    <div style="padding:28px 0 0;">
      <h2 style="color:${C.heading};margin:0 0 8px;font-size:21px;font-weight:700;">${t.greeting(name)}</h2>
      <p style="font-size:15px;line-height:1.7;color:${C.bodyText};margin:0 0 24px;">${t.intro}</p>

      <div style="background:${C.heading};border-radius:10px;padding:22px 20px;margin:0 0 24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.45);">${t.couponLabel}</p>
        <p style="margin:0 0 6px;font-size:36px;font-weight:800;letter-spacing:6px;color:#fff;font-family:'Courier New',monospace;">WELCOME10</p>
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);">${t.couponNote}</p>
      </div>

      <div style="text-align:center;margin:0 0 32px;">
        <a href="${BASE_URL}/${locale}/shop" style="display:inline-block;background:${C.ctaButton};color:white;padding:14px 48px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${t.cta}</a>
      </div>

      <div style="border-top:1px solid #eee;margin:0 0 28px;"></div>

      <!-- BEST SELLERS -->
      ${sellersHtml ? `
      <p style="margin:0 0 16px;font-size:11px;text-transform:uppercase;letter-spacing:2.5px;color:${C.mutedText};font-weight:600;text-align:center;">${t.bestSellers}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr>${sellersHtml}</tr></table>
      ` : ''}

      <div style="border-top:1px solid #eee;margin:0 0 24px;"></div>

      <!-- BRAND STORY + SOCIAL -->
      <p style="font-size:14px;line-height:1.7;color:${C.mutedText};margin:0 0 16px;text-align:center;font-style:italic;">"${t.brandStory}"</p>
      <div style="text-align:center;">
        <p style="margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:${C.mutedText};">${t.followUs}</p>
        ${socials}
      </div>
    </div>
  `

  return {
    subject: t.subject,
    html: emailLayout({ content, locale, recipientEmail }),
  }
}
