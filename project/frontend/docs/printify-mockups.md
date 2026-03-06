# Printify Mockups — Complete Documentation

> **Source**: Compiled from printify.com/mockup-generator/, developers.printify.com, printify.com/blog/, and printify.com/how-it-works/
> **Note**: The Printify Help Center (help.printify.com/hc/en-us/sections/22386403883665-Mockups) returns HTTP 403 for all automated fetches. This document aggregates all available mockup documentation from public Printify sources.

---

## Table of Contents

1. [What Is the Printify Mockup Generator?](#1-what-is-the-printify-mockup-generator)
2. [How the Mockup Generator Works](#2-how-the-mockup-generator-works)
3. [Mockup Types and Templates](#3-mockup-types-and-templates)
4. [Mockup Image Specifications](#4-mockup-image-specifications)
5. [Mockup Generator Features](#5-mockup-generator-features)
6. [Multi-Language and Emoji Support](#6-multi-language-and-emoji-support)
7. [Mockups via the Printify API](#7-mockups-via-the-printify-api)
8. [Mockup API — Image Object Properties](#8-mockup-api--image-object-properties)
9. [Mockup API — Print Area Image Positioning](#9-mockup-api--print-area-image-positioning)
10. [API Rate Limits for Mockup Generation](#10-api-rate-limits-for-mockup-generation)
11. [Mockup URL Structure](#11-mockup-url-structure)
12. [PlaceIt Integration](#12-placeit-integration)
13. [Best Practices for Better Mockups](#13-best-practices-for-better-mockups)
14. [Mockups for E-commerce Stores](#14-mockups-for-e-commerce-stores)
15. [Integration with the Product Creator](#15-integration-with-the-product-creator)

---

## 1. What Is the Printify Mockup Generator?

Printify's **Mockup Generator** is a free online tool that allows sellers to visualize designs on physical products before production. It is built into the Product Creator (editor) and generates high-resolution, watermark-free preview images of custom products.

### Key Facts

- **Free to use** — no subscription fees, no upfront costs
- **No watermarks** — all downloaded mockup images are clean
- **Unlimited downloads** — generate and download as many mockups as needed
- **1,300+ professional templates** — covers apparel, home decor, accessories, drinkware, and more
- **Multiple angles** — flat lays, lifestyle scenes, close-ups, and 360° views depending on the product
- **Instant preview** — mockups update in real time as designs are modified
- **High resolution** — suitable for marketing materials and e-commerce product listings

### Purpose

Mockups allow customers to form a mental picture of how the custom print will look on the physical product. Mockups done well are a critical conversion factor in e-commerce. Most POD platforms provide mockup generators so sellers can create realistic-looking product images without photo shoots or physical samples.

---

## 2. How the Mockup Generator Works

The mockup generation process follows four steps:

### Step 1 — Select a Product

Choose a product from Printify's catalog of 1,300+ items including:
- Apparel: T-shirts, hoodies, sweatshirts, tank tops, long sleeves, zip hoodies, kids clothing
- Headwear: Caps, snapbacks, dad hats, beanies, bucket hats
- Drinkware: Mugs, tumblers, bottles
- Accessories: Tote bags, mouse pads, desk mats, phone cases
- Footwear: Sneakers
- Home decor, stickers, posters, and more

### Step 2 — Customize the Design

Use the Product Creator's built-in tools:
- Upload custom artwork (PNG, SVG, JPG)
- Add text with 200+ supported fonts
- Add emojis (850+ available)
- Use free graphics from the Printify library
- Use AI Image Generator for original artwork
- Use Shutterstock integration for licensed imagery

### Step 3 — Preview Mockup Templates

Browse available mockup templates for the selected product:
- Multiple camera angles (front, back, left, right, close-up)
- Lifestyle scenes (models wearing apparel, styled flat lays, contextual environments)
- Customizable backgrounds on select items
- Color variant previews

### Step 4 — Download or Publish

- Download PNG mockups for unlimited offline use
- Publish directly to connected sales channels (Etsy, Shopify, TikTok Shop, Amazon, WooCommerce, etc.)
- Mockup images are automatically assigned as product listing images on publish

---

## 3. Mockup Types and Templates

### Flat Lay Mockups

Plain product laid flat on a surface. Best for showing the full design without model distortion. Common for:
- T-shirts, hoodies, crewnecks
- Tote bags
- Desk mats, mouse pads
- Posters

### Lifestyle Mockups

Products shown in real-world or modeled contexts:
- Apparel worn by diverse models
- Mugs on a desk or kitchen counter
- Tote bags being carried
- Sneakers on feet or styled on surfaces
- Caps worn on head

Lifestyle mockups significantly increase perceived product quality and drive higher conversion rates compared to plain flat lays.

### Close-Up Mockups

Zoomed-in views showing print detail, stitching, fabric texture, or embroidery quality. Important for:
- Embroidered headwear (gorras, snapbacks, beanies)
- DTG print quality demonstration
- Labels and tags

### 360° / Multiple Angle Mockups

Some products provide multiple standard angles:
- **Front** (`position: "front"`)
- **Back** (`position: "back"`)
- **Left side** (`position: "left"`)
- **Right side** (`position: "right"`)
- **Collar / detail** (`position: "collar"`)

---

## 4. Mockup Image Specifications

### Resolution and Format

- **Format**: JPG and PNG
- **Resolution**: High-resolution, suitable for e-commerce listings
- **Watermark**: None — all mockups are watermark-free
- **Background**: White or lifestyle background depending on template; some products support customizable backgrounds

### Mockup URL Structure

Generated mockup images are hosted on Printify's CDN:

```
https://images.printify.com/mockup/{product_id}/{variant_id}/{position_number}/{product_slug}.jpg
```

Example:
```
https://images.printify.com/mockup/5d15ca551e7ad86b6d4c5a68/12345/0/unisex-t-shirt.jpg
```

### Image Grouping

Mockups are **grouped by variants and position**:
- A single mockup image may represent multiple variants (e.g., all sizes of the same color share one mockup)
- Each mockup has a `position` field indicating the camera angle

---

## 5. Mockup Generator Features

### Customizable Backgrounds (Select Products)

Some products in the mockup generator allow changing the background color or scene:
- Solid color backgrounds
- Gradient backgrounds
- Scene/lifestyle backgrounds
- Transparent PNG option for external editing

### Design Placement Controls

Within the Product Creator, you can control:
- **X/Y position** of the design on the print area
- **Scale** (zoom in/out)
- **Rotation angle**
- **Pattern/repeat** option for all-over print products

### Multiple Print Areas

Products can have multiple print areas, each generating separate mockup angles:
- Front print area → front mockup
- Back print area → back mockup
- Sleeve area → sleeve close-up mockup

### Variant-Specific Mockups

Each color variant of a product generates its own set of mockups. When you switch between color swatches on a product page, the mockup images update to show the design on the correct color garment.

---

## 6. Multi-Language and Emoji Support

### Emoji Support

The Mockup Generator includes approximately **850 emojis** from Printify's own collection.

- Access via the emoji button in the text tool
- Mobile/tablet emojis are automatically matched to the available collection
- Emojis can be added to products and packaging inserts
- **Limitation**: Apple's proprietary emojis cannot be used due to licensing restrictions

### Supported Languages and Character Sets

The Mockup Generator text tool supports all of the following languages and scripts:

| Script Family | Languages |
|---|---|
| Latin Extended | Most European languages |
| Cyrillic | Russian, Ukrainian, Bulgarian, Serbian, etc. |
| Greek | Modern and Classical Greek |
| Hebrew | Hebrew |
| Arabic | Arabic, Farsi, Urdu |
| Devanagari | Hindi, Marathi, Sanskrit |
| Bengali | Bengali |
| Thai | Thai |
| Tamil | Tamil |
| Telugu | Telugu |
| Gujarati | Gujarati |
| Myanmar | Burmese |
| Sinhala | Sinhala |
| Oriya | Odia |
| CJK | Japanese, Chinese (Simplified and Traditional), Korean |
| Vietnamese | Vietnamese |

### Using Non-Latin Text

1. Open a product in the Mockup Generator
2. Click **Custom text** and type or paste text in your preferred language
3. If an error appears, select a compatible font from the font picker
4. The tool automatically filters to only display fonts that support the chosen language/script
5. Click the **Emoji button** to add emojis alongside text

### Font Support

The text tool includes 200+ font families organized by supported character sets. Fonts are shown/hidden dynamically based on the language being used to prevent rendering errors.

---

## 7. Mockups via the Printify API

For developers integrating Printify programmatically, mockups are generated automatically as part of the product creation and publishing workflow. There is no separate mockup-generation endpoint — mockups are a read-only output of the product object.

### Mockups API Endpoint

Mockup images are returned as part of the **Get Product** response:

```
GET /v1/shops/{shop_id}/products/{product_id}.json
```

The `images` array in the response contains all generated mockup images.

### Mockups API — Internal URL

The mockups API is also accessible internally at:
```
/mockups/api/
```

---

## 8. Mockup API — Image Object Properties

Each mockup image object in the `images` array of a product response contains:

| Property | Type | Description |
|---|---|---|
| `src` | `string` | URL of the mockup image, hosted on Printify's CDN |
| `variant_ids` | `integer[]` | Array of variant IDs illustrated by this mockup image |
| `position` | `string` | Camera position / part of the product being displayed (e.g., `"front"`, `"back"`, `"left"`, `"other"`) |
| `is_default` | `boolean` | Whether this is the title/featured image for the product in sales channels |

### Example Response Fragment

```json
{
  "images": [
    {
      "src": "https://images.printify.com/mockup/5d15ca551e7ad86b6d4c5a68/12345/0/unisex-t-shirt.jpg",
      "variant_ids": [12345, 12346, 12347, 12348],
      "position": "front",
      "is_default": true
    },
    {
      "src": "https://images.printify.com/mockup/5d15ca551e7ad86b6d4c5a68/12345/1/unisex-t-shirt.jpg",
      "variant_ids": [12345, 12346, 12347, 12348],
      "position": "back",
      "is_default": false
    }
  ]
}
```

### Notes on Variant Grouping

- Multiple variants (e.g., sizes S, M, L, XL in the same color) typically share a single mockup image
- Different colors each have their own distinct set of mockup images
- The `variant_ids` array indicates which variants a given mockup represents

---

## 9. Mockup API — Print Area Image Positioning

When creating a product via the API, you control how the design appears on the mockup by specifying positioning parameters for each print area image:

```json
{
  "print_areas": [
    {
      "variant_ids": [12345, 12346],
      "placeholders": [
        {
          "position": "front",
          "images": [
            {
              "id": "upload_id_here",
              "x": 0.5,
              "y": 0.45,
              "scale": 0.8,
              "angle": 0
            }
          ]
        }
      ]
    }
  ]
}
```

### Positioning Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | ID of the uploaded image (from `/v1/uploads/images.json`) |
| `x` | `float` | Horizontal center position of the design, as a fraction (0.0 = left, 0.5 = center, 1.0 = right) |
| `y` | `float` | Vertical center position of the design, as a fraction (0.0 = top, 0.5 = center, 1.0 = bottom) |
| `scale` | `float` | Size of the design relative to the print area (1.0 = full area width) |
| `angle` | `integer` | Rotation in degrees (0–360) |

### Pattern/Repeat Mode

For all-over print products, images can be set to tile/repeat across the print area:

```json
{
  "id": "upload_id_here",
  "x": 0.5,
  "y": 0.5,
  "scale": 0.3,
  "angle": 0,
  "pattern": true
}
```

### Recommended Vertical Positioning

For most DTG garments (t-shirts, hoodies), the common starting vertical position is:
- `y: 0.45` — places the design slightly above center, which is the natural visual center for chest placement

---

## 10. API Rate Limits for Mockup Generation

Mockup generation is tied to product creation and publishing. The following limits apply:

| Operation | Limit |
|---|---|
| Product publishing endpoint | 200 requests per 30 minutes |
| Mockup generation (via product creation) | Subject to daily limit for API integrations |
| Product creation via Order creation | Not limited (exempt from rate limits) |

> **Important**: Integrations that use the Printify API to create products and generate mockups have an additional daily limit beyond the standard API rate limit. Plan batch operations accordingly.

---

## 11. Mockup URL Structure

### CDN URL Pattern

```
https://images.printify.com/mockup/{product_id}/{variant_id}/{image_index}/{product_slug}.jpg
```

### Components

| Segment | Example | Description |
|---|---|---|
| `{product_id}` | `5d15ca551e7ad86b6d4c5a68` | Printify internal product ID |
| `{variant_id}` | `12345` | Variant ID (color/size combination) |
| `{image_index}` | `0`, `1`, `2` | Index of the mockup image (position order) |
| `{product_slug}` | `unisex-t-shirt` | Product name slug |

### Mockup Images in the Database (SKAPARA Context)

In the SKAPARA store, mockup images from the Printify sync are stored in the `product_variants` table under the `image_url` column. This field is populated by `syncProductFromPrintify()` in `frontend/src/lib/printify-sync.ts`, which cross-references `variant_ids` from the product's `images` array to assign the correct mockup URL to each variant.

The `ProductCard` component uses these per-variant URLs to enable color toggle previews:
- `colorImages` — `Record<color, url>` built from `product_variants.image_url`
- Source: `/api/products/route.ts` lines 88–93

---

## 12. PlaceIt Integration

Printify integrates with **PlaceIt** for extended lifestyle mockup templates. PlaceIt provides:
- Model lifestyle photos across diverse demographics
- Apparel mockups in real-world settings
- Mockup scenes for accessories, home decor, and drinkware

PlaceIt is accessible via Printify's editor through an embedded iframe:
```
https://placeit.net/printify
```

PlaceIt mockups supplement Printify's own mockup library and are particularly useful for:
- Lifestyle scenes not available in Printify's native library
- Custom/branded backgrounds
- Model diversity and body types

---

## 13. Best Practices for Better Mockups

### Design Quality

- **Resolution**: Upload designs at the highest resolution possible. For DTG prints, use 300 DPI at print size. For sublimation, match exact canvas dimensions.
- **Transparent backgrounds**: Use PNG with transparent background for apparel — the garment color shows through, making it look natural.
- **Color accuracy**: Colors may appear differently on-screen vs. in print. Order sample products to verify.
- **File format**: PNG for transparent backgrounds, JPG for photographic designs (lower file size).

### Positioning

- **Visual center vs. geometric center**: The visual center of a garment is slightly above the geometric center. Use `y: 0.45` as a starting point for chest placement.
- **Safety margins**: Keep important design elements away from the edges of the print area to avoid cut-off.
- **Scale**: Do not over-scale. A design at 80–90% of the print area width looks professional; 100% can appear stretched.

### Mockup Selection

- Use **at least 3–5 mockup images** per product listing (front, back, lifestyle, detail).
- Lead with the **lifestyle mockup** as the main/default image — it performs better in search listings.
- Include a **flat lay** to show the full design without model distortion.
- Add a **close-up** for products with fine detail (embroidery, sublimation gradients, small text).

### Color Variants

- Generate mockups for every color variant available.
- Enable **color toggle** in the store (requires `image_url` populated in `product_variants`).
- The default mockup (`is_default: true`) is used as the product thumbnail in search results.

### Lifestyle Mockups

- Choose models/scenes that match your target audience demographics.
- Use consistent lighting across all mockups for a professional look.
- Avoid cluttered backgrounds that distract from the product.
- For seasonal products, use contextually appropriate scenes (outdoor for summer, cozy indoor for winter).

### Technical Tips

- Printify auto-generates mockups when a product is published — no manual download required.
- Mockup images sync to connected sales channels automatically on publish.
- If `image_url` is NULL in the database after sync, trigger a manual cron sync: `GET /api/cron/sync-printify` to repopulate.
- Mockups are **read-only** via the API — they cannot be manually uploaded or replaced through the API. To change a mockup, update the product design in the editor.

---

## 14. Mockups for E-commerce Stores

### Why Mockups Matter

Mockups are the primary visual sales tool for print-on-demand products:
- Customers cannot physically inspect the product before purchase
- High-quality mockups directly correlate with conversion rates
- Lifestyle mockups build emotional connection and help customers envision owning the product
- Professional mockups signal brand quality and build trust

### Mockup Requirements by Sales Channel

| Channel | Minimum Images | Recommended Format | Background |
|---|---|---|---|
| Etsy | 1 (10 max) | JPG, PNG | White or lifestyle |
| Shopify | 1 | JPG, PNG | Any |
| TikTok Shop | 1 (min 800×800px) | JPG | White required for main |
| Amazon | 1 (pure white main) | JPG | White for main image |
| WooCommerce | 1 | JPG, PNG | Any |

### Recommended Mockup Set per Product

1. **Main image**: Lifestyle mockup (front, most visually appealing color variant)
2. **Image 2**: Flat lay front
3. **Image 3**: Back mockup
4. **Image 4**: Close-up / detail shot
5. **Image 5+**: Additional color variants or lifestyle angles

### Amazon-Specific Requirements

Amazon requires the main product image to have a **pure white background** (RGB 255, 255, 255). Printify's flat lay mockups on white backgrounds meet this requirement. Lifestyle mockups should be used as secondary images.

---

## 15. Integration with the Product Creator

### Workflow: Design → Mockup → Publish

```
1. Open Product Creator (editor)
2. Upload design or create with built-in tools
3. Position design on print area (x, y, scale, angle)
4. Preview automatically-generated mockups in real time
5. Browse mockup template gallery and select preferred views
6. Publish to connected sales channels
7. Mockups auto-sync to the store as product images
8. Cron sync populates variant image_urls in database
```

### Mockup Preview in the Editor

- The product editor shows a live preview of how the design will look on the mockup
- As you adjust position, scale, and rotation, the mockup updates instantly
- Switch between color variants in the editor to preview each one

### Publishing and Mockup Assignment

When a product is published via the API using `POST .../publish.json`, Printify generates mockups for all variants and positions. These are returned in the product's `images` array on subsequent `GET` requests.

The Printify sync cron job (`syncProductFromPrintify` in `frontend/src/lib/printify-sync.ts`) then maps these image URLs to the local database:
- `products.images` — stores the full mockup image array as JSONB
- `product_variants.image_url` — stores the per-variant mockup URL for color toggles

---

## Additional Resources

- **Printify Mockup Generator**: https://printify.com/mockup-generator/
- **PlaceIt via Printify**: https://placeit.net/printify
- **Printify API Reference**: https://developers.printify.com/
- **Product Creator**: https://printify.com/app/editor
- **Printify Help Center** (requires browser access — blocks automated fetching): https://help.printify.com/hc/en-us/sections/22386403883665-Mockups
- **Internal sync function**: `frontend/src/lib/printify-sync.ts` — `syncProductFromPrintify()`
- **API products endpoint**: `frontend/src/app/api/products/route.ts`

---

*Document compiled from: printify.com/mockup-generator/, developers.printify.com, printify.com/blog/mockup-generator/, printify.com/blog/mockup-generator/ font documentation, printify.com/how-it-works/, and printify.com/blog/print-on-demand/. Last updated: 2026-03-01.*
