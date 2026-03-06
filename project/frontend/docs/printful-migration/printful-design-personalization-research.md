# Printful Design Personalization & API Research

> Date: 2026-03-02
> Purpose: Evaluate Printful's API capabilities for product personalization, mockup generation, and embedded design tools to inform migration from Printify.

---

## Table of Contents

1. [Printful Design Maker Capabilities](#1-printful-design-maker-capabilities)
2. [Embedded Design Maker (EDM) -- The Game Changer](#2-embedded-design-maker-edm----the-game-changer)
3. [Mockup Generator API Deep Dive](#3-mockup-generator-api-deep-dive)
4. [Public App API & OAuth Flow](#4-public-app-api--oauth-flow)
5. [Text & Image Placement Capabilities](#5-text--image-placement-capabilities)
6. [Order Creation with Custom Designs](#6-order-creation-with-custom-designs)
7. [Comparison with Current Approach (Printify + fal.ai + Sharp)](#7-comparison-with-current-approach-printify--falai--sharp)
8. [Fyul Merger Context (Printful + Printify)](#8-fyul-merger-context-printful--printify)
9. [Opportunities for Our Design Studio](#9-opportunities-for-our-design-studio)
10. [Recommended Architecture for Next-Gen Design Module](#10-recommended-architecture-for-next-gen-design-module)

---

## 1. Printful Design Maker Capabilities

Printful's Design Maker is a free, browser-based design tool with extensive capabilities:

### Text Features
- Font selection from a curated library (optimized for print quality across techniques)
- Font size, letter spacing, line height adjustment
- Text color + graphic fills
- **Outline effects** with adjustable spacing
- **Shadow effects** with adjustable angle
- **Curved text** capability
- For embroidery: thread color selection (max 6 per design)

### Image Features
- Upload personal images (JPG, PNG, max 50MB, max 15k pixels per dimension)
- **One-click background removal** (built-in, no external API needed)
- Crop tool for precise framing
- Getty Images integration (90M+ images at $1/sold item)

### Clipart Library
- 3,500+ pre-made graphics (symbols, drawings, emojis)
- Free to use across all designs
- Created by internal Printful designers

### Templates & Patterns
- Quick Design templates for holidays/themes
- **All-Over Pattern Tool**: Rectangle, Offset, Side-by-side, Mirrored, Horizontal Line, Vertical Line
- Customizable pattern color, size, spacing

### Mockup Generation
- 1,400+ mockup scenes (nature backgrounds, flat-lays, home/office)
- 2,550+ total mockup scenes reported
- **3D product preview** for drinkware and pillows
- Flat + 3D puff stitch preview for hats
- Exportable mockup files for shop use

### Advanced Features
- **Multi-layer design** with independent layer reordering
- **Duplication tool** for element copying
- Position adjustment via buttons, numeric input, or anchor points
- Zoom function for print area detail
- Background colors for mugs, phone cases, wall decor, all-over items

### Pricing
- Design Maker itself: **FREE**
- Getty Images: $1 per sale
- Embroidery text digitizing: $3.95/file (reduced from standard rate)

---

## 2. Embedded Design Maker (EDM) -- The Game Changer

**This is Printful's most powerful offering for our use case.**

The Embedded Design Maker (EDM) is a white-label, embeddable design studio that can be integrated directly into third-party platforms via iframe. It provides the full Design Maker experience inside your own storefront.

### How It Works

1. **Backend generates a nonce token** via Printful API (keeps access token secret)
2. **Frontend loads the EDM iframe** with the nonce
3. **Customer designs their product** inside the iframe (text, images, clipart)
4. **Design is saved** and returns a `templateId`
5. **Backend creates order** using the templateId
6. **Mockups generated** automatically from the saved template

### Technical Integration

#### Script Inclusion
```html
<script src="https://files.cdn.printful.com/embed/embed.js"></script>
```

#### Nonce Generation (Server-Side)
```
POST https://api.printful.com/embedded-designer/nonces

Body:
{
  "external_product_id": "mug-123",        // Your product reference
  "external_customer_id": "user-456",      // Optional: track customer
  "ip_address": "1.2.3.4",                 // Optional: validation
  "user_agent": "Mozilla/5.0..."           // Optional: validation
}

Response:
{
  "nonce": "ec7kkhxcx6ykjlb2718kzzbgu353y7on",
  "template_id": null,                      // null for new templates
  "expires_at": "2026-03-02T14:00:00Z"
}
```

#### Client-Side Initialization
```javascript
const designer = new PFDesignMaker({
  // Required
  elemId: 'design-studio',
  nonce: serverGeneratedNonce,
  externalProductId: 'skapara-tee-001',
  initProduct: { productId: 438 },  // Printful catalog product ID

  // Localization
  locale: 'en_US',  // Also: es_ES, de_DE, fr_FR, it_IT, ja_JP

  // Feature control
  featureConfig: {
    clipart_layers: true,
    file_layers: true,
    text_layers: true,
    embroidery_3d_puff: true,
    has_external_user_file_library: false,
    show_unavailability_info: true,
    sub_technique_switcher: false,
    initial_open_view: 'file_layers'
  },

  // Variant restrictions
  preselectedColors: ['Black', 'White', 'Navy'],
  preselectedSizes: ['M', 'L', 'XL'],
  allowOnlyOneColorToBeSelected: true,
  allowOnlyOneSizeToBeSelected: true,
  disabledPlacements: [],     // Hide specific placements
  disabledColors: [],          // Mark colors unavailable
  disabledSizes: [],           // Mark sizes unavailable
  isVariantSelectionDisabled: false,

  // Live pricing (real-time cost display)
  livePricingConfig: {
    useLivePricing: true,
    useAccountBasedPricing: true,  // Apply volume discounts
    showPricesInPlacementsTabs: true,
    livePricingCurrency: 'EUR'
  },

  // White-label styling (CSS custom properties)
  style: {
    variables: {
      '--pf-sys-background': '#0F172A',           // Match SKAPARA dark theme
      '--pf-sys-primary-surface-700': '#40ACCC'    // SKAPARA turquoise accent
    },
    navigation: {
      product: { imageIcon: '/icons/product.svg' },
      design: { imageIcon: '/icons/design.svg' },
      text: { imageIcon: '/icons/text.svg' }
    }
  },

  // Callbacks
  onTemplateSaved: (templateId) => {
    // Save templateId to our DB, create order
    console.log('Template saved:', templateId);
  },

  onDesignStatusUpdate: (status) => {
    // Real-time design validation
    // status.designChange: boolean
    // status.designValid: boolean (can save?)
    // status.selectedVariantIds: number[]
    // status.usedPlacements: string[]
    // status.errors: string[]
  },

  onPricingStatusUpdate: (pricing) => {
    // Real-time pricing data
    // pricing.price, pricing.currency, pricing.retailPrice
    // pricing.discountPercent, pricing.discountedPrice
  },

  onIframeLoaded: () => { /* Loading spinner off */ },
  onError: (error) => { /* Handle errors */ },

  onFilePickerRequested: () => {
    // Custom file upload UI (optional)
    // Use with custom_external_file_library: true
  }
});
```

#### SDK Methods
```javascript
// Trigger save (returns templateId via onTemplateSaved callback)
designer.sendMessage({ event: 'saveDesign' });

// Inject image into current placement
designer.sendMessage({
  event: 'setUrlImageLayer',
  imageUrl: 'https://our-cdn.com/ai-generated-design.png'
});
```

### Key EDM Details
- **Authentication**: Requires private token with "Embedded Designer" extension
- **Nonce lifecycle**: Extended with each use; invalidated after save or expiration
- **Template isolation**: EDM templates are invisible in Printful dashboard (and vice versa)
- **File limits**: Max 5 file image layers per placement, max 15k pixels dimension, max 50MB
- **URL length**: Max 1000 characters for image URLs
- **Placement restriction**: `embroidery_large_center` is always hidden (technical limitation)
- **Access requirement**: Enterprise form approval at printful.com/enterprise/embedded-design-maker

### EDM Limitation: Enterprise Access

**CRITICAL**: The EDM requires enterprise-level access. You must apply at:
https://www.printful.com/enterprise/embedded-design-maker

This means it is NOT available to standard API users. It is an enterprise feature that requires Printful approval and likely a business relationship discussion.

---

## 3. Mockup Generator API Deep Dive

### API Version: v2 (Beta)

The Mockup Generator is fully available via the standard API (no enterprise requirement).

### Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/v2/mockup-tasks` | POST | Create a mockup generation task |
| `/v2/mockup-tasks/{id}` | GET | Poll task status/results |
| `/v2/catalog-products/{id}/mockup-styles` | GET | Get available mockup styles for a product |
| `/v2/catalog-products/{id}/mockup-templates` | GET | Get positional data for self-rendering |

### Mockup Task Creation

```json
POST /v2/mockup-tasks

{
  "format": "png",
  "catalog_product_id": 438,
  "catalog_variant_ids": [4011, 4012, 4013],
  "mockup_style_ids": [1, 2, 3],
  "placements": [
    {
      "placement": "front",
      "technique": "dtg",
      "layers": [
        {
          "type": "file",
          "url": "https://our-cdn.com/design.png",
          "layer_options": []
        }
      ]
    },
    {
      "placement": "back",
      "technique": "dtg",
      "layers": [
        {
          "type": "file",
          "url": "https://our-cdn.com/back-design.png"
        }
      ]
    }
  ]
}
```

### Response (Pending)
```json
{
  "id": "task_abc123",
  "status": "pending",
  "catalog_variant_mockups": [],
  "failure_reasons": []
}
```

### Response (Completed)
```json
{
  "id": "task_abc123",
  "status": "completed",
  "catalog_variant_mockups": [
    {
      "catalog_variant_id": 4011,
      "mockups": [
        {
          "mockup_style_id": 1,
          "url": "https://files.cdn.printful.com/mockup/...",
          "extra_mockup_url": null
        }
      ]
    }
  ]
}
```

### Async Processing

Mockups are generated **asynchronously**. Two retrieval methods:

1. **Webhook**: Listen for `mockup_task_finished` event
2. **Polling**: GET `/v2/mockup-tasks/{id}` at intervals

### Mockup Styles Endpoint

```
GET /v2/catalog-products/{id}/mockup-styles

Returns:
- placement: "front", "back", etc.
- display_name: Human-readable label
- mockup_styles[].view_name: "front", "back", "side", etc.
- print_area_width / print_area_height: Dimensions in inches
```

### Mockup Templates Endpoint (Self-Rendering)

```
GET /v2/catalog-products/{id}/mockup-templates

Returns:
- template_width / template_height: Full template dimensions
- print_area_width / print_area_height: Printable zone dimensions
- print_area_top / print_area_left: Position coordinates
- image_url: Base template image URL
- background_url: Background image URL
- background_color: Hex color
- orientation: "horizontal" / "vertical"
```

**This endpoint is key**: It provides all the positional data needed to compose mockups client-side without using Printful's async generator. This is essentially what our current Sharp-based approach does, but with Printful's actual product photography templates.

### Coordinate System
- Origin `(0,0)` is at the **top-left** corner of the print area
- `limit_to_print_area` parameter controls boundary enforcement
  - `true`: 400 Bad Request if image crosses border
  - `false`: Image can extend partially outside print area

### Rate Limits
- General: 120 requests/60 seconds (leaky bucket)
- Mockup Generator: Stricter individual limits (not specified exactly)
- Headers: `X-Ratelimit-Remaining`, `X-Ratelimit-Reset`, `Retry-After`

---

## 4. Public App API & OAuth Flow

### Two API Types

| Type | Use Case | Auth |
|---|---|---|
| **Private Token** | Our backend operations | Bearer token from Developer Portal |
| **Public App** | Third-party user connections | OAuth 2.0 flow |

### OAuth 2.0 Flow (Public Apps)

1. **Register Public App** in Printful Developer Portal with requested scopes
2. **Redirect user** to Printful authorization URL
3. **User approves** requested permissions
4. **Receive authorization code** via redirect
5. **Exchange code for tokens**:

```
POST https://www.printful.com/oauth/token

Body:
{
  "grant_type": "authorization_code",
  "client_id": "YOUR_APP_ID",
  "client_secret": "YOUR_APP_SECRET",
  "code": "AUTHORIZATION_CODE",
  "redirect_uri": "https://skapara.com/callback"
}

Response:
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "token_type": "bearer"
}
```

### OAuth Scopes

```
GET /v2/oauth-scopes

Common scopes:
- orders/read, orders/write
- products/read, products/write
- files/read, files/write
- mockups/read
- webhooks/read, webhooks/write
```

### When to Use Public App vs Private Token

**For our store (SKAPARA)**: Private Token is sufficient. We operate one store, not a marketplace.

**Public App would be needed if**:
- We build a platform where OTHER store owners connect their Printful accounts
- We want to let customers have their own Printful accounts and order through us
- We build a Printful marketplace app

**Verdict**: For our use case, Private Token + EDM (enterprise) is the ideal combination.

---

## 5. Text & Image Placement Capabilities

### Via Order API (v2)

Text is NOT rendered by Printful's API directly as a text layer. Instead:

**Approach A: Pre-rendered files** (current approach)
- Render text to image server-side (Sharp/Canvas/SVG)
- Upload as file layer in placement
- Printful prints the image file

**Approach B: EDM (Embedded Design Maker)**
- Customer types text directly in EDM
- EDM handles font rendering, positioning, effects
- Saved as template, ordered via API
- Printful renders the final print file

**Approach C: Printful Design Maker (non-embedded)**
- Only available on printful.com, not embeddable without EDM

### Placement Structure (Orders API v2)

```json
{
  "placements": [
    {
      "placement": "front",
      "technique": "dtg",
      "layers": [
        {
          "type": "file",
          "url": "https://our-cdn.com/design-with-text.png",
          "layer_options": []
        }
      ]
    }
  ]
}
```

### Embroidery Thread Colors

```json
{
  "placements": [
    {
      "placement": "embroidery_chest_left",
      "technique": "embroidery",
      "layers": [
        {
          "type": "file",
          "url": "https://our-cdn.com/embroidery-design.png",
          "layer_options": [
            {
              "name": "thread_colors",
              "value": ["#FFFFFF", "#10B981", "#0F172A"]
            }
          ]
        }
      ]
    }
  ]
}
```

Note: Printful v2 has **auto thread color detection** as default for embroidery, so manual thread color specification is optional.

### New Standard DTG Placement (2025 Change)

Printful standardized DTG front print areas to **15 x 18 inches** for select products and sizes. API users must:
- Specify placement in request body (`Files > Placement` or `Placements > Placement`)
- Design files should target 15x18" at 150 DPI minimum
- This equals **2250 x 2700 pixels** minimum for production

### Print File Specifications

| Technique | Format | Min DPI | Recommended | Notes |
|---|---|---|---|---|
| DTG | PNG, JPG | 150 | 300 | RGB color space |
| Embroidery | PNG, JPG, SVG | 150 | Vector preferred | Auto thread detection |
| Screen Print | SVG, PNG | 300 | Vector preferred | Limited colors |
| Sublimation | PNG, JPG | 150 | 300 | Full bleed supported |

### Accepted Formats
- PNG (recommended for transparency)
- JPG
- SVG (best for vector/embroidery)
- PDF

---

## 6. Order Creation with Custom Designs

### Full Order Flow with Personalized Design

```json
POST /v2/orders

{
  "recipient": {
    "name": "John Doe",
    "address1": "123 Main St",
    "city": "Berlin",
    "country_code": "DE",
    "zip": "10115"
  },
  "items": [
    {
      "source": "catalog",
      "catalog_variant_id": 4011,
      "quantity": 1,
      "placements": [
        {
          "placement": "front",
          "technique": "dtg",
          "layers": [
            {
              "type": "file",
              "url": "https://storage.skapara.com/designs/custom-123.png",
              "layer_options": []
            }
          ]
        },
        {
          "placement": "back",
          "technique": "dtg",
          "layers": [
            {
              "type": "file",
              "url": "https://storage.skapara.com/branding/skapara-mark.png"
            }
          ]
        }
      ]
    }
  ]
}
```

### Order Flow with EDM Template

```json
POST /v2/orders

{
  "recipient": { ... },
  "items": [
    {
      "source": "product_template",
      "product_template_id": 12345,      // From EDM onTemplateSaved
      "quantity": 1
      // No placements needed -- design is in the template
    }
  ]
}
```

---

## 7. Comparison with Current Approach (Printify + fal.ai + Sharp)

### Current Pipeline

```
Customer request
  --> fal.ai generates AI design image
  --> Sharp composites design onto 1024x1024 template (mockup-generator.ts)
  --> composition-renderer.ts renders multi-layer compositions (text + image)
  --> Upload to Supabase Storage
  --> Preview shown to customer (512px watermarked / 1024px authenticated)
  --> Production export at 3600x4800px (exportForProduction)
  --> Upload to Printify via API
  --> Create product with print_areas / variants
  --> Publish product
  --> Cron sync to Supabase
```

### Current Limitations

| Issue | Impact |
|---|---|
| Mockup templates are generic solid-color backgrounds (1024x1024) | Not photorealistic -- fallback when no template PNG exists |
| Limited product types (6 product types in print-areas.ts) | Cannot handle all 479 Printful products |
| No real product photography in mockups | Customer sees abstract preview, not actual product |
| Text rendering via node-canvas | Limited fonts, no effects (shadow, outline, curve) |
| No client-side design editing | All composition happens server-side |
| Printify API has Cloudflare blocking issues | Python urllib gets 403, must use curl |
| Printify rate limits require 1500-2000ms delays | Slow product creation pipeline |

### What Printful Offers Instead

| Feature | Printful | Current (Printify) |
|---|---|---|
| Mockup quality | Photorealistic, 2550+ scenes | Solid color backgrounds |
| Mockup generation | Async API with webhook | Manual Sharp composition |
| Self-render templates | mockup-templates endpoint with position data | Hardcoded PRINT_AREAS dict |
| Text rendering | EDM handles fonts, effects, curves | node-canvas basic text |
| Design layers | 5 file layers per placement via API | Multi-layer Sharp composite |
| Real-time preview | EDM with live pricing | Server roundtrip required |
| Background removal | Built-in (free) | Requires rembg sidecar (Docker) |
| Pattern design | All-Over Pattern Tool in EDM | Not available |
| Embroidery | Auto thread detection | Manual thread specification |
| Clipart | 3500+ free assets | None |
| Product catalog | 479 products | ~50 EU-compatible products |
| EU fulfillment | In-house (Latvia) + partners | P26 Germany, P410 Latvia |
| API stability | v2 beta, 120 req/min | v1, 120 req/min (Cloudflare issues) |

### Migration Benefits

1. **Eliminate rembg sidecar** -- Printful has built-in background removal
2. **Eliminate Sharp/Canvas server-side rendering** -- EDM handles design composition
3. **Eliminate hardcoded print areas** -- mockup-templates API provides actual coordinates
4. **Real product photography** -- No more solid-color fallback backgrounds
5. **Client-side design experience** -- EDM iframe vs. server roundtrips
6. **Better EU fulfillment** -- Printful has in-house EU production (Latvia)
7. **Unified mockup + order flow** -- Template-based ordering, no separate upload step

---

## 8. Fyul Merger Context (Printful + Printify)

### Timeline
- **November 2024**: Printful and Printify announce merger
- **November 2025**: New parent brand **FYUL** officially launches
- **Q1 2026**: FYUL House (9,000 sq m) in Riga, Latvia being finalized
- **2026-2027**: IPO planned

### What This Means for Us

- Both Printful and Printify APIs continue to operate independently
- No immediate forced migration between platforms
- Long-term, expect API convergence or unified platform
- **Strategic advantage**: Migrating to Printful now positions us for FYUL's unified platform
- Alex Saltonstall (Printful CEO) leads the joint company
- Printful's in-house EU production + Printify's 140+ provider network = best of both worlds

### Recommendation

Start building on Printful's API now. When FYUL unifies the platform, we will already be on the stronger API (Printful v2 with EDM). If they combine provider networks, we gain access to Printify's providers through Printful's superior API.

---

## 9. Opportunities for Our Design Studio

### Tier 1: Quick Wins (No EDM Required)

1. **Replace Sharp mockups with Printful Mockup Generator API**
   - Use `/v2/mockup-tasks` for async mockup generation
   - Webhook for completion notification
   - Photorealistic mockups instead of solid-color backgrounds
   - Multiple angles (front, back, side) automatically

2. **Use mockup-templates for client-side preview**
   - Fetch print area coordinates from `/v2/catalog-products/{id}/mockup-templates`
   - Use template image URLs as backgrounds in our canvas
   - Position customer designs using the exact coordinates
   - Real product photography as base layer

3. **Streamline order flow**
   - Direct `placements` array in order creation
   - No separate product creation step for custom orders
   - Upload design file, create order -- done

### Tier 2: EDM Integration (Enterprise Required)

4. **Embed full design studio in SKAPARA**
   - White-label EDM iframe in our `/designs` or `/shop/[id]` pages
   - Custom styling to match SKAPARA brand (dark theme, turquoise accents)
   - Localized in en_US, es_ES, de_DE
   - Live pricing in EUR

5. **AI + EDM hybrid flow**
   - Customer describes design in chat
   - fal.ai generates image
   - Inject into EDM via `sendMessage({ event: 'setUrlImageLayer', imageUrl })`
   - Customer refines in EDM (add text, adjust position, add more elements)
   - Save template, create order

6. **Advanced personalization**
   - Text with curved text, shadows, outlines
   - Clipart from Printful's 3500+ library
   - Multi-layer compositions
   - All-over pattern creation

### Tier 3: Future Opportunities

7. **Customer file library**
   - `has_external_user_file_library: true` in EDM config
   - Custom `onFilePickerRequested` handler
   - Store customer uploads in Supabase, serve to EDM

8. **Template marketplace**
   - Create SKAPARA-branded templates
   - Customers customize pre-made designs
   - Saved templates as starting points

---

## 10. Recommended Architecture for Next-Gen Design Module

### Phase 1: Mockup API Migration (2-3 weeks)

Replace current Sharp-based mockup generation with Printful's API.

```
Architecture:

frontend/src/lib/printful-mockup.ts          NEW -- Printful mockup API client
frontend/src/lib/printful-templates.ts        NEW -- Fetch/cache mockup templates
frontend/src/app/api/mockups/generate/route.ts  NEW -- Trigger async mockup gen
frontend/src/app/api/webhooks/printful/route.ts NEW -- Receive mockup_task_finished
```

**Key changes:**
- Fetch mockup templates (print area positions) from Printful API
- Cache templates in Supabase (daily refresh)
- Replace `PRINT_AREAS` hardcoded dict with dynamic Printful data
- Use Printful's template images as backgrounds instead of solid colors
- Async mockup generation with webhook notification

### Phase 2: Hybrid Design Studio (4-6 weeks)

Build a custom design studio that uses Printful's mockup-templates for positioning but our own canvas for rendering. This works WITHOUT EDM enterprise access.

```
Architecture:

frontend/src/components/products/DesignCanvas.tsx   NEW -- Fabric.js/Konva canvas
frontend/src/components/products/TextEditor.tsx     NEW -- Rich text controls
frontend/src/components/products/LayerPanel.tsx     NEW -- Layer management
frontend/src/lib/printful-catalog.ts               NEW -- Product catalog client
frontend/src/lib/design-export.ts                  NEW -- Canvas to print file
```

**Stack:**
- **Canvas**: Fabric.js or Konva.js for client-side design manipulation
- **Text**: Custom text rendering with Google Fonts
- **Positioning**: Printful mockup-templates provide exact coordinates
- **Preview**: Client-side canvas rendering on product template images
- **Export**: Canvas to PNG at production resolution
- **Order**: Upload PNG, create order via Printful v2 placements API

### Phase 3: EDM Integration (If Enterprise Approved) (2-3 weeks)

If we get EDM access, replace the custom canvas with Printful's embedded designer.

```
Architecture:

frontend/src/components/products/PrintfulEDM.tsx    NEW -- EDM iframe wrapper
frontend/src/app/api/edm/nonce/route.ts            NEW -- Server-side nonce gen
frontend/src/lib/printful-edm.ts                   NEW -- EDM config & helpers
```

**Integration points:**
- Server-side nonce generation (protects access token)
- `onTemplateSaved` -> save templateId to our design_compositions table
- `onDesignStatusUpdate` -> enable/disable "Add to Cart" button
- `onPricingStatusUpdate` -> display real-time pricing in our UI
- `setUrlImageLayer` -> inject AI-generated designs into EDM
- Custom styling via CSS custom properties

### Phase 4: AI-Powered Design Flow (2-3 weeks, after Phase 2 or 3)

Integrate AI generation directly into the design workflow.

```
Flow:

1. Customer opens design studio on product page
2. Types description in chat: "A cat with sunglasses coding"
3. fal.ai generates image (existing pipeline)
4. Image injected into design canvas/EDM
5. Customer refines: adds "SKAPARA" text, adjusts position
6. Real-time mockup preview on actual product
7. "Add to Cart" with custom design
8. Order placed with Printful, design file attached
```

### Technology Decisions

| Decision | Recommendation | Reason |
|---|---|---|
| Canvas library | **Fabric.js** | Better text support, more mature, MIT license |
| Mockup source | **Printful mockup-templates** | Real product photography, exact positions |
| Text rendering | **Canvas API (client-side)** | Eliminate server roundtrip, instant preview |
| AI generation | **Keep fal.ai** | Already integrated, good quality |
| Background removal | **Printful built-in** (EDM) or **rembg** (Phase 2) | Depends on EDM access |
| Order API | **Printful v2** | Better structured, leaky bucket rate limits |
| Storage | **Keep Supabase Storage** | Already integrated, works well |

### API Keys Needed

```env
# Printful Private Token (standard API access)
PRINTFUL_API_TOKEN=your_private_token

# Printful EDM Token (enterprise, if approved)
PRINTFUL_EDM_TOKEN=your_edm_token

# Keep existing
FAL_KEY=your_fal_key
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

### Migration Path Summary

```
NOW:     Printify + fal.ai + Sharp + node-canvas (server-side everything)
                            |
Phase 1: Printful Mockup API (photorealistic mockups, 2-3 weeks)
                            |
Phase 2: Custom Design Canvas (client-side Fabric.js, 4-6 weeks)
         OR
Phase 3: Printful EDM (if enterprise approved, 2-3 weeks)
                            |
Phase 4: AI + Design Studio hybrid (2-3 weeks)
                            |
FUTURE:  FYUL unified platform (when available)
```

### Cost Comparison

| Item | Current (Printify) | Printful |
|---|---|---|
| Platform fee | Free (pay per product) | Free (pay per product) |
| Product cost | Varies by provider | Generally 10-15% higher |
| Mockup generation | Free (our Sharp code) | Free (API) |
| Design tools | Our code (maintenance cost) | Free (EDM) |
| Background removal | rembg Docker (compute cost) | Free (built-in) |
| EU shipping | Provider-dependent | In-house EU (faster, more reliable) |
| Branding | Labels via select providers | Custom packaging, stickers, inserts, labels |
| API reliability | Cloudflare issues, 403s | Stable v2 beta |

---

## Sources

- [Printful API Documentation v2](https://developers.printful.com/docs/v2-beta/)
- [Printful API Documentation v1](https://developers.printful.com/docs/)
- [Printful API Overview](https://www.printful.com/api)
- [Printful Embedded Design Maker (Enterprise)](https://www.printful.com/enterprise/embedded-design-maker)
- [Printful EDM API Documentation](https://developers.printful.com/docs/edm/)
- [Printful Design Maker](https://www.printful.com/design-maker)
- [11 Things You Didn't Know Printful's Design Maker Could Do](https://www.printful.com/blog/design-maker-features)
- [Printful Product Personalization Tool](https://www.printful.com/product-personalization-tool)
- [DTG Print Placement Changes (Help Center)](https://help.printful.com/hc/en-us/articles/19074453565852-How-do-I-prepare-my-API-for-the-new-DTG-print-placement)
- [Printful PHP SDK (GitHub)](https://github.com/printful/php-api-sdk)
- [Printful Node.js SDK v2 (GitHub)](https://github.com/spencerlepine/printful-sdk-js-v2)
- [Printful Mockup Generator](https://www.printful.com/mockup-generator)
- [Printful vs Printify Comparison (PODBase)](https://www.podbase.com/blogs/printful-vs-printify)
- [Printful vs Printify 2026 (EcommerceCEO)](https://www.ecommerceceo.com/printful-vs-printify/)
- [FYUL Merger Announcement](https://www.printful.com/news/merger)
- [FYUL Rebranding (ASI Central)](https://members.asicentral.com/news/industry-news/december-2025/print-on-demand-platform-printfulprintify-rebrands-as-fyul/)
- [Printful + Printify = Fyul (Beyond Print)](https://www.beyond-print.net/printful-printify-fyul-a-merger-that-is-shaking-up-the-print-on-demand-market/)
- [Printful Personalization for Shopify (Help Center)](https://help.printful.com/hc/en-us/articles/20196872271516-How-does-Printful-s-personalization-feature-for-Shopify-work)
