/**
 * Email Layout — Centralised HTML template for all transactional emails.
 *
 * Usage:
 *   import { emailLayout } from '@/lib/email-layout'
 *   const html = emailLayout({ locale, content: '<h2>Hello</h2>' })
 *
 * All branding, colors, links driven by store-config.ts. Nothing hardcoded.
 */

import { BASE_URL, BRAND, COMPANY, CONTACT, EMAIL_PALETTE } from '@/lib/store-config'

const C = EMAIL_PALETTE

const LEGAL: Record<string, { privacy: string; terms: string; unsubscribe: string; returns: string; rights: string }> = {
  en: { privacy: 'Privacy', terms: 'Terms', unsubscribe: 'Unsubscribe', returns: 'Returns', rights: 'All rights reserved' },
  es: { privacy: 'Privacidad', terms: 'Términos', unsubscribe: 'Cancelar suscripción', returns: 'Devoluciones', rights: 'Todos los derechos reservados' },
  de: { privacy: 'Datenschutz', terms: 'AGB', unsubscribe: 'Abmelden', returns: 'Rücksendungen', rights: 'Alle Rechte vorbehalten' },
}

interface FeaturedProduct {
  title: string
  price: string
  imageUrl: string
  href: string
}

interface EmailLayoutParams {
  content: string
  locale: string
  recipientEmail?: string
  brandName?: string
  /** Optional featured product block after content */
  featuredProduct?: FeaturedProduct
}

export function emailLayout({ content, locale, recipientEmail, brandName, featuredProduct }: EmailLayoutParams): string {
  const name = brandName || BRAND.name
  const l = LEGAL[locale] || LEGAL.en
  // Email logo URLs — configure EMAIL_LOGO_URL and EMAIL_WORDMARK_URL in .env
  // These must be publicly accessible HTTPS URLs (emails render externally).
  // Upload your logo to Supabase Storage or any CDN, then set these vars.
  const STORAGE = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL || ''
  const defaultLogoPath = STORAGE ? `${STORAGE}/storage/v1/object/public/marketing/email/logo-mark-white.png` : ''
  const defaultWordmarkPath = STORAGE ? `${STORAGE}/storage/v1/object/public/marketing/email/logo-wordmark-white.png` : ''
  const logoUrl = process.env.EMAIL_LOGO_URL || defaultLogoPath
  const wordmarkUrl = process.env.EMAIL_WORDMARK_URL || defaultWordmarkPath
  const unsubUrl = recipientEmail ? `${BASE_URL}/${locale}/unsubscribe?email=${encodeURIComponent(recipientEmail)}` : '#'

  const featuredBlock = featuredProduct ? `
    <div style="margin:24px 0 0;padding:20px;background:#fafafa;border:1px solid ${C.cardBorder};border-radius:8px;text-align:center;">
      <p style="margin:0 0 12px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:${C.mutedText};">
        ${locale === 'es' ? 'Nuestro favorito' : locale === 'de' ? 'Unser Favorit' : 'Our pick for you'}
      </p>
      <a href="${featuredProduct.href}" style="text-decoration:none;color:inherit;">
        <img src="${featuredProduct.imageUrl}" alt="${featuredProduct.title}" width="200" style="display:block;margin:0 auto 12px;border-radius:8px;" />
        <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:${C.heading};">${featuredProduct.title}</p>
        <p style="margin:0;font-size:14px;color:${C.accent};font-weight:700;">${featuredProduct.price}</p>
      </a>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f7;-webkit-font-smoothing:antialiased;">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center;padding:24px 20px;background:${C.headerBg};border-radius:12px 12px 0 0;">
      <img src="${logoUrl}" alt="${name}" width="44" height="34" style="display:block;margin:0 auto 10px;" />
      <img src="${wordmarkUrl}" alt="${name}" width="160" height="20" style="display:block;margin:0 auto;" />
    </div>

    <!-- Content -->
    <div style="background:#ffffff;padding:32px 28px;border-left:1px solid ${C.cardBorder};border-right:1px solid ${C.cardBorder};">
      ${content}
      ${featuredBlock}
    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:20px 28px;border:1px solid ${C.cardBorder};border-top:none;border-radius:0 0 12px 12px;">
      <div style="text-align:center;margin-bottom:12px;">
        <a href="${BASE_URL}/${locale}/privacy" style="color:${C.mutedText};font-size:12px;text-decoration:none;margin:0 6px;">${l.privacy}</a>
        <span style="color:#d1d5db;">·</span>
        <a href="${BASE_URL}/${locale}/terms" style="color:${C.mutedText};font-size:12px;text-decoration:none;margin:0 6px;">${l.terms}</a>
        <span style="color:#d1d5db;">·</span>
        <a href="${BASE_URL}/${locale}/returns" style="color:${C.mutedText};font-size:12px;text-decoration:none;margin:0 6px;">${l.returns}</a>
      </div>
      <p style="margin:0;text-align:center;font-size:11px;color:${C.footerText};line-height:1.5;">
        ${COMPANY.shortName} · <a href="mailto:${CONTACT.general}" style="color:${C.footerText};">${CONTACT.general}</a>
      </p>
      <p style="margin:8px 0 0;text-align:center;font-size:11px;color:${C.footerText};">
        © ${new Date().getFullYear()} ${name} · ${l.rights}
      </p>
      ${recipientEmail ? `<p style="margin:10px 0 0;text-align:center;"><a href="${unsubUrl}" style="color:${C.footerText};font-size:11px;text-decoration:underline;">${l.unsubscribe}</a></p>` : ''}
    </div>

  </div>
</body>
</html>`
}
