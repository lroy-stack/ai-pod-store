/**
 * Printify Mapper — Anti-Corruption Layer
 * Translates between Printify raw API format and canonical POD models.
 */

import type {
  CanonicalProduct,
  CanonicalVariant,
  CanonicalImage,
  CanonicalPrintArea,
  CanonicalOrder,
  CanonicalLineItem,
  CanonicalAddress,
  CanonicalShipment,
  Blueprint,
  BlueprintVariant,
  ShippingRate,
  UploadedDesign,
  NormalizedWebhookEvent,
  WebhookEventType,
} from '../models'
import type { CreateProductInput, CreateOrderInput } from '../types'
import { USD_TO_EUR } from '../constants'

// ─── Raw Printify Types (internal, never exported) ───────────

interface PrintifyRawVariant {
  id: number
  title: string
  sku: string
  cost: number
  price: number
  is_enabled: boolean
  is_available: boolean
  options?: Record<string, string>
}

interface PrintifyRawImage {
  src?: string
  url?: string
  variant_ids?: number[]
  is_default?: boolean
}

interface PrintifyRawProduct {
  id: string
  title: string
  description: string
  visible: boolean
  variants: PrintifyRawVariant[]
  images: PrintifyRawImage[]
  print_areas?: Array<{
    variant_ids: number[]
    placeholders: Array<{
      position: string
      height: number
      width: number
      images: Array<{ id: string; x: number; y: number; scale: number; angle: number }>
    }>
  }>
  blueprint_id?: number
  print_provider_id?: number
  tags?: string[]
  safety_information?: string
}

// ─── Variant Title Parsing ───────────────────────────────────

const SHOE_SIZE_RE = /^(US|EU|UK)\s+\d+(\.\d+)?$/i
const SIZE_RE = /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|2X|3X|4X|5X|S\/M|L\/XL|One\s*size|\d+oz|\d+x\d+|\d+(\.\d+)?["']\s*x\s*\d+(\.\d+)?["']?|\d+(\.\d+)?["'])$/i

const US_TO_EU_SHOE: Record<string, string> = {
  '3.5': '36', '4': '36.5', '4.5': '37', '5': '38', '5.5': '38.5',
  '6': '39', '6.5': '39.5', '7': '40', '7.5': '40.5', '8': '41',
  '8.5': '42', '9': '42.5', '9.5': '43', '10': '44', '10.5': '44.5',
  '11': '45', '11.5': '45.5', '12': '46', '12.5': '46.5', '13': '47.5',
  '14': '48.5', '15': '49.5',
}

function convertShoeSize(raw: string): string {
  const m = raw.match(/^US\s+(\d+(?:\.\d+)?)$/i)
  if (m) {
    const eu = US_TO_EU_SHOE[m[1]]
    return eu ? `EU ${eu}` : raw
  }
  return raw
}

/**
 * Parse a Printify variant title into color and size.
 * Handles 5 formats:
 * - Standard: "Black / S" → color=Black, size=S
 * - Cap: "S/M / White" → size=S/M, color=White
 * - Bicolor: "Black / White / One size" → color=Black / White, size=One size
 * - Drinkware: "11oz / Black / Glossy" → size=11oz, color=Black
 * - Single: "Natural" → color=Natural, size=null
 */
export function parseVariantTitle(title: string): { color: string | null; size: string | null } {
  const parts = title.split(' / ').map(p => p.trim())
  let size: string | null
  let color: string | null

  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1]
    const firstPart = parts[0]
    if (SIZE_RE.test(lastPart) || SHOE_SIZE_RE.test(lastPart)) {
      color = parts.slice(0, -1).join(' / ')
      size = lastPart
    } else if (SIZE_RE.test(firstPart) || SHOE_SIZE_RE.test(firstPart)) {
      size = firstPart
      color = parts[1]
    } else {
      color = parts[0]
      size = parts[1]
    }
  } else if (parts.length === 2) {
    const isASize = SIZE_RE.test(parts[0]) || SHOE_SIZE_RE.test(parts[0])
    const isBSize = SIZE_RE.test(parts[1]) || SHOE_SIZE_RE.test(parts[1])
    if (isASize && !isBSize) {
      size = parts[0]
      color = parts[1]
    } else {
      color = parts[0]
      size = parts[1]
    }
  } else {
    const isSize = SIZE_RE.test(parts[0] || '') || SHOE_SIZE_RE.test(parts[0] || '')
    size = isSize ? parts[0] : null
    color = isSize ? null : (parts[0] || null)
  }

  // Convert US shoe sizes to EU
  if (size && SHOE_SIZE_RE.test(size)) {
    size = convertShoeSize(size)
  }

  return { color, size }
}

// ─── HTML Strip ──────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
    .slice(0, 2000)
}

// ─── Product Mapping ─────────────────────────────────────────

