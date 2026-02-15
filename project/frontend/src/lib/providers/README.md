# Image Generation Providers

Multi-provider image generation system with smart intent-based routing for the POD AI store.

## Architecture

```
User Request → LLM classifies intent → Router → Provider → Storage → DB
```

### Flow

1. **Intent Classification** — The chat LLM (Gemini) classifies each design request into a `DesignIntent` type based on the user's description
2. **Routing** — `router.ts` maps the intent to an ordered list of providers (primary + fallbacks), filtering out providers without API keys
3. **Prompt Engineering** — `prompt-engineer.ts` adapts the prompt per-provider (FLUX gets technical suffixes, OpenAI gets natural language, Ideogram/Recraft get clean prompts)
4. **Generation** — The provider calls its external API and returns images
5. **Persistence** — Images are persisted to Supabase Storage (`designs` bucket) since some providers return ephemeral URLs or base64
6. **Auto-save** — The design is saved to the `designs` table with the real provider name in `model` column

### Graceful Degradation

Only `FAL_KEY` is required. All other provider keys are optional. If a provider's API key is missing, the router skips it and tries the next one. With only `FAL_KEY` configured, the system behaves identically to the original FLUX-only implementation.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Shared interfaces: `ImageProvider`, `GenerationRequest`, `GenerationResponse`, `ProviderCapabilities` |
| `fal-provider.ts` | fal.ai FLUX.1 (schnell/dev/pro) — fast, cheap, good all-rounder |
| `openai-provider.ts` | OpenAI GPT Image 1 — best photorealism, native transparency |
| `ideogram-provider.ts` | Ideogram V3 — best text rendering in images |
| `recraft-provider.ts` | Recraft V3 — native SVG output, logos, vector illustrations |
| `router.ts` | Intent-based routing table with fallback chains |
| `prompt-engineer.ts` | Per-provider prompt adaptation |
| `storage-upload.ts` | Supabase Storage helpers for base64 and ephemeral URL persistence |
| `background-removal.ts` | Background removal (separate feature, uses fal.ai) |

## Providers

### fal.ai FLUX.1 (default)

| Variant | Speed | Cost | Best for |
|---------|-------|------|----------|
| schnell | ~2s | $0.003 | Quick drafts, previews |
| dev | ~8s | $0.025 | General purpose, good balance |
| flux-pro | ~12s | $0.050 | Artistic, patterns, high quality |

- Auth: `Authorization: Key $FAL_KEY`
- Response: direct image URLs (stable)
- Supports: negative prompt, img2img (dev only), seed

### OpenAI GPT Image 1

| Quality | Cost | Notes |
|---------|------|-------|
| medium | $0.042 | Default — good balance |
| high | $0.167 | Maximum quality |

- Auth: `Authorization: Bearer $OPENAI_API_KEY`
- Response: **always base64** (never URLs) — uploaded to Supabase Storage automatically
- Supports: native transparent background (`background: "transparent"`)
- Does NOT support: negative prompt, style parameter (style goes in prompt text)
- NSFW: HTTP 400 with "safety" in error message

### Ideogram V3

| Speed | Cost | Notes |
|-------|------|-------|
| TURBO | $0.04 | Default — fast |
| QUALITY | $0.10 | Maximum quality |

- Auth: `Api-Key: $IDEOGRAM_API_KEY` (custom header, not Bearer)
- Response: **ephemeral URLs** (expire) — persisted to Supabase Storage automatically
- Supports: negative prompt, `magic_prompt: AUTO` (Ideogram enhances prompts itself), `style_type`
- Text quality: **5/5** — best in class for logos with text, typography, slogans
- NSFW: `data[].is_image_safe` boolean field
- Aspect ratio format: `1x1`, `16x9`, `9x16` (with `x`, not `:`)

### Recraft V3

| Type | Cost | Notes |
|------|------|-------|
| Raster | $0.04 | PNG output |
| SVG | $0.08 | Native vector output |

- Auth: `Authorization: Bearer $RECRAFT_API_TOKEN`
- Response: URLs (stable ~24h) — persisted to Supabase Storage automatically
- Supports: negative prompt, native SVG when `style: "vector_illustration"`
- Style mapping: `vector/svg/icon/flat` → vector_illustration, `realistic/photo` → realistic_image, `logo` → logo_raster, default → digital_illustration
- Only provider with **native SVG support**

## Intent Routing Table

| Intent | Primary | Fallback 1 | Fallback 2 | Rationale |
|--------|---------|------------|------------|-----------|
| `artistic` | FLUX Pro | FLUX Dev | OpenAI | FLUX: best artistic coherence |
| `text-heavy` | Ideogram | OpenAI | FLUX Pro | Ideogram: 5/5 text rendering |
| `photorealistic` | OpenAI | FLUX Pro | FLUX Dev | GPT Image: 5/5 photorealism |
| `vector` | Recraft | Ideogram | FLUX Dev | Recraft: native SVG |
| `pattern` | FLUX Pro | FLUX Dev | Ideogram | FLUX: repetitive patterns |
| `quick-draft` | FLUX Schnell | FLUX Dev | — | Schnell: 2s, $0.003 |
| `general` | FLUX Dev | OpenAI | Ideogram | Dev: best cost/quality balance |

## Environment Variables

All variables are server-side only (no `NEXT_PUBLIC_` prefix). Configure in `frontend/.env.local`:

```
# Required (minimum for system to work)
FAL_KEY=

# Optional premium providers (graceful degradation if absent)
OPENAI_API_KEY=
IDEOGRAM_API_KEY=
RECRAFT_API_TOKEN=
```

## Storage

Generated images are stored in the Supabase Storage `designs` bucket (public). The bucket is auto-created on first upload if it doesn't exist. Files are organized by provider prefix:

```
designs/
  gen/          ← generic uploads
  openai/       ← GPT Image base64 uploads
  ideogram/     ← persisted ephemeral URLs
  recraft/      ← persisted expiring URLs
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Chat with design generation via `generate_design` tool (intent classified by LLM) |
| `/api/designs/generate` | POST | Direct design generation (accepts `intent` in body) |
| `/api/designs/estimate` | GET | Cost estimate (accepts `?intent=` query param) |

## Adding a New Provider

1. Create `new-provider.ts` implementing `ImageProvider` interface from `types.ts`
2. Handle image persistence (use `storage-upload.ts` helpers if URLs expire or response is base64)
3. Add the provider factory to the routing table in `router.ts`
4. Add provider name to `ProviderName` union in `types.ts`
5. Add prompt adaptation rules in `prompt-engineer.ts`

## Why Not Midjourney?

Midjourney does not offer a public REST API. Their only programmatic interface is through Discord bot commands, which is incompatible with a serverless architecture (no persistent connections, unpredictable latency, Discord ToS restrictions on automation). If they release a REST API in the future, it can be added following the pattern above.
