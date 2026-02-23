# Design Workflow Reference

## Cost Reality

| Method | Cost per image | Quality | Speed |
|--------|---------------|---------|-------|
| **crawl_url** (Crawl4AI) | **$0 FREE** | High (real photos) | ~5s |
| fal_generate (schnell) | $0.003 | Draft quality | ~2s |
| fal_generate (dev) | $0.025 | Good | ~8s |
| fal_generate (flux-pro) | $0.05 | Best AI | ~12s |
| gemini_generate_image | **$0.13** | Good | ~5s |

**10 sourced images = $0. 10 Gemini images = $1.30. The math is obvious.**

## Sourced Design Procedure (MANDATORY FIRST PASS)

Attempt sourced designs BEFORE AI generation for every theme. The internet has billions of royalty-free images.

### Step 1: Search for TRANSPARENT PNG images FIRST

**Priority 1 — Transparent PNGs (NO bg removal needed):**
Call `crawl_url` on these directed URLs:
- `https://pngimg.com/search/?q={theme}` — transparent PNGs
- `https://www.cleanpng.com/free/{theme}.html` — transparent PNGs
- `https://www.stickpng.com/search?q={theme}` — transparent PNGs

**Priority 2 — Photos (NEED bg removal, use as fallback):**
Call `crawl_url` on these sites, then use `fal_remove_bg`:
- `https://unsplash.com/s/photos/{theme}` — royalty-free photos
- `https://www.pexels.com/search/{theme}/` — royalty-free photos

### Step 2: Extract the correct URL

**CRITICAL**: `crawl_url` returns page content with image URLs in the `images` array.
- Each image has `src` (direct URL) and `alt` (description)
- **USE the `src` field** for `supabase_upload_image`
- Prefer URLs ending in `.png` — they're more likely to have transparency.

### Step 3: Evaluate candidates

From search results, evaluate at least 5 candidates before generating with AI:
- **BEST**: PNG with transparent background (ready to use, no bg removal)
- **GOOD**: PNG/JPEG with white/simple background (needs bg removal)
- Prefer clean, modern aesthetic suitable for print-on-demand
- Reject busy backgrounds, low resolution, or copyrighted content

### Step 4: Process each selected image

For EACH image (target 5-7 per cycle):
1. `supabase_upload_image` with `{"image_url": "<the image_url field>"}` — persists to Storage
2. **Check if already transparent**: If the uploaded PNG already has a transparent background,
   skip directly to step 4. You can tell by: URL ends in `.png` AND came from a transparent PNG site.
3. `fal_remove_bg` on the Supabase URL — ONLY if background is NOT already transparent
4. `gemini_check_image` on the final URL — quality gate (score >= 7)
5. If passed: `printify_upload_image` + `supabase_insert` into designs table
   - Set `source_type: 'sourced'` in the designs record
   - Set `bg_removed_url` to the transparent version URL

### Step 5: Only THEN consider PAID AI generation

After all viable sourced images, if fewer than 5 total approved designs,
generate remaining with `fal_generate` (cheap, $0.003-$0.05).
Use `gemini_generate_image` ($0.13) ONLY as absolute last resort.

---

## Prompt Engineering for POD

**CRITICAL**: Image generation prompts must produce standalone artwork, NOT product mockups.

### Rules
1. **NEVER** mention product types (no "t-shirt", "mug", "hoodie", "poster")
2. **ALWAYS** include "white background" or "transparent background"
3. Describe the **artwork** — subject, style, colors, composition
4. Use style keywords: "vector illustration", "flat design", "watercolor", "line art", "bold graphic"

### Good Prompts
- "fierce phoenix rising from orange flames, vector illustration, bold colors, white background"
- "geometric skull with floral elements, flat design, pastel palette, transparent background"
- "abstract ocean waves with golden sun, watercolor style, blue and gold, white background"
- "retro cassette tape with tropical flowers, 80s aesthetic, neon colors, white background"

### Bad Prompts (NEVER use)
- "phoenix t-shirt design" — mentions product type → generates mockup
- "skull artwork on a black hoodie" — describes product, not artwork
- "coffee mug with mountain scene" — describes product, not artwork

---

## Image Quality Pipeline

**EVERY image MUST pass this pipeline before Printify upload:**

1. **Generate/Source**: `fal_generate` (primary) OR `gemini_generate_image` (fallback) OR `crawl_url` (sourced)
2. **Background Removal**: Auto-handled by `transparency_hook` for generated images.
   For SOURCED images, you MUST call `fal_remove_bg` manually.
3. **Store**: `supabase_upload_image` → returns public URL
4. **Quality Check**: `gemini_check_image` — score >= 7 required
5. **Printify Upload**: `printify_upload_image` — uses Supabase public URL

**If quality check fails (score < 7):**
- Generated images: retry with refined prompt (max 2 retries)
- Sourced images: discard and search for alternative

---

## FLUX Models (fal_generate)

| Model | Speed | Cost | Use Case |
|-------|-------|------|----------|
| schnell | ~2s | $0.003 | Quick drafts, exploration |
| dev | ~8s | $0.025 | Default for most designs |
| flux-pro | ~12s | $0.05 | Hero images, text-heavy, artistic |

Start with `dev` and upgrade to `flux-pro` for hero/featured designs.

---

## Moderation Checklist

Before setting moderation_status, verify:
1. **Copyright** — no recognizable characters, logos, or brand elements
2. **NSFW** — no nudity, violence, or offensive imagery
3. **Text/Spelling** — any text is correct and appropriate
4. **Resolution** — suitable for print (min 2400×2400 for apparel)
5. **Color Safety** — reproduces well on light and dark products

`gemini_check_image` automates all 5 checks. Score >= 7 with no critical issues → `"approved"`.
