/**
 * ProviderRegistry — Unit Tests
 *
 * Tests register/get/setDefault/getForProduct/has/list.
 */

import { describe, it, expect } from 'vitest'
import { ProviderRegistry } from '@/lib/pod/provider-registry'
import { createMockProvider } from './test-utils'

function makeRegistry() {
  return new ProviderRegistry()
}

describe('ProviderRegistry', () => {
  it('registers and retrieves a provider by ID', () => {
    const reg = makeRegistry()
    const provider = createMockProvider({ providerId: 'printify' })
    reg.register(provider as any)
    expect(reg.get('printify')).toBe(provider)
  })

  it('throws when getting unregistered provider', () => {
    const reg = makeRegistry()
    expect(() => reg.get('nonexistent')).toThrow()
  })

  it('sets and uses default provider', () => {
    const reg = makeRegistry()
    const provider = createMockProvider({ providerId: 'printify' })
    reg.register(provider as any)
    reg.setDefault('printify')

    expect(reg.get()).toBe(provider)
    expect(reg.getDefaultId()).toBe('printify')
  })

  it('throws when setting default to unregistered provider', () => {
    const reg = makeRegistry()
    expect(() => reg.setDefault('unknown')).toThrow("Cannot set default: provider 'unknown' is not registered")
  })

  it('throws when getting default with no default set', () => {
    const reg = makeRegistry()
    expect(() => reg.get()).toThrow('No provider ID specified and no default provider set')
  })

  it('getForProduct returns specific provider when registered', () => {
    const reg = makeRegistry()
    const printify = createMockProvider({ providerId: 'printify' })
    const printful = createMockProvider({ providerId: 'printful' })
    reg.register(printify as any)
    reg.register(printful as any)
    reg.setDefault('printify')

    expect(reg.getForProduct('printful')).toBe(printful)
    expect(reg.getForProduct('printify')).toBe(printify)
  })

  it('getForProduct falls back to default when provider not found', () => {
    const reg = makeRegistry()
    const printify = createMockProvider({ providerId: 'printify' })
    reg.register(printify as any)
    reg.setDefault('printify')

    expect(reg.getForProduct('unknown')).toBe(printify)
    expect(reg.getForProduct(null)).toBe(printify)
    expect(reg.getForProduct(undefined)).toBe(printify)
  })

  it('has() checks provider registration', () => {
    const reg = makeRegistry()
    const provider = createMockProvider({ providerId: 'printify' })
    reg.register(provider as any)

    expect(reg.has('printify')).toBe(true)
    expect(reg.has('printful')).toBe(false)
  })

  it('list() returns all registered providers', () => {
    const reg = makeRegistry()
    const p1 = createMockProvider({ providerId: 'printify' })
    const p2 = createMockProvider({ providerId: 'printful' })
    reg.register(p1 as any)
    reg.register(p2 as any)

    const list = reg.list()
    expect(list).toHaveLength(2)
    expect(list).toContain(p1)
    expect(list).toContain(p2)
  })
})
