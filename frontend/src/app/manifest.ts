import { MetadataRoute } from 'next'
import { BRAND } from '@/lib/store-config'

/**
 * Dynamic PWA manifest
 * Automatically served at /manifest.webmanifest
 *
 * Uses store branding and references /brand/ icon assets
 * The manifest is regenerated on each request to support dynamic brand_config values
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} - AI Print on Demand`,
    short_name: BRAND.name,
    description: 'AI-Powered Print-on-Demand Platform - Create unique custom products with AI design tools',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#09090b',
    background_color: '#09090b',
    icons: [
      {
        src: '/brand/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/brand/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/brand/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['shopping', 'lifestyle', 'design'],
    lang: 'en',
    dir: 'ltr',
    prefer_related_applications: false,
  }
}