/** Build variant_id → image_url map from Printify mockup images */
function buildVariantImageMap(images: PrintifyRawImage[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const img of images) {
    const src = img.src || img.url || ''
    if (src && img.variant_ids) {
      for (const vid of img.variant_ids) {
        if (!map.has(vid)) map.set(vid, src)
      }
    }
  }
  return map
}

function mapVariant(raw: PrintifyRawVariant, imageMap: Map<number, string>): CanonicalVariant {
  const { color, size } = parseVariantTitle(raw.title)
  const costUsd = raw.cost || 0
  const costEur = costUsd > 0 ? Math.round(costUsd * USD_TO_EUR) : null

  return {
    externalId: String(raw.id),
    title: raw.title,
    size,
    color,
    sku: raw.sku || '',
    priceCents: raw.price || 0,
    costCents: costEur,
    isEnabled: raw.is_enabled !== false,
    isAvailable: raw.is_available !== false,
    imageUrl: imageMap.get(raw.id) || null,
  }
}

function deduplicateImages(images: PrintifyRawImage[], title: string): CanonicalImage[] {
  const seen = new Set<string>()
  const result: CanonicalImage[] = []

  for (const img of images) {
    const src = img.src || img.url || ''
    if (!src || src.includes('size-chart') || src.includes('size_chart')) continue
    const baseUrl = src.split('?')[0]
    if (seen.has(baseUrl)) continue
    seen.add(baseUrl)
    result.push({
      src,
      alt: title,
      variantIds: (img.variant_ids || []).map(String),
      isDefault: img.is_default === true,
    })
  }

  return result
}

function mapPrintAreas(raw: PrintifyRawProduct): CanonicalPrintArea[] {
  if (!raw.print_areas) return []
  const areas: CanonicalPrintArea[] = []

  for (const area of raw.print_areas) {
    for (const ph of area.placeholders || []) {
      areas.push({
        position: ph.position,
        placeholders: [{
          width: ph.width,
          height: ph.height,
          images: (ph.images || []).map(img => ({
            id: img.id,
            x: img.x,
            y: img.y,
            scale: img.scale,
            angle: img.angle,
          })),
        }],
      })
    }
  }

  return areas
}

export function toCanonicalProduct(raw: Record<string, unknown>): CanonicalProduct {
  const p = raw as unknown as PrintifyRawProduct
  const imageMap = buildVariantImageMap(p.images || [])

  const bpId = p.blueprint_id
  const pvId = p.print_provider_id
  const blueprintRef = bpId != null && pvId != null
    ? `printify:${bpId}:${pvId}`
    : bpId != null
      ? `printify:${bpId}`
      : null

  return {
    externalId: String(p.id),
    title: p.title || '',
    description: stripHtml(p.description || ''),
    status: p.visible ? 'active' : 'draft',
    variants: (p.variants || [])
      .filter(v => v.is_enabled !== false)
      .map(v => mapVariant(v, imageMap)),
    images: deduplicateImages(p.images || [], p.title || ''),
    printAreas: mapPrintAreas(p),
    blueprintRef,
    tags: p.tags || [],
    _raw: raw,
  }
}

// ─── Order Mapping ───────────────────────────────────────────

export function toCanonicalOrder(raw: Record<string, unknown>): CanonicalOrder {
  const o = raw as {
    id: string
    status: string
    created_at: string
    line_items?: Array<{ product_id: string; variant_id: number; quantity: number; status: string }>
    shipments?: Array<{ carrier: string; tracking_number: string; tracking_url: string }>
  }

  return {
    externalId: o.id,
    status: mapPrintifyOrderStatus(o.status),
    lineItems: (o.line_items || []).map(li => ({
      productExternalId: li.product_id,
      variantExternalId: String(li.variant_id),
      quantity: li.quantity,
      status: li.status || '',
    })),
    shippingAddress: { firstName: '', lastName: '', email: '', address1: '', city: '', state: '', postalCode: '', country: '' },
    shipments: (o.shipments || []).map(s => ({
      carrier: s.carrier,
      trackingNumber: s.tracking_number,
      trackingUrl: s.tracking_url,
      shippedAt: '',
    })),
    createdAt: o.created_at,
    _raw: raw,
  }
}

function mapPrintifyOrderStatus(status: string): CanonicalOrder['status'] {
  const map: Record<string, CanonicalOrder['status']> = {
    'pending': 'pending',
    'on-hold': 'pending',
    'in-production': 'in_production',
    'shipping': 'shipped',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'canceled': 'cancelled',
    'cancelled': 'cancelled',
    'failed': 'failed',
  }
  return map[status] || 'pending'
}

// ─── Create Product Input → Printify Format ──────────────────

