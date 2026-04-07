import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  // Ensure that the incoming locale is valid
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale
  }

  // Load messages from file
  // Note: Redis caching for translations is not feasible in Edge runtime
  // where getRequestConfig runs. Translation files are small and Next.js
  // already caches dynamic imports effectively.
  let messages = (await import(`../../messages/${locale}.json`)).default

  // For non-English locales, merge with English as fallback
  if (locale !== 'en') {
    const englishMessages = (await import(`../../messages/en.json`)).default
    messages = { ...englishMessages, ...messages }
  }

  return {
    locale,
    messages,
  }
})
