import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  getCurrencyForLocale,
  getFormatLocale,
  getCurrencySymbol,
  convertPrice,
  getLocalizedPrice,
} from '@/lib/currency'

describe('getCurrencyForLocale', () => {
  it('should return EUR for en locale', () => {
    expect(getCurrencyForLocale('en')).toBe('EUR')
  })

  it('should return EUR for es locale', () => {
    expect(getCurrencyForLocale('es')).toBe('EUR')
  })

  it('should return EUR for de locale', () => {
    expect(getCurrencyForLocale('de')).toBe('EUR')
  })

  it('should return default EUR for unknown locale', () => {
    expect(getCurrencyForLocale('fr')).toBe('EUR')
  })
})

describe('getFormatLocale', () => {
  it('should return correct format locale for en', () => {
    expect(getFormatLocale('en')).toBe('en-IE')
  })

  it('should return correct format locale for es', () => {
    expect(getFormatLocale('es')).toBe('es-ES')
  })

  it('should return correct format locale for de', () => {
    expect(getFormatLocale('de')).toBe('de-DE')
  })

  it('should return default en-IE for unknown locale', () => {
    expect(getFormatLocale('fr')).toBe('en-IE')
  })
})

describe('formatPrice', () => {
  it('should format EUR price for en locale', () => {
    const formatted = formatPrice(24.99, 'en')
    // UK format: €24.99
    expect(formatted).toMatch(/24[.,]99/)
    expect(formatted).toMatch(/€/)
  })

  it('should format EUR price for es locale', () => {
    const formatted = formatPrice(24.99, 'es')
    // Spanish format: 24,99 €
    expect(formatted).toMatch(/24[.,]99/)
    expect(formatted).toMatch(/€/)
  })

  it('should format EUR price for de locale', () => {
    const formatted = formatPrice(24.99, 'de')
    // German format: 24,99 €
    expect(formatted).toMatch(/24[.,]99/)
    expect(formatted).toMatch(/€/)
  })

  it('should format USD price when specified', () => {
    const formatted = formatPrice(24.99, 'en', 'USD')
    expect(formatted).toMatch(/24[.,]99/)
    expect(formatted).toMatch(/\$|USD/)
  })

  it('should format GBP price when specified', () => {
    const formatted = formatPrice(24.99, 'en', 'GBP')
    expect(formatted).toMatch(/24[.,]99/)
    expect(formatted).toMatch(/£|GBP/)
  })

  it('should handle zero price', () => {
    const formatted = formatPrice(0, 'en')
    expect(formatted).toMatch(/0/)
    expect(formatted).toMatch(/€/)
  })

  it('should handle large numbers', () => {
    const formatted = formatPrice(1234.56, 'en')
    expect(formatted).toMatch(/1[,\s]?234[.,]56/)
  })
})

describe('getCurrencySymbol', () => {
  it('should return € for EUR', () => {
    const symbol = getCurrencySymbol('EUR')
    expect(symbol).toBe('€')
  })

  it('should return $ or US$ for USD', () => {
    const symbol = getCurrencySymbol('USD')
    // Different locales format USD differently ($ or US$)
    expect(symbol).toMatch(/\$|US\$/)
  })

  it('should return £ for GBP', () => {
    const symbol = getCurrencySymbol('GBP')
    expect(symbol).toBe('£')
  })

  it('should work with different locales', () => {
    const symbolEN = getCurrencySymbol('EUR', 'en')
    const symbolDE = getCurrencySymbol('EUR', 'de')
    // Both should return € regardless of locale
    expect(symbolEN).toBe('€')
    expect(symbolDE).toBe('€')
  })
})

describe('convertPrice', () => {
  it('should return same price for same currency', () => {
    expect(convertPrice(100, 'EUR', 'EUR')).toBe(100)
    expect(convertPrice(100, 'USD', 'USD')).toBe(100)
  })

  it('should convert EUR to USD', () => {
    const converted = convertPrice(100, 'EUR', 'USD')
    // EUR to USD rate is 1.09 in the simplified implementation
    expect(converted).toBeCloseTo(109, 1)
  })

  it('should convert EUR to GBP', () => {
    const converted = convertPrice(100, 'EUR', 'GBP')
    // EUR to GBP rate is 0.86 in the simplified implementation
    expect(converted).toBe(86)
  })

  it('should convert USD to EUR', () => {
    const converted = convertPrice(109, 'USD', 'EUR')
    // Should be approximately 100 EUR
    expect(converted).toBeCloseTo(100, 0)
  })

  it('should convert GBP to EUR', () => {
    const converted = convertPrice(86, 'GBP', 'EUR')
    // Should be approximately 100 EUR
    expect(converted).toBeCloseTo(100, 0)
  })

  it('should handle zero amounts', () => {
    expect(convertPrice(0, 'EUR', 'USD')).toBe(0)
  })

  it('should handle decimal amounts', () => {
    const converted = convertPrice(10.5, 'EUR', 'USD')
    expect(converted).toBeCloseTo(11.445, 2)
  })
})

describe('getLocalizedPrice', () => {
  it('should return EUR price for en locale', () => {
    const localized = getLocalizedPrice(100, 'EUR', 'en')
    expect(localized).toBe(100) // EUR to EUR
  })

  it('should return EUR price for es locale', () => {
    const localized = getLocalizedPrice(100, 'EUR', 'es')
    expect(localized).toBe(100) // EUR to EUR
  })

  it('should return EUR price for de locale', () => {
    const localized = getLocalizedPrice(100, 'EUR', 'de')
    expect(localized).toBe(100) // EUR to EUR
  })

  it('should convert USD to EUR for en locale', () => {
    const localized = getLocalizedPrice(109, 'USD', 'en')
    expect(localized).toBeCloseTo(100, 0)
  })

  it('should convert GBP to EUR for de locale', () => {
    const localized = getLocalizedPrice(86, 'GBP', 'de')
    expect(localized).toBeCloseTo(100, 0)
  })
})
