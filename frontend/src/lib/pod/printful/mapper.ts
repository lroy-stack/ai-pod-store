/**
 * Printful Mapper — Anti-Corruption Layer
 * Translates between Printful raw API format and canonical POD models.
 */

import type {
  CanonicalProduct,
  CanonicalVariant,
  CanonicalImage,
  CanonicalOrder,
  Blueprint,
  BlueprintVariant,
  ShippingRate,
  UploadedDesign,
  NormalizedWebhookEvent,
  WebhookEventType,
} from '../models'
import type { CreateProductInput, CreateOrderInput } from '../types'
import { PRINTFUL_ORDER_STATUS_MAP, PRINTFUL_EVENT_MAP, POSITION_MAP } from './constants'
import { BRAND } from '@/lib/store-config'

// ─── Variant Name Parsing ────────────────────────────────────

/**
 * Parse a Printful sync variant name into color and size.
 * Handles formats like:
 * - "Bella + Canvas 3001 (Black / M)" -> { color: "Black", size: "M" }
 * - "Gildan 18500 (Sport Grey / 2XL)" -> { color: "Sport Grey", size: "2XL" }
 * - "Bella + Canvas 3001 (Black)" -> { color: "Black", size: null }
 */
export function parsePrintfulVariantName(name: string): { color: string | null; size: string | null } {
  const parenMatch = name.match(/\(([^)]+)\)\s*$/)
  if (parenMatch) {
    const parts = parenMatch[1].split('/').map(p => p.trim())
    if (parts.length >= 2) {
      return { color: parts[0] || null, size: parts[parts.length - 1] || null }
    }
    return { color: parenMatch[1].trim() || null, size: null }
  }
  return { color: null, size: null }
}

// ─── Product Mapping ─────────────────────────────────────────

export function toCanonicalProduct(raw: Record<string, unknown>): CanonicalProduct {
  const syncProduct = (raw.sync_product || raw) as Record<string, unknown>
  const syncVariants = (raw.sync_variants || []) as Array<Record<string, unknown>>

  const variants: CanonicalVariant[] = syncVariants.map(v => {
    const product = (v.product || {}) as Record<string, unknown>
    const { color, size } = parsePrintfulVariantName(String(v.name || ''))
    return {
      externalId: String(v.id || ''),
      title: String(v.name || ''),
      size,
      color,
      sku: String(v.sku || ''),
      priceCents: Math.round(parseFloat(String(v.retail_price || '0')) * 100),
      costCents: null, // Cost requires separate catalog lookup
      isEnabled: (v as Record<string, unknown>).is_enabled !== false,
      isAvailable: (v as Record<string, unknown>).availability_status === 'active',
      imageUrl: product.image ? String(product.image) : null,
    }
  })

  // Extract unique images from sync variants
  const seen = new Set<string>()
  const images: CanonicalImage[] = []
  for (const v of syncVariants) {
    const product = (v.product || {}) as Record<string, unknown>
    const imgUrl = product.image ? String(product.image) : ''
    if (imgUrl && !seen.has(imgUrl)) {
      seen.add(imgUrl)
      images.push({
        src: imgUrl,
        alt: String(syncProduct.name || ''),
        variantIds: [String(v.id || '')],
        isDefault: images.length === 0,
      })
    }
  }

  // Extract blueprintRef from first variant's product_id
  const firstVariantProduct =
    syncVariants[0] ? ((syncVariants[0].product || {}) as Record<string, unknown>) : null
  const catalogProductId = firstVariantProduct?.product_id
  const blueprintRef = catalogProductId ? `printful:${catalogProductId}` : null

  return {
    externalId: String(syncProduct.id || ''),
    title: String(syncProduct.name || ''),
    description: '', // Printful doesn't store descriptions — comes from Supabase
    status: syncProduct.is_ignored === true ? 'draft' : 'active',
    variants,
    images,
    printAreas: [], // Not returned by sync product endpoint
    blueprintRef,
    tags: [], // Not stored in Printful
    _raw: raw,
  }
}

// ─── Order Mapping ───────────────────────────────────────────

export function toCanonicalOrder(raw: Record<string, unknown>): CanonicalOrder {
  const status = PRINTFUL_ORDER_STATUS_MAP[String(raw.status || '')] || 'pending'
  const recipient = (raw.recipient || {}) as Record<string, unknown>
  const fullName = String(recipient.name || '')
  const nameParts = fullName.split(' ')

  const items = ((raw.items || []) as Array<Record<string, unknown>>).map(item => ({
    productExternalId: String(item.sync_variant_id || item.variant_id || ''),
    variantExternalId: String(item.sync_variant_id || item.variant_id || ''),
    quantity: Number(item.quantity || 0),
    status: String(raw.status || ''),
  }))

  const shipments = ((raw.shipments || []) as Array<Record<string, unknown>>).map(s => ({
    carrier: String(s.carrier || ''),
    trackingNumber: String(s.tracking_number || ''),
    trackingUrl: String(s.tracking_url || ''),
    shippedAt: s.shipped_at
      ? new Date(Number(s.shipped_at) * 1000).toISOString()
      : new Date().toISOString(),
  }))

  return {
    externalId: String(raw.id || ''),
    status: status as CanonicalOrder['status'],
    lineItems: items,
    shippingAddress: {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
      email: String(recipient.email || ''),
      phone: recipient.phone ? String(recipient.phone) : undefined,
      address1: String(recipient.address1 || ''),
      address2: recipient.address2 ? String(recipient.address2) : undefined,
      city: String(recipient.city || ''),
      state: String(recipient.state_code || ''),
      postalCode: String(recipient.zip || ''),
      country: String(recipient.country_code || ''),
    },
    shipments,
    createdAt: raw.created
      ? new Date(Number(raw.created) * 1000).toISOString()
      : new Date().toISOString(),
    _raw: raw,
  }
}