export function fromCreateProductInput(input: CreateProductInput): Record<string, unknown> {
  if (!input.blueprintId || !input.printProviderId) {
    throw new Error('Printify requires blueprintId and printProviderId')
  }

  return {
    title: input.title,
    description: input.description || '',
    blueprint_id: input.blueprintId,
    print_provider_id: input.printProviderId,
    variants: input.variants.map(v => ({
      id: typeof v.variantId === 'number' ? v.variantId : parseInt(String(v.variantId), 10),
      price: v.priceCents,
      is_enabled: v.isEnabled !== false,
    })),
    print_areas: input.printAreas.map(pa => ({
      variant_ids: input.variants.map(v =>
        typeof v.variantId === 'number' ? v.variantId : parseInt(String(v.variantId), 10)
      ),
      placeholders: [{
        position: pa.position,
        images: pa.images.map(img => ({
          id: img.id,
          x: img.x,
          y: img.y,
          scale: img.scale,
          angle: img.angle,
        })),
      }],
    })),
    tags: input.tags || [],
  }
}

// ─── Create Order Input → Printify Format ────────────────────

export function fromCreateOrderInput(input: CreateOrderInput): Record<string, unknown> {
  return {
    external_id: input.internalOrderId,
    label: input.label || `Order ${input.internalOrderId.slice(0, 8)}`,
    line_items: input.lineItems.map(li => ({
      product_id: li.productExternalId,
      variant_id: parseInt(li.variantExternalId, 10),
      quantity: li.quantity,
    })),
    shipping_method: 1,
    send_shipping_notification: !input.suppressShippingNotification,
    address_to: {
      first_name: input.shippingAddress.firstName,
      last_name: input.shippingAddress.lastName,
      email: input.shippingAddress.email,
      phone: input.shippingAddress.phone,
      country: input.shippingAddress.country,
      region: input.shippingAddress.state,
      address1: input.shippingAddress.address1,
      address2: input.shippingAddress.address2,
      city: input.shippingAddress.city,
      zip: input.shippingAddress.postalCode,
    },
  }
}

// ─── Stripe Address → Canonical Address ──────────────────────

export function canonicalAddressFromStripe(
  stripeAddress: {
    name?: string
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  },
  email: string,
): CanonicalAddress {
  const nameParts = (stripeAddress.name || 'Customer').split(' ')
  const firstName = nameParts[0] || 'Customer'
  const lastName = nameParts.slice(1).join(' ') || ''

  return {
    firstName,
    lastName,
    email,
    address1: stripeAddress.line1 || '',
    address2: stripeAddress.line2 || undefined,
    city: stripeAddress.city || '',
    state: stripeAddress.state || '',
    postalCode: stripeAddress.postal_code || '',
    country: stripeAddress.country || 'DE',
  }
}

// ─── Catalog Mapping ─────────────────────────────────────────

export function toBlueprint(raw: Record<string, unknown>): Blueprint {
  const r = raw as { id: number; title: string; description: string; images: string[] }
  return {
    id: String(r.id),
    title: r.title || '',
    description: r.description || '',
    images: r.images || [],
    isEuFulfillable: false, // Determined separately via provider check
  }
}

export function toBlueprintVariant(raw: Record<string, unknown>): BlueprintVariant {
  const r = raw as { id: number; title: string; options: Record<string, string>; placeholders: Array<{ position: string; height: number; width: number }> }
  return {
    id: String(r.id),
    title: r.title || '',
    options: r.options || {},
    placeholders: r.placeholders || [],
  }
}

export function toShippingRate(raw: Record<string, unknown>): ShippingRate {
  const r = raw as { id: number; name: string; cost: number }
  return {
    id: String(r.id),
    name: r.name || '',
    costCents: r.cost || 0,
    currency: 'EUR',
  }
}

export function toUploadedDesign(raw: Record<string, unknown>): UploadedDesign {
  const r = raw as { id: string; file_name: string; preview_url: string }
  return {
    id: r.id,
    fileName: r.file_name || '',
    previewUrl: r.preview_url || '',
  }
}

// ─── Webhook Event Normalization ─────────────────────────────

const PRINTIFY_EVENT_MAP: Record<string, WebhookEventType> = {
  'order:created': 'order.created',
  'order:shipped': 'order.shipped',
  'order:delivered': 'order.delivered',
  'order:cancelled': 'order.cancelled',
  'order:failed': 'order.failed',
  'product:publish:started': 'product.publish_started',
  'product:publish:succeeded': 'product.publish_succeeded',
  'product:created': 'product.created',
  'product:updated': 'product.updated',
  'product:deleted': 'product.deleted',
}

export function toNormalizedWebhookEvent(rawEvent: unknown): NormalizedWebhookEvent {
  const event = rawEvent as Record<string, unknown>
  const type = String(event.type || '')
  const resource = event.resource as Record<string, unknown> | undefined

  return {
    type: PRINTIFY_EVENT_MAP[type] || ('product.updated' as WebhookEventType),
    provider: 'printify',
    eventId: String(event.id || ''),
    resourceId: String(resource?.id || event.id || ''),
    timestamp: new Date().toISOString(),
    data: resource || {},
    _raw: rawEvent,
  }
}
