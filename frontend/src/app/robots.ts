import type { MetadataRoute } from 'next'
import { BASE_URL } from '@/lib/store-config'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = BASE_URL

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/*/auth/',
          '/*/checkout/',
          '/*/cart/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