// ─── Create Product Input → Printful Format ──────────────────

export function fromCreateProductInput(input: CreateProductInput): Record<string, unknown> {
  return {
    sync_product: {
      name: input.title,
    },
    sync_variants: input.variants.map(v => ({
      variant_id: typeof v.variantId === 'number' ? v.variantId : parseInt(String(v.variantId), 10),
      retail_price: (v.priceCents / 100).toFixed(2),
      is_enabled: v.isEnabled !== false,
      files: input.printAreas.map(pa => ({
        placement: POSITION_MAP[pa.position] || pa.position,
        image_url: pa.images[0]?.id || '',
      })),
    })),
  }
}

// ─── Create Order Input → Printful Format ────────────────────

export function fromCreateOrderInput(input: CreateOrderInput): Record<string, unknown> {
  const addr = input.shippingAddress
  return {
    external_id: input.internalOrderId,
    label: input.label || `${BRAND.name} ${input.internalOrderId.slice(0, 8).toUpperCase()}`,
    shipping: 'STANDARD',
    recipient: {
      name: `${addr.firstName} ${addr.lastName}`.trim(),
      address1: addr.address1,
      address2: addr.address2 || undefined,
      city: addr.city,
      state_code: addr.state || undefined,
      country_code: addr.country,
      zip: addr.postalCode,
      phone: addr.phone || undefined,
      email: addr.email,
    },
    items: input.lineItems.map(li => ({
      sync_variant_id: parseInt(li.variantExternalId, 10),
      quantity: li.quantity,
      ...(li.files?.length ? {
        files: li.files.map(f => ({ type: f.type, url: f.url })),
      } : {}),
    })),
    ...(input.giftMessage
      ? {
          gift: { subject: `A gift for you from ${BRAND.name}`, message: input.giftMessage },
        }
      : {}),
  }
}

// ─── Catalog Mapping ─────────────────────────────────────────

export function toBlueprint(raw: Record<string, unknown>): Blueprint {
  return {
    id: String(raw.id || ''),
    title: String(raw.title || ''),
    description: String(raw.description || ''),
    images: raw.image ? [String(raw.image)] : [],
    isEuFulfillable: true, // Printful IS an EU provider (Latvia facility)
  }
}

export function toBlueprintVariant(raw: Record<string, unknown>): BlueprintVariant {
  return {
    id: String(raw.id || ''),
    title: String(raw.name || ''),
    options: {
      ...(raw.size ? { size: String(raw.size) } : {}),
      ...(raw.color ? { color: String(raw.color) } : {}),
    },
    placeholders: [], // Printful uses /mockup-generator/printfiles for this
  }
}

// ─── Shipping Rate ───────────────────────────────────────────

export function toShippingRate(raw: Record<string, unknown>): ShippingRate {
  return {
    id: String(raw.id || ''),
    name: String(raw.name || 'Standard'),
    costCents: Math.round(parseFloat(String(raw.rate || '0')) * 100),
    currency: String(raw.currency || 'EUR'),
    minDeliveryDays: raw.minDeliveryDays ? Number(raw.minDeliveryDays) : undefined,
    maxDeliveryDays: raw.maxDeliveryDays ? Number(raw.maxDeliveryDays) : undefined,
  }
}

// ─── Design Upload ───────────────────────────────────────────

export function toUploadedDesign(raw: Record<string, unknown>): UploadedDesign {
  return {
    id: String(raw.id || ''),
    fileName: String(raw.filename || ''),
    previewUrl: String(raw.preview_url || raw.thumbnail_url || ''),
  }
}

// ─── Webhook Event Normalization ─────────────────────────────

/**
 * Extract resourceId from Printful webhook data based on event type.
 *
 * Printful webhook payloads have varying structures:
 * - Order events: data.order.id / data.order.external_id
 * - Product events: data.sync_product.id
 * - Stock events: no single resource (data.variants[])
 */
function extractResourceId(rawType: string, data: Record<string, unknown>): string {
  // Order events: package_shipped, order_created, order_updated, order_failed,
  // order_canceled, order_put_hold, order_remove_hold, package_returned
  if (rawType.startsWith('order_') || rawType.startsWith('package_')) {
    const order = (data.order || {}) as Record<string, unknown>
    return String(order.external_id || order.id || '')
  }

  // Product events: product_synced, product_updated, product_deleted
  if (rawType.startsWith('product_')) {
    const syncProduct = (data.sync_product || {}) as Record<string, unknown>
    return String(syncProduct.id || '')
  }

  // Stock events: no single resource ID — use empty string
  if (rawType === 'stock_updated') {
    return ''
  }

  // Fallback for unknown event types
  return String(data.id || '')
}

export function toNormalizedWebhookEvent(rawEvent: unknown): NormalizedWebhookEvent {
  const event = rawEvent as Record<string, unknown>
  const rawType = String(event.type || '')
  const type: WebhookEventType = PRINTFUL_EVENT_MAP[rawType] || 'product.updated'
  const data = (event.data || {}) as Record<string, unknown>

  return {
    type,
    provider: 'printful',
    eventId: String(event.id || `printful-${Date.now()}`),
    resourceId: extractResourceId(rawType, data),
    timestamp: event.created
      ? new Date(Number(event.created) * 1000).toISOString()
      : new Date().toISOString(),
    data,
    _raw: rawEvent,
  }
}
