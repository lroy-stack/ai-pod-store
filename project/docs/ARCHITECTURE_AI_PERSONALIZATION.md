# Skapara AI Personalization System — Estudio Arquitectonico Completo

> **Autor**: Claude Opus 4.6 | **Fecha**: 2026-02-23
> **Objetivo**: Transformar Skapara de una tienda POD con personalización básica en una experiencia interactiva de diseño impulsada por IA.
> **Estado**: Traducido a `app_spec.txt` Sections 15-17 + `feature_list.json` (IDs 244-286).

---

## SEPARACIÓN V1 / V2

| Fase | Scope | app_spec | Prioridad | Estado |
|------|-------|----------|-----------|--------|
| **V1 Comercial** | Pipeline E2E + Design Studio básico + Producción sólida | Section 15 (38h) + Section 16 (50h) | P1 MVP | Definido en app_spec |
| **V2 Inteligencia** | Embeddings, RAG, preferencias implícitas, queue distribuida | Section 17 (40h) | P3 VISION | Placeholder solo |

**V1 = Revenue Enabler** — lo que vende: "Diseña tu producto en 10 segundos y se imprime exactamente como lo ves."
**V2 = Optimización futura** — mejora la experiencia después de que V1 esté generando revenue.

### Qué es V1 (implementar ahora):
- Fix pipeline roto (Fases 1-2 de este doc → Section 15)
- AI Design Studio con 3 tabs, 8 presets, composición, producción (Fases 2-6 parciales → Section 16)
- Historial simple (últimos 10 diseños)
- Chat integration básica (2 tools nuevos)
- Cost guard server-side

### Qué es V2 (implementar después de 1000+ pedidos/mes):
- Embeddings de preferencias (768-dim)
- RAG personalizado para recomendaciones
- Aprendizaje implícito automático
- Queue distribuida con Realtime
- Cache avanzada (Redis)
- Cancellation multi-worker
- A/B testing de presets

---

## FASE 1 — AUDITORÍA UX COMPLETA

### 1.1 Mapa de Flujo Actual (End-to-End)

```
┌─────────────┐    ┌───────────┐    ┌───────────────┐    ┌──────────┐    ┌──────────┐
│  Landing     │───▶│  Shop     │───▶│ Product Detail│───▶│  Cart    │───▶│ Checkout │
│  /[locale]/  │    │  /shop    │    │  /shop/[id]   │    │  /cart   │    │/checkout │
└─────────────┘    └───────────┘    └───────────────┘    └──────────┘    └──────────┘
       │                                    │
       │         ┌──────────┐               │
       └────────▶│  Chat    │◀──────────────┘
                 │  /chat   │  (bidireccional)
                 └──────────┘
```

### 1.2 Puntos de Fricción Identificados

| # | Ubicación | Problema | Severidad | Impacto |
|---|-----------|----------|-----------|---------|
| F1 | Landing → Shop | Solo CTA al chat, no al catálogo directo | Media | Pérdida de usuarios que quieren browsear |
| F2 | Shop → Product | Click en card abre DetailPanel (sidebar) sin transición visual | Media | Confusión contextual |
| F3 | Product Detail | Personalización texto-only (6 fuentes, 3 tamaños, sin imagen) | **Alta** | Valor percibido bajo |
| F4 | Product Detail | `onPersonalized()` callback guarda en useState local → se pierde | **Crítica** | Personalización rota end-to-end |
| F5 | Product → Cart | `addToCart()` no acepta `personalizationId` | **Crítica** | Carrito ignora personalización |
| F6 | Cart View | Sin preview de personalización en items del carrito | Alta | Usuario no ve lo que ordenó |
| F7 | Cart → Checkout | No hay revisión de orden antes de redirect a Stripe | Alta | Confianza baja |
| F8 | Checkout | Formulario de pago es stub (`[Payment form placeholder]`) | Media | UX incompleta (Stripe Checkout externo funciona) |
| F9 | Chat → Product | Seleccionar producto desde chat abre DetailPanel pero no product page | Media | Contexto limitado |
| F10 | Design Gen | Generación IA existe pero solo vía chat tool, no desde product page | **Alta** | Feature oculta |
| F11 | Preview | SIZE_MAP inconsistente (3 mapas: CSS, Canvas, Producción) | Alta | WYSINWYG |
| F12 | Color | No detecta contraste bajo (texto blanco sobre producto blanco) | Media | Texto ilegible |
| F13 | Mobile | Personalización dialog no optimizado para 375px | Media | UX degradada en móvil |
| F14 | Auth | Anónimos no pueden generar diseños (limit: 0/month) | Media | Barrera de conversión |

### 1.3 Flujo de Personalización Actual (ROTO)

```
ProductPersonalizer Dialog
  ├─ Input: text, font (6), color, size (S/M/L), position (top/center/bottom)
  ├─ Preview: CSS overlay + Canvas server preview (2 métodos diferentes)
  ├─ Output: onPersonalized(data) → callback
  │
  ▼
DetailPanel / ProductDetailClient
  ├─ useState(personalizationData)  ← SE PIERDE al navegar
  ├─ NUNCA llama POST /api/designs/personalize
  ├─ NUNCA pasa personalizationId al carrito
  │
  ▼
Cart (useCart.tsx)
  ├─ addToCart(productId, quantity, variant?, title?, price?)
  ├─ SIN parámetro personalizationId
  ├─ API de carrito SÍ acepta personalization_id en body
  │
  ▼
Checkout (create-session/route.ts)
  ├─ Busca personalization_id en cart_items
  ├─ Si existe → crea temp product en Printify con overlay
  ├─ PERO: personalization_id NUNCA existe (bug F4/F5)
  │
  ▼
RESULTADO: Personalización visual en UI pero NUNCA se imprime
```

### 1.4 Mapa de Interacción Chat

```
ChatArea.tsx (893 líneas)
  ├─ useChat (AI SDK 6) → POST /api/chat
  ├─ 24 tools disponibles
  ├─ Artifact Registry: 16 tipos de componente
  │
  ├─ Tools de DISEÑO:
  │   ├─ generate_design → routeDesign() → FAL/OpenAI/Ideogram/Recraft
  │   ├─ customize_design → img2img (modificar diseño existente)
  │   ├─ remove_background → rembg container
  │   └─ personalize_product → sugiere texto personalizado (NO genera imagen)
  │
  ├─ Tools de COMPRA:
  │   ├─ product_search / browse_catalog / get_recommendations
  │   ├─ add_to_cart (resuelve variantes automáticamente)
  │   ├─ create_checkout (needsApproval: true)
  │   └─ confirm_checkout → Stripe
  │
  └─ Streaming: SSE via toUIMessageStreamResponse()
```

---

## FASE 2 — ARQUITECTURA AI PERSONALIZATION MODEL

### 2.1 Visión: De "Texto sobre producto" a "Estudio de diseño asistido por IA"

```
┌─────────────────────────────────────────────────────────────┐
│                    NUEVO: Design Studio                       │
│  ┌────────┐  ┌────────────┐  ┌─────────────┐  ┌─────────┐  │
│  │  Text   │  │  AI Prompt │  │  Image      │  │  Style   │  │
│  │  Editor │  │  Generator │  │  Upload     │  │  Presets │  │
│  └────┬───┘  └─────┬──────┘  └──────┬──────┘  └────┬────┘  │
│       │            │                │               │        │
│       └────────────┴────────────────┴───────────────┘        │
│                           │                                   │
│                    ┌──────▼──────┐                            │
│                    │   Composer  │ ← Combina capas            │
│                    └──────┬──────┘                            │
│                           │                                   │
│               ┌───────────▼───────────┐                      │
│               │   Live Preview on     │                      │
│               │   Product Mockup      │                      │
│               └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Motor de IA: Gemini 2.5 Flash como Orquestador

**Por qué Gemini 2.5 Flash (no FAL/DALL-E)**:
- YA se usa como modelo de chat (`google('gemini-2.5-flash')` en `route.ts:1`)
- Multimodal nativo: entiende imágenes + texto → genera texto/instrucciones
- Latencia baja (~1-3s vs FAL ~5-15s)
- Costo bajo (~$0.15/1M input, $0.60/1M output)
- Tool calling nativo → orquesta FAL/rembg como herramientas

**Arquitectura de 3 capas**:

```
Capa 1: Gemini 2.5 Flash (Orquestador)
  ├─ Interpreta intención del usuario
  ├─ Clasifica tipo de diseño (artistic/text-heavy/vector/pattern/photo)
  ├─ Genera prompt optimizado para el proveedor target
  ├─ Selecciona paleta de colores y estilo
  ├─ Evalúa calidad del resultado
  └─ Sugiere refinamientos

Capa 2: Proveedores de Generación (ya implementados)
  ├─ FAL FLUX Pro/Dev/Schnell ($0.003-$0.05/imagen)
  ├─ OpenAI DALL-E 3 (backup)
  ├─ Ideogram (texto sobre imagen)
  ├─ Recraft (vectores/SVG)
  └─ rembg (background removal, self-hosted)

Capa 3: Pipeline de Composición (NUEVO)
  ├─ Canvas server-side (Node canvas / Sharp)
  ├─ Overlay de texto sobre diseño IA
  ├─ Composición multi-capa (diseño + texto + efectos)
  └─ Exportación a resolución de producción (300 DPI)
```

### 2.3 Flujo de Generación IA desde Product Page

```
Usuario en Product Detail
  │
  ├─ Click "Personalizar" → Abre DesignStudio Dialog
  │
  ├─ Tab 1: TEXTO (existente, mejorado)
  │   ├─ 12 fuentes (6 nuevas: Pacifico, Dancing Script, Permanent Marker, etc.)
  │   ├─ 16 color swatches + picker custom
  │   ├─ Alineación (left/center/right)
  │   ├─ Efectos (outline, shadow)
  │   └─ Preview en tiempo real sobre mockup
  │
  ├─ Tab 2: IA DESIGN (NUEVO)
  │   ├─ Prompt input con sugerencias contextuales
  │   │   └─ "Diseño para camiseta", "Logo minimalista", "Arte abstracto"
  │   ├─ Style presets grid (8 estilos predefinidos):
  │   │   ├─ Minimalist, Vintage, Geometric, Watercolor
  │   │   ├─ Pop Art, Line Art, Botanical, Typography
  │   │   └─ Cada preset: nombre, thumbnail, prompt_suffix, negative_prompt
  │   ├─ Click "Generar" →
  │   │   1. Gemini clasifica intent
  │   │   2. Router selecciona proveedor
  │   │   3. Genera imagen (1024x1024)
  │   │   4. rembg remove background
  │   │   5. Preview overlay sobre mockup del producto
  │   ├─ Variaciones: "Generar 3 más" → 3 variantes paralelas
  │   ├─ Refinamiento: "Más azul", "Sin fondo", "Más grande"
  │   │   └─ Gemini reescribe prompt → regenera
  │   └─ Composición: Combinar diseño IA + texto personalizado
  │
  ├─ Tab 3: UPLOAD (NUEVO)
  │   ├─ Drag & drop o file input (max 10MB)
  │   ├─ Auto rembg en upload
  │   ├─ Crop/resize tool
  │   └─ Preview sobre mockup
  │
  └─ Botón "Aplicar y Añadir al Carrito"
      ├─ POST /api/designs/personalize (guarda en DB)
      ├─ Retorna personalizationId
      ├─ addToCart(productId, qty, variant, ..., personalizationId)
      └─ Redirect a Cart con preview
```

### 2.4 API Endpoints Nuevos

```
NUEVO  POST /api/designs/ai-generate
       Body: { prompt, style_preset?, product_id, product_type, intent? }
       Auth: Required (free: 5/month, premium: 50/month)
       Response: { image_url, prompt_used, intent, provider, cost_usd, generation_id }

NUEVO  POST /api/designs/ai-generate/refine
       Body: { generation_id, refinement_prompt }
       Auth: Required (same quota as generate)
       Response: { image_url, prompt_used, generation_id }

NUEVO  POST /api/designs/ai-generate/variations
       Body: { generation_id, count: 3 }
       Auth: Required (costs 3 credits)
       Response: { variations: [{ image_url, generation_id }] }

NUEVO  POST /api/designs/compose
       Body: { layers: [{ type: 'ai'|'text'|'upload', data }], product_type }
       Auth: Required
       Response: { composite_url, preview_url }

EXIST  POST /api/designs/personalize       ← FIX: conectar con frontend
EXIST  GET  /api/designs/preview-text      ← FIX: SIZE_MAP consistency
EXIST  POST /api/designs/generate          ← KEEP: chat tool route
```

### 2.5 Gemini 2.5 Flash Integration Detail

```typescript
// Nuevo: frontend/src/lib/ai-design-orchestrator.ts

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, tool } from 'ai'

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

interface DesignRequest {
  userPrompt: string
  productType: string        // 'tshirt' | 'hoodie' | 'mug' | ...
  stylePreset?: string       // 'minimalist' | 'vintage' | ...
  previousDesignUrl?: string // Para refinamiento
  userPreferences?: {        // De memoria persistente
    favoriteColors: string[]
    preferredStyles: string[]
    pastDesignPrompts: string[]
  }
}

interface OrchestratorResult {
  engineeredPrompt: string
  negativePrompt: string
  intent: DesignIntent
  provider: 'fal-flux-pro' | 'fal-dev' | 'ideogram' | 'recraft' | 'openai'
  suggestedColors: string[]
  confidence: number          // 0-1, cuán seguro está de la clasificación
  explanation: string         // Para debug/UX: "Clasifiqué como 'vector' porque..."
}

export async function orchestrateDesign(req: DesignRequest): Promise<OrchestratorResult> {
  const systemPrompt = `You are a design director for a print-on-demand store.
Given a user's request and product context, you MUST:
1. Engineer an optimal image generation prompt
2. Classify the design intent
3. Select the best provider
4. Suggest a color palette that works on ${req.productType}

PRODUCT PRINT CONSTRAINTS:
- T-shirt: 400x500px print area (centered chest)
- Hoodie: 420x480px (centered, slightly lower)
- Mug: 350x300px (wrap-around, horizontal orientation)
- Phone case: 300x550px (vertical, edge-to-edge)
- Tote bag: 400x500px (centered)

PROVIDER CAPABILITIES:
- fal-flux-pro: Best for artistic, creative designs ($0.05, 5-10s)
- fal-dev: Good general purpose ($0.025, 3-8s)
- ideogram: Best for text-in-image, logos ($0.08, 5-12s)
- recraft: Best for vectors, flat designs, SVG ($0.04, 3-8s)
- openai: Best for photorealistic ($0.04, 8-15s)

${req.userPreferences ? `USER HISTORY:
- Favorite colors: ${req.userPreferences.favoriteColors.join(', ')}
- Preferred styles: ${req.userPreferences.preferredStyles.join(', ')}
- Past prompts: ${req.userPreferences.pastDesignPrompts.slice(-5).join(' | ')}` : ''}

Respond in JSON format.`

  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    prompt: `User request: "${req.userPrompt}"
Product: ${req.productType}
${req.stylePreset ? `Style preset: ${req.stylePreset}` : ''}
${req.previousDesignUrl ? `Refining previous design (see image)` : 'New design'}`,
    maxOutputTokens: 1024,
  })

  return JSON.parse(text) as OrchestratorResult
}
```

**Costo por generación orquestada**:
- Gemini clasificación: ~500 tokens input + ~200 output = ~$0.0002
- FAL generación: $0.003 (schnell) a $0.05 (pro)
- rembg: $0 (self-hosted)
- **Total: $0.003 - $0.05 por diseño** (vs $0.13 con Gemini image gen directo)

### 2.6 Style Presets Architecture

```typescript
// frontend/src/lib/design-presets.ts

export interface StylePreset {
  id: string
  name: Record<string, string>      // { en, es, de }
  description: Record<string, string>
  thumbnail: string                  // /presets/{id}.webp
  promptSuffix: string              // Appended to user prompt
  negativePrompt: string
  preferredIntent: DesignIntent
  suggestedColors: string[]
  tags: string[]
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'minimalist',
    name: { en: 'Minimalist', es: 'Minimalista', de: 'Minimalistisch' },
    description: { en: 'Clean lines, simple shapes', es: 'Líneas limpias, formas simples', de: 'Klare Linien, einfache Formen' },
    thumbnail: '/presets/minimalist.webp',
    promptSuffix: 'minimalist design, clean lines, simple geometry, white space, modern',
    negativePrompt: 'cluttered, busy, ornate, detailed texture',
    preferredIntent: 'vector',
    suggestedColors: ['#000000', '#FFFFFF', '#2563EB', '#DC2626'],
    tags: ['modern', 'clean', 'simple'],
  },
  {
    id: 'vintage',
    name: { en: 'Vintage', es: 'Vintage', de: 'Vintage' },
    description: { en: 'Retro vibes, distressed textures', es: 'Vibraciones retro, texturas desgastadas', de: 'Retro-Vibes, abgenutzte Texturen' },
    thumbnail: '/presets/vintage.webp',
    promptSuffix: 'vintage retro style, distressed texture, faded colors, 1970s aesthetic',
    negativePrompt: 'modern, neon, digital, clean, sharp',
    preferredIntent: 'artistic',
    suggestedColors: ['#8B4513', '#DAA520', '#2F4F4F', '#CD853F'],
    tags: ['retro', 'classic', 'aged'],
  },
  {
    id: 'geometric',
    name: { en: 'Geometric', es: 'Geométrico', de: 'Geometrisch' },
    description: { en: 'Bold shapes, patterns', es: 'Formas audaces, patrones', de: 'Kühne Formen, Muster' },
    thumbnail: '/presets/geometric.webp',
    promptSuffix: 'geometric design, bold shapes, abstract patterns, mathematical precision',
    negativePrompt: 'organic, natural, soft, blurry',
    preferredIntent: 'vector',
    suggestedColors: ['#1E3A5F', '#E74C3C', '#F39C12', '#2ECC71'],
    tags: ['abstract', 'bold', 'pattern'],
  },
  {
    id: 'watercolor',
    name: { en: 'Watercolor', es: 'Acuarela', de: 'Aquarell' },
    description: { en: 'Soft washes, artistic flow', es: 'Lavados suaves, flujo artístico', de: 'Sanfte Aquarelle, künstlerischer Fluss' },
    thumbnail: '/presets/watercolor.webp',
    promptSuffix: 'watercolor painting style, soft edges, color bleeding, artistic brush strokes',
    negativePrompt: 'sharp edges, digital, vector, geometric',
    preferredIntent: 'artistic',
    suggestedColors: ['#87CEEB', '#FF6B6B', '#98D8C8', '#F7DC6F'],
    tags: ['soft', 'artistic', 'organic'],
  },
  {
    id: 'pop-art',
    name: { en: 'Pop Art', es: 'Arte Pop', de: 'Pop-Art' },
    description: { en: 'Bold colors, comic style', es: 'Colores audaces, estilo cómic', de: 'Kräftige Farben, Comic-Stil' },
    thumbnail: '/presets/pop-art.webp',
    promptSuffix: 'pop art style, bold colors, halftone dots, comic book aesthetic, Roy Lichtenstein',
    negativePrompt: 'muted, pastel, realistic, photographic',
    preferredIntent: 'artistic',
    suggestedColors: ['#FF0000', '#FFFF00', '#0000FF', '#FF69B4'],
    tags: ['colorful', 'bold', 'retro'],
  },
  {
    id: 'line-art',
    name: { en: 'Line Art', es: 'Arte Lineal', de: 'Linienkunst' },
    description: { en: 'Elegant outlines, no fill', es: 'Contornos elegantes, sin relleno', de: 'Elegante Konturen, keine Füllung' },
    thumbnail: '/presets/line-art.webp',
    promptSuffix: 'line art, single line drawing, continuous line, elegant outlines, no fill, black ink',
    negativePrompt: 'colored, filled, shaded, gradient, realistic',
    preferredIntent: 'vector',
    suggestedColors: ['#000000', '#333333', '#1A1A2E'],
    tags: ['elegant', 'simple', 'outline'],
  },
  {
    id: 'botanical',
    name: { en: 'Botanical', es: 'Botánico', de: 'Botanisch' },
    description: { en: 'Nature, flowers, plants', es: 'Naturaleza, flores, plantas', de: 'Natur, Blumen, Pflanzen' },
    thumbnail: '/presets/botanical.webp',
    promptSuffix: 'botanical illustration, flowers, plants, leaves, nature art, scientific illustration style',
    negativePrompt: 'cartoonish, abstract, geometric, urban',
    preferredIntent: 'artistic',
    suggestedColors: ['#228B22', '#FF69B4', '#8FBC8F', '#DDA0DD'],
    tags: ['nature', 'floral', 'organic'],
  },
  {
    id: 'typography',
    name: { en: 'Typography', es: 'Tipografía', de: 'Typografie' },
    description: { en: 'Text as art, creative lettering', es: 'Texto como arte, lettering creativo', de: 'Text als Kunst, kreatives Lettering' },
    thumbnail: '/presets/typography.webp',
    promptSuffix: 'creative typography, hand lettering, decorative text, artistic font design',
    negativePrompt: 'plain text, standard font, boring, basic',
    preferredIntent: 'text-heavy',
    suggestedColors: ['#000000', '#FFFFFF', '#C0392B', '#2980B9'],
    tags: ['text', 'lettering', 'creative'],
  },
]
```

---

## FASE 3 — MODELO DE MEMORIA PERSISTENTE

### 3.1 Esquema de Base de Datos

#### Tablas Nuevas

```sql
-- 1. Design sessions (agrupa generaciones de una sesión de diseño)
CREATE TABLE design_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_type TEXT NOT NULL DEFAULT 'tshirt',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  style_preset TEXT,
  total_generations INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(8,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_design_sessions_user ON design_sessions(user_id, created_at DESC);
CREATE INDEX idx_design_sessions_status ON design_sessions(status) WHERE status = 'active';

-- 2. AI generations (cada imagen generada)
CREATE TABLE ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES design_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  engineered_prompt TEXT,
  negative_prompt TEXT,
  intent TEXT CHECK (intent IN ('artistic','text-heavy','photorealistic','vector','pattern','quick-draft','general')),
  provider TEXT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER DEFAULT 1024,
  height INTEGER DEFAULT 1024,
  cost_usd DECIMAL(8,4) NOT NULL DEFAULT 0,
  inference_ms INTEGER,
  is_refinement BOOLEAN DEFAULT false,
  parent_generation_id UUID REFERENCES ai_generations(id) ON DELETE SET NULL,
  quality_score DECIMAL(3,2),         -- 0.00-1.00, evaluado por Gemini
  moderation_status TEXT DEFAULT 'pending'
    CHECK (moderation_status IN ('pending','approved','rejected')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_generations_user ON ai_generations(user_id, created_at DESC);
CREATE INDEX idx_ai_generations_session ON ai_generations(session_id);

-- 3. User style preferences (memoria de preferencias de diseño)
CREATE TABLE user_style_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_colors TEXT[] DEFAULT '{}',
  preferred_styles TEXT[] DEFAULT '{}',
  preferred_fonts TEXT[] DEFAULT '{}',
  avoided_styles TEXT[] DEFAULT '{}',
  brand_keywords TEXT[] DEFAULT '{}',
  auto_remove_bg BOOLEAN DEFAULT true,
  default_product_type TEXT DEFAULT 'tshirt',
  preference_embedding vector(768),     -- Para RAG de preferencias
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 4. User design assets (imágenes subidas por el usuario)
CREATE TABLE user_design_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  processed_url TEXT,                    -- Después de rembg
  thumbnail_url TEXT,
  filename TEXT,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  has_transparency BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'upload'
    CHECK (source IN ('upload', 'ai_generation', 'chat')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_assets_user ON user_design_assets(user_id, created_at DESC);

-- 5. Design compositions (diseño final aplicado al producto)
CREATE TABLE design_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES design_sessions(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_type TEXT NOT NULL,
  layers JSONB NOT NULL DEFAULT '[]',
  /*
    layers: [
      { type: 'ai', generation_id: 'uuid', position: {x,y,w,h}, opacity: 1 },
      { type: 'text', text: '...', font: '...', color: '#...', size: 24, position: {x,y}, align: 'center' },
      { type: 'upload', asset_id: 'uuid', position: {x,y,w,h}, opacity: 1 },
    ]
  */
  preview_url TEXT,
  production_url TEXT,                   -- Alta resolución para Printify
  surcharge_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'applied', 'ordered')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_compositions_user ON design_compositions(user_id, created_at DESC);
CREATE INDEX idx_compositions_status ON design_compositions(status);
```

#### Modificaciones a Tablas Existentes

```sql
-- Añadir campos a personalizations (tabla existente)
ALTER TABLE personalizations
  ADD COLUMN IF NOT EXISTS surcharge_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS text_align TEXT DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS text_effects JSONB,
  ADD COLUMN IF NOT EXISTS composition_id UUID REFERENCES design_compositions(id),
  ADD COLUMN IF NOT EXISTS zone TEXT DEFAULT 'front';

-- Añadir campos a cart_items
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS composition_id UUID REFERENCES design_compositions(id);

-- Índice para búsqueda de composiciones en carrito
CREATE INDEX IF NOT EXISTS idx_cart_items_composition
  ON cart_items(composition_id) WHERE composition_id IS NOT NULL;
```

#### RLS Policies

```sql
-- design_sessions: solo el propietario
ALTER TABLE design_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY design_sessions_user ON design_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ai_generations: solo el propietario
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_generations_user ON ai_generations
  FOR ALL USING (auth.uid() = user_id);

-- user_style_preferences: solo el propietario
ALTER TABLE user_style_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY style_prefs_user ON user_style_preferences
  FOR ALL USING (auth.uid() = user_id);

-- user_design_assets: solo el propietario
ALTER TABLE user_design_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY design_assets_user ON user_design_assets
  FOR ALL USING (auth.uid() = user_id);

-- design_compositions: solo el propietario
ALTER TABLE design_compositions ENABLE ROW LEVEL SECURITY;
CREATE POLICY compositions_user ON design_compositions
  FOR ALL USING (auth.uid() = user_id);
```

### 3.2 Modelo de Embeddings para Preferencias

```
User Style Preferences
  │
  ├─ Explicit: usuario marca "Me gusta este estilo"
  │   → UPDATE user_style_preferences SET preferred_styles = array_append(...)
  │
  ├─ Implicit: análisis de historial de generaciones
  │   → Cada 10 generaciones: Gemini analiza patrones
  │   → "Usuario tiende a colores cálidos, estilos vintage, formas orgánicas"
  │   → UPDATE user_style_preferences SET preference_embedding = embed(resumen)
  │
  └─ RAG Query: "diseño para camiseta de cumpleaños"
      → Busca en ai_generations del usuario (vector similarity)
      → Busca en user_style_preferences (embedding match)
      → Enriquece prompt de Gemini con contexto personalizado
```

**Embedding Pipeline**:

```typescript
// frontend/src/lib/preference-embedder.ts

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embedMany } from 'ai'

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

export async function updateUserPreferenceEmbedding(userId: string) {
  // 1. Fetch últimas 20 generaciones del usuario
  const { data: generations } = await supabase
    .from('ai_generations')
    .select('prompt, intent, provider')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!generations?.length) return

  // 2. Crear resumen de preferencias con Gemini
  const { text: summary } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: `Analyze these design generation requests and create a concise preference profile:
${generations.map(g => `- "${g.prompt}" (${g.intent}, ${g.provider})`).join('\n')}

Output a 2-3 sentence summary of the user's design style preferences, color tendencies, and aesthetic direction.`,
    maxOutputTokens: 200,
  })

  // 3. Embed el resumen
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel('text-embedding-004'),
    values: [summary],
  })

  // 4. Guardar
  await supabase
    .from('user_style_preferences')
    .upsert({
      user_id: userId,
      preference_embedding: embeddings[0],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
}
```

### 3.3 Historial de Diseños (RAG para Recomendaciones)

```
GET /api/designs/history
  ├─ Parámetros: ?limit=10&product_type=tshirt&style=minimalist
  ├─ Response: [{
  │     id, preview_url, prompt, intent, style_preset,
  │     product_type, created_at, quality_score,
  │     can_reuse: true  // Si la imagen aún existe en storage
  │   }]
  │
  ├─ Para "Reutilizar diseño anterior":
  │   POST /api/designs/compose
  │   Body: { layers: [{ type: 'ai', generation_id: '{from_history}', ... }] }
  │
  └─ Para "Generar algo similar":
      POST /api/designs/ai-generate
      Body: { prompt: "similar to {previous_prompt}", previous_design_url: "..." }
```

---

## FASE 4 — INTEGRACIÓN CON CHAT

### 4.1 Estado Compartido: Product Page ↔ Chat

```
┌─────────────────────────────────────────────────┐
│                SharedDesignContext                │
│                                                  │
│  activeProduct: Product | null                   │
│  activeDesignSession: DesignSession | null        │
│  currentComposition: Composition | null           │
│  chatSuggestions: string[]                        │
│                                                   │
│  Consumers:                                       │
│  ├─ DesignStudio dialog                           │
│  ├─ ChatArea (reads activeProduct for context)    │
│  ├─ DetailPanel (reads currentComposition)        │
│  └─ CartView (reads composition preview)          │
└─────────────────────────────────────────────────┘
```

```typescript
// frontend/src/contexts/DesignContext.tsx

'use client'
import { createContext, useContext, useState, useCallback } from 'react'

interface DesignState {
  activeProduct: { id: string; title: string; type: string; image: string } | null
  activeSession: { id: string; preset?: string } | null
  currentComposition: {
    id: string
    layers: Layer[]
    previewUrl: string | null
  } | null
  recentGenerations: { id: string; imageUrl: string; prompt: string }[]
}

interface DesignContextType extends DesignState {
  setActiveProduct: (product: DesignState['activeProduct']) => void
  startDesignSession: (productId: string, productType: string) => Promise<string>
  addGeneration: (gen: DesignState['recentGenerations'][0]) => void
  setComposition: (comp: DesignState['currentComposition']) => void
  clearDesign: () => void
}

const DesignContext = createContext<DesignContextType | null>(null)

export function DesignProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DesignState>({
    activeProduct: null,
    activeSession: null,
    currentComposition: null,
    recentGenerations: [],
  })

  const startDesignSession = useCallback(async (productId: string, productType: string) => {
    const res = await fetch('/api/designs/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, product_type: productType }),
    })
    const { id } = await res.json()
    setState(s => ({ ...s, activeSession: { id } }))
    return id
  }, [])

  // ... más métodos

  return (
    <DesignContext.Provider value={{ ...state, startDesignSession, /* ... */ }}>
      {children}
    </DesignContext.Provider>
  )
}

export const useDesign = () => {
  const ctx = useContext(DesignContext)
  if (!ctx) throw new Error('useDesign must be used within DesignProvider')
  return ctx
}
```

### 4.2 Nuevos Chat Tools para Design Studio

```typescript
// Añadir a /api/chat/route.ts tools:

// Tool 25: AI Design Generation (desde chat, conecta con Design Studio)
ai_design_generate: tool({
  description: 'Generate an AI design for the current product. If user is viewing a product, generate a design for it.',
  parameters: z.object({
    prompt: z.string().describe('Design description from user'),
    stylePreset: z.string().optional().describe('Style preset ID'),
    productId: z.string().optional().describe('Product to design for'),
  }),
  execute: async ({ prompt, stylePreset, productId }) => {
    // 1. Resolve product context
    const product = productId || activeProductFromContext
    // 2. Call orchestrator
    const orchestration = await orchestrateDesign({
      userPrompt: prompt,
      productType: resolveProductType(product),
      stylePreset,
      userPreferences: await loadUserPreferences(userId),
    })
    // 3. Generate via existing pipeline
    const result = await generateDesign({
      prompt: orchestration.engineeredPrompt,
      negativePrompt: orchestration.negativePrompt,
      intent: orchestration.intent,
    })
    // 4. Remove background
    if (result.imageUrl) {
      const processed = await removeBackground(result.imageUrl)
      result.imageUrl = processed.url || result.imageUrl
    }
    // 5. Save to ai_generations
    await saveGeneration(userId, sessionId, result, orchestration)

    return {
      success: true,
      imageUrl: result.imageUrl,
      prompt: orchestration.engineeredPrompt,
      intent: orchestration.intent,
      provider: result.provider,
      // Flag para ChatArea: renderizar DesignPreviewArtifact con "Apply to Product" button
      canApplyToProduct: !!product,
      productId: product,
    }
  },
}),

// Tool 26: Apply design to product (desde chat)
apply_design_to_product: tool({
  description: 'Apply a generated design to a product and add to cart',
  parameters: z.object({
    generationId: z.string().describe('AI generation ID'),
    productId: z.string().describe('Product ID'),
    variantId: z.string().optional(),
  }),
  needsApproval: true,
  execute: async ({ generationId, productId, variantId }) => {
    // 1. Create composition
    const composition = await createComposition(userId, {
      layers: [{ type: 'ai', generation_id: generationId, position: defaultPosition }],
      productId, productType,
    })
    // 2. Generate preview
    const preview = await generateCompositePreview(composition)
    // 3. Return for approval
    return {
      success: true,
      needsApproval: true,
      compositionId: composition.id,
      previewUrl: preview.url,
      productTitle: product.title,
      surcharge: calculateSurcharge(composition),
    }
  },
}),

// Tool 27: Show design history
show_design_history: tool({
  description: 'Show user their recent AI designs that can be reused',
  parameters: z.object({
    limit: z.number().optional().default(6),
  }),
  execute: async ({ limit }) => {
    const designs = await supabase
      .from('ai_generations')
      .select('id, prompt, image_url, intent, created_at, quality_score')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return {
      success: true,
      designs: designs.data,
      canReuse: true,
    }
  },
}),
```

### 4.3 Bidireccionalidad Chat ↔ Product Page

```
ESCENARIO 1: Usuario está en Product Page → abre Chat
  ├─ DesignContext.activeProduct = { id: 'xxx', type: 'tshirt', ... }
  ├─ Chat detecta producto activo en system prompt injection
  ├─ Chat sugiere: "¿Quieres que diseñe algo para esta camiseta?"
  └─ Usuario: "sí, algo minimalista" → ai_design_generate con contexto

ESCENARIO 2: Usuario está en Chat → genera diseño → lo aplica
  ├─ Chat tool: ai_design_generate → devuelve imageUrl + canApplyToProduct
  ├─ Artifact: DesignPreviewArtifact con botón "Aplicar al producto"
  ├─ Click "Aplicar" → apply_design_to_product (needsApproval)
  ├─ Approval card: preview + surcharge + "Confirmar"
  └─ Confirma → addToCart con compositionId → CartView con preview

ESCENARIO 3: Usuario ve historial de diseños en Chat
  ├─ "Muéstrame mis diseños anteriores"
  ├─ show_design_history → DesignHistoryArtifact (grid de thumbs)
  ├─ Click en uno → "¿Quieres aplicarlo a un producto?"
  └─ Selecciona producto → apply_design_to_product
```

---

## FASE 5 — SISTEMA DE ASSETS

### 5.1 Arquitectura de Storage

```
Supabase Storage Buckets
  │
  ├─ designs/ (público, CDN)
  │   ├─ {user_id}/{generation_id}.png     — Generaciones AI
  │   ├─ {user_id}/{generation_id}_thumb.webp — Thumbnails (200x200)
  │   └─ compositions/{composition_id}.png   — Composiciones finales
  │
  ├─ user-assets/ (privado, RLS)
  │   ├─ {user_id}/uploads/{asset_id}.png   — Uploads originales
  │   ├─ {user_id}/processed/{asset_id}.png — Post-rembg
  │   └─ {user_id}/thumbs/{asset_id}.webp   — Thumbnails
  │
  └─ production/ (servicio, solo backend)
      └─ {order_id}/{item_id}.png            — Alta resolución para Printify
```

### 5.2 Pipeline de Procesamiento de Assets

```
Upload (max 10MB, png/jpg/webp/svg)
  │
  ├─ 1. Validación
  │   ├─ Tipo MIME (magic bytes, no solo extensión)
  │   ├─ Dimensiones (max 8192x8192)
  │   ├─ Tamaño (max 10MB free, 25MB premium)
  │   └─ Content safety check (Gemini vision)
  │
  ├─ 2. Procesamiento
  │   ├─ Resize si > 4096px (mantener aspect ratio)
  │   ├─ rembg si user_style_preferences.auto_remove_bg = true
  │   ├─ Generar thumbnail (200x200 webp, quality 80)
  │   └─ Calcular hash SHA-256 (deduplicación)
  │
  ├─ 3. Storage
  │   ├─ Upload original a user-assets/{user_id}/uploads/
  │   ├─ Upload procesado a user-assets/{user_id}/processed/
  │   ├─ Upload thumb a user-assets/{user_id}/thumbs/
  │   └─ Insert en user_design_assets
  │
  └─ 4. Response
      └─ { id, original_url, processed_url, thumbnail_url, width, height }
```

### 5.3 Límites por Plan

| Recurso | Anonymous | Free | Premium |
|---------|-----------|------|---------|
| AI Generations/mes | 0 | 5 | 50 |
| Uploads almacenados | 0 | 20 | 200 |
| Storage total | 0 | 50 MB | 500 MB |
| Max file size | — | 10 MB | 25 MB |
| Composiciones guardadas | 0 | 10 | 100 |
| Historial de diseños | 0 | 30 días | 1 año |
| Background removal | 3/día | 10/mes | 100/mes |

### 5.4 CDN y Caching

```
Supabase Storage → Supabase CDN (automático)
  ├─ Cache-Control: public, max-age=31536000, immutable
  ├─ Content-Type correcto (image/png, image/webp)
  └─ Transform API para resize on-the-fly:
      /storage/v1/render/image/public/designs/{path}?width=400&height=400
```

### 5.5 Cleanup y Retención

```sql
-- Función de limpieza (ejecutar vía cron semanal)
CREATE OR REPLACE FUNCTION cleanup_expired_assets()
RETURNS void AS $$
BEGIN
  -- Eliminar generaciones de usuarios free > 30 días sin pedido
  DELETE FROM ai_generations
  WHERE user_id IN (SELECT id FROM users WHERE tier = 'free')
    AND created_at < now() - interval '30 days'
    AND id NOT IN (
      SELECT DISTINCT jsonb_array_elements(layers)->>'generation_id'
      FROM design_compositions
      WHERE status = 'ordered'
    );

  -- Eliminar assets huérfanos > 7 días
  DELETE FROM user_design_assets
  WHERE created_at < now() - interval '7 days'
    AND id NOT IN (
      SELECT DISTINCT (jsonb_array_elements(layers)->>'asset_id')::uuid
      FROM design_compositions
    );
END;
$$ LANGUAGE plpgsql;
```

---

## FASE 6 — BIBLIOTECA DE COMPONENTES

### 6.1 Componentes UI Nuevos

| Componente | Ubicación | Descripción | Dependencias |
|-----------|-----------|-------------|--------------|
| `DesignStudio` | `components/products/DesignStudio.tsx` | Dialog principal con tabs (Text/AI/Upload) | Dialog, Tabs |
| `AIPromptEditor` | `components/design/AIPromptEditor.tsx` | Input de prompt con sugerencias, historial, auto-complete | Input, Badge |
| `StyleSelector` | `components/design/StyleSelector.tsx` | Grid de style presets con thumbnails | Card, RadioGroup |
| `AIPreviewCanvas` | `components/design/AIPreviewCanvas.tsx` | Preview del diseño IA sobre mockup del producto | Canvas, Skeleton |
| `DesignHistoryPanel` | `components/design/DesignHistoryPanel.tsx` | Grid de diseños anteriores reutilizables | Card, ScrollArea |
| `CompositionEditor` | `components/design/CompositionEditor.tsx` | Editor de capas (drag, resize, opacity) | Drag handle |
| `ColorSwatches` | `components/design/ColorSwatches.tsx` | 16 swatches + picker custom | Button, Popover |
| `TextAlignButtons` | `components/design/TextAlignButtons.tsx` | Toggle group L/C/R | ToggleGroup |
| `SafeZoneOverlay` | `components/design/SafeZoneOverlay.tsx` | Borde punteado de zona segura | CSS overlay |
| `ContrastWarning` | `components/design/ContrastWarning.tsx` | Alert cuando texto es ilegible | Alert |
| `AuthGateOverlay` | `components/design/AuthGateOverlay.tsx` | Overlay "Inicia sesión para generar diseños" | Button, dialog |
| `GenerationCostBadge` | `components/design/GenerationCostBadge.tsx` | Badge mostrando créditos restantes | Badge |
| `DesignPreviewArtifact` | `components/artifacts/DesignPreviewArtifact.tsx` | MODIFICAR: añadir "Apply to Product" button | Existing |
| `DesignHistoryArtifact` | `components/artifacts/DesignHistoryArtifact.tsx` | NUEVO artifact para chat tool show_design_history | Card grid |

### 6.2 Arquitectura del DesignStudio

```tsx
// Estructura del componente principal
<DesignStudio
  product={product}
  productColor={selectedColor}
  onApply={(compositionId) => addToCart(product.id, 1, variant, ..., compositionId)}
  onClose={() => setShowStudio(false)}
>
  <Tabs defaultValue="text">
    <TabsList>
      <TabsTrigger value="text">
        <Type className="h-4 w-4 mr-2" /> {t('text')}
      </TabsTrigger>
      <TabsTrigger value="ai">
        <Sparkles className="h-4 w-4 mr-2" /> {t('aiDesign')}
      </TabsTrigger>
      <TabsTrigger value="upload">
        <Upload className="h-4 w-4 mr-2" /> {t('uploadImage')}
      </TabsTrigger>
    </TabsList>

    <TabsContent value="text">
      {/* TextPersonalizer existente, mejorado */}
      <FontSelector fonts={FONT_OPTIONS} />
      <ColorSwatches value={fontColor} onChange={setFontColor} />
      <TextAlignButtons value={textAlign} onChange={setTextAlign} />
      <TextSizeSelector value={fontSize} onChange={setFontSize} />
      <TextPositionSelector value={position} onChange={setPosition} />
      <Textarea value={text} onChange={setText} maxLength={100} />
    </TabsContent>

    <TabsContent value="ai">
      <AuthGateOverlay show={!isAuthenticated}>
        <AIPromptEditor
          onGenerate={handleGenerate}
          isGenerating={generating}
          creditsRemaining={credits}
        />
        <StyleSelector
          presets={STYLE_PRESETS}
          selected={stylePreset}
          onSelect={setStylePreset}
        />
        {currentGeneration && (
          <div className="space-y-3">
            <AIPreviewCanvas
              imageUrl={currentGeneration.imageUrl}
              productImage={product.images[0]}
              productType={product.category}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRefine}>
                {t('refine')}
              </Button>
              <Button variant="outline" onClick={handleVariations}>
                {t('generateVariations')}
              </Button>
            </div>
          </div>
        )}
        <DesignHistoryPanel
          designs={recentDesigns}
          onSelect={handleSelectFromHistory}
        />
      </AuthGateOverlay>
    </TabsContent>

    <TabsContent value="upload">
      <AuthGateOverlay show={!isAuthenticated}>
        <ImageUploader
          onUpload={handleImageUpload}
          maxSize={isPremuim ? 25 : 10}
          autoRemoveBg={preferences?.auto_remove_bg}
        />
      </AuthGateOverlay>
    </TabsContent>
  </Tabs>

  {/* Preview siempre visible */}
  <div className="relative aspect-square">
    <img src={productImage} alt={product.title} className="w-full" />
    <SafeZoneOverlay productType={product.category} />
    <CompositionPreview
      layers={compositionLayers}
      productType={product.category}
    />
    <ContrastWarning
      textColor={fontColor}
      productColor={selectedColor}
    />
  </div>

  <div className="flex justify-between items-center pt-4">
    <GenerationCostBadge remaining={credits} tier={userTier} />
    <div className="flex gap-2">
      <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
      <Button onClick={handleApplyAndAddToCart}>
        {t('applyAndAddToCart')}
        {surcharge > 0 && ` (+€${surcharge.toFixed(2)})`}
      </Button>
    </div>
  </div>
</DesignStudio>
```

### 6.3 Responsive Breakpoints

```
DesignStudio Dialog:
  ├─ Mobile (375px): Full-screen sheet, tabs stacked, preview above controls
  ├─ Tablet (768px): 70% width dialog, tabs horizontal, preview left
  └─ Desktop (1024px+): 80% max-width, split layout (controls | preview)

StyleSelector:
  ├─ Mobile: 2 columns grid, horizontal scroll
  ├─ Tablet: 3 columns
  └─ Desktop: 4 columns

DesignHistoryPanel:
  ├─ Mobile: horizontal scroll, 3 visible
  ├─ Tablet: 4 columns grid
  └─ Desktop: 6 columns grid
```

---

## FASE 7 — MODELO DE COSTOS Y SEGURIDAD

### 7.1 Cost Guards

```typescript
// frontend/src/lib/design-cost-guard.ts

interface CostGuardConfig {
  maxCostPerGeneration: number    // USD
  maxCostPerSession: number       // USD
  maxCostPerDay: number           // USD
  maxCostPerMonth: number         // USD
  alertThreshold: number          // % of monthly budget
}

const COST_GUARDS: Record<UserTier, CostGuardConfig> = {
  anonymous: {
    maxCostPerGeneration: 0,
    maxCostPerSession: 0,
    maxCostPerDay: 0,
    maxCostPerMonth: 0,
    alertThreshold: 0,
  },
  free: {
    maxCostPerGeneration: 0.05,   // Max flux-pro
    maxCostPerSession: 0.25,      // ~5 generaciones
    maxCostPerDay: 0.50,
    maxCostPerMonth: 2.50,        // 5 generaciones × $0.05 + overhead
    alertThreshold: 0.80,
  },
  premium: {
    maxCostPerGeneration: 0.15,   // Permite providers caros
    maxCostPerSession: 2.50,
    maxCostPerDay: 5.00,
    maxCostPerMonth: 25.00,       // 50 generaciones × $0.05 + overhead
    alertThreshold: 0.80,
  },
}

export async function checkCostGuard(
  userId: string,
  tier: UserTier,
  estimatedCost: number
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const guard = COST_GUARDS[tier]

  // Check per-generation limit
  if (estimatedCost > guard.maxCostPerGeneration) {
    return { allowed: false, reason: 'Generation cost exceeds tier limit' }
  }

  // Check session cost
  const sessionCost = await getSessionCost(userId)
  if (sessionCost + estimatedCost > guard.maxCostPerSession) {
    return { allowed: false, reason: 'Session budget exhausted' }
  }

  // Check daily cost
  const dailyCost = await getDailyCost(userId)
  if (dailyCost + estimatedCost > guard.maxCostPerDay) {
    return { allowed: false, reason: 'Daily budget exhausted' }
  }

  // Check monthly cost
  const monthlyCost = await getMonthlyCost(userId)
  if (monthlyCost + estimatedCost > guard.maxCostPerMonth) {
    return { allowed: false, reason: 'Monthly budget exhausted' }
  }

  // Alert if approaching limit
  if ((monthlyCost + estimatedCost) / guard.maxCostPerMonth >= guard.alertThreshold) {
    console.warn('[CostAlert] User approaching monthly limit', {
      userId, tier, monthlyCost, limit: guard.maxCostPerMonth
    })
  }

  return {
    allowed: true,
    remaining: guard.maxCostPerMonth - monthlyCost - estimatedCost,
  }
}
```

### 7.2 Prompt Sanitization

```typescript
// Extender frontend/src/lib/content-safety.ts

export async function checkDesignPromptSafety(prompt: string): Promise<{
  safe: boolean
  reason?: string
  sanitized?: string
}> {
  // 1. Regex blocklist (inyección, escape de prompt)
  const INJECTION_PATTERNS = [
    /ignore.*previous.*instructions/i,
    /system.*prompt/i,
    /\{\{.*\}\}/,        // Template injection
    /<%.*%>/,            // ERB injection
    /<script/i,          // XSS
  ]

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      return { safe: false, reason: 'Prompt contains blocked patterns' }
    }
  }

  // 2. Content safety (ya existe: checkPromptSafety)
  const safetyResult = await checkPromptSafety(prompt)
  if (!safetyResult.safe) {
    return safetyResult
  }

  // 3. Length limit
  if (prompt.length > 500) {
    return {
      safe: true,
      sanitized: prompt.substring(0, 500),
    }
  }

  return { safe: true }
}
```

### 7.3 Rate Limiting Extendido

```typescript
// Nuevas acciones en usage-limiter.ts

// Añadir a USAGE_TIERS:
'design:ai-generate':  // Generación IA desde product page
  anonymous: { limit: 0, period: 'monthly' },
  free:      { limit: 5, period: 'monthly' },
  premium:   { limit: 50, period: 'monthly' },

'design:refine':       // Refinamiento de diseño existente
  anonymous: { limit: 0, period: 'monthly' },
  free:      { limit: 10, period: 'monthly' },  // 2 refinamientos por diseño avg
  premium:   { limit: 100, period: 'monthly' },

'design:upload':       // Upload de imágenes
  anonymous: { limit: 0, period: 'daily' },
  free:      { limit: 5, period: 'daily' },
  premium:   { limit: 20, period: 'daily' },

'design:compose':      // Crear composición
  anonymous: { limit: 0, period: 'daily' },
  free:      { limit: 10, period: 'daily' },
  premium:   { limit: 50, period: 'daily' },
```

### 7.4 Seguridad de Assets

```
Validación de uploads:
  ├─ Magic bytes verification (no confiar en Content-Type header)
  │   ├─ PNG: 89 50 4E 47
  │   ├─ JPEG: FF D8 FF
  │   ├─ WebP: 52 49 46 46 ... 57 45 42 50
  │   └─ SVG: <svg (solo premium, sanitizado con DOMPurify)
  │
  ├─ Límite de dimensiones: max 8192x8192 (prevenir memory bombs)
  ├─ Límite de tamaño: 10MB free / 25MB premium
  ├─ Escaneo de contenido: Gemini Vision para NSFW detection
  │
  └─ Storage security:
      ├─ RLS en bucket user-assets (solo propietario)
      ├─ Signed URLs para assets privados (1h TTL)
      ├─ Public CDN solo para diseños aprobados
      └─ No ejecutar SVG — sanitizar y rasterizar
```

---

## FASE 8 — ESCALABILIDAD

### 8.1 Para 1000+ pedidos/mes

```
Bottlenecks identificados:
  │
  ├─ AI Generation: 5-15s por diseño
  │   Solución: Queue con estado (pending → generating → done)
  │   Implementación: Supabase Realtime subscriptions
  │   ```
  │   1. POST /api/designs/ai-generate → INSERT ai_generations (status: 'pending')
  │   2. Response inmediata: { generation_id, status: 'pending' }
  │   3. Background: worker procesa → UPDATE status = 'completed', image_url = '...'
  │   4. Frontend: Supabase Realtime subscription on ai_generations
  │      .on('UPDATE', { filter: `id=eq.${generationId}` }, callback)
  │   ```
  │
  ├─ rembg: ~3-5s por imagen
  │   Solución: Cache por hash de imagen (Redis)
  │   Key: `rembg:${sha256(imageUrl)}` → processed_url
  │   TTL: 7 días
  │
  ├─ Printify temp products: ~2-3s por composición
  │   Solución: Pre-generar production assets en background al completar composición
  │   No esperar a checkout para generar alta resolución
  │
  └─ Storage: crecimiento lineal
      Solución: lifecycle policies
      - Thumbnails: keep forever
      - Generations (free users): 30 días
      - Generations (premium): 1 año
      - Production assets: 90 días post-delivery
```

### 8.2 Concurrency Control

```typescript
// Máximo 2 generaciones simultáneas por usuario
const GENERATION_SLOTS = new Map<string, number>()

export function acquireGenerationSlot(userId: string): boolean {
  const current = GENERATION_SLOTS.get(userId) || 0
  if (current >= 2) return false
  GENERATION_SLOTS.set(userId, current + 1)
  return true
}

export function releaseGenerationSlot(userId: string): void {
  const current = GENERATION_SLOTS.get(userId) || 0
  if (current > 0) GENERATION_SLOTS.set(userId, current - 1)
}
```

### 8.3 Cancellation Support

```typescript
// AbortController para generaciones cancelables
const activeControllers = new Map<string, AbortController>()

export async function generateWithCancellation(
  generationId: string,
  params: DesignGenerationParams
): Promise<DesignGenerationResult> {
  const controller = new AbortController()
  activeControllers.set(generationId, controller)

  try {
    const result = await generateDesign(params, { signal: controller.signal })
    return result
  } finally {
    activeControllers.delete(generationId)
  }
}

export function cancelGeneration(generationId: string): boolean {
  const controller = activeControllers.get(generationId)
  if (controller) {
    controller.abort()
    activeControllers.delete(generationId)
    return true
  }
  return false
}
```

### 8.4 Caching Strategy

```
Nivel 1: Browser Cache
  ├─ Design thumbnails: Cache-Control: immutable (hash en URL)
  ├─ Style preset thumbnails: Cache-Control: max-age=86400
  └─ Product images: ya cacheadas por Printify CDN

Nivel 2: Redis (si disponible, graceful fallback)
  ├─ rembg results: 7 días TTL
  ├─ User preferences: 1 hora TTL
  ├─ Usage counters: ya implementado
  └─ Active generation slots: in-memory (no persiste restart)

Nivel 3: Supabase (source of truth)
  ├─ ai_generations: permanente (con cleanup policy)
  ├─ design_compositions: permanente
  ├─ user_style_preferences: permanente
  └─ user_design_assets: con retention policy
```

---

## FASE 9 — PLAN DE IMPLEMENTACIÓN

### 9.1 Priorización para `app_spec.txt`

#### Section 16: AI Design Studio (estimado: ~80h)

```
BLOCK A — Critical Bug Fixes (10h) [P0 — ya en Section 15]
  A1: usePersonalization hook (POST /api/designs/personalize)
  A2: addToCart acepta personalizationId
  A3: productColor se pasa al dialog
  A4: SIZE_MAP centralizado en print-areas.ts
  A5: lineHeight estandarizado a 1.3
  A6: surcharge persistido en DB
  A7: Preview en CartView para items personalizados
  A8: Migración: surcharge_amount column

BLOCK B — Text Personalizer Improvements (8h) [P1 — ya en Section 15]
  B1: 12 fuentes (6 nuevas)
  B2: 16 color swatches + picker
  B3: Alineación texto (left/center/right)
  B4: Safe zone overlay
  B5: Contrast warning
  B6: Migraciones: text_align, text_effects columns

BLOCK C — Database Schema (6h) [P0]
  C1: design_sessions table
  C2: ai_generations table
  C3: user_style_preferences table
  C4: user_design_assets table
  C5: design_compositions table
  C6: RLS policies para todas las tablas nuevas

BLOCK D — AI Design Generation Pipeline (16h) [P1]
  D1: ai-design-orchestrator.ts (Gemini 2.5 Flash)
  D2: POST /api/designs/ai-generate endpoint
  D3: POST /api/designs/ai-generate/refine endpoint
  D4: POST /api/designs/ai-generate/variations endpoint
  D5: Style presets library (8 presets con thumbnails)
  D6: Integration con existing provider router
  D7: Auto rembg post-generation
  D8: Cost guard module

BLOCK E — Design Studio UI (14h) [P1]
  E1: DesignStudio dialog component (tabs: Text/AI/Upload)
  E2: AIPromptEditor component
  E3: StyleSelector component (grid con thumbnails)
  E4: AIPreviewCanvas component (overlay sobre mockup)
  E5: DesignHistoryPanel component
  E6: ImageUploader component (drag & drop + rembg)
  E7: CompositionEditor component (multi-layer)
  E8: AuthGateOverlay + GenerationCostBadge
  E9: Mobile-responsive layout (375px/768px/1024px)
  E10: i18n keys (en/es/de) para todos los componentes

BLOCK F — Composition Pipeline (10h) [P1]
  F1: POST /api/designs/compose endpoint
  F2: Server-side composition (Sharp/Canvas)
  F3: Production resolution export (300 DPI mapping)
  F4: Printify integration (temp product con composición)
  F5: Preview URL persistence

BLOCK G — Memory & Preferences (8h) [P2]
  G1: DesignContext provider (shared state chat ↔ product)
  G2: User preference learning (implicit analysis)
  G3: Preference embedding pipeline
  G4: Design history API (GET /api/designs/history)
  G5: Recent designs in DesignStudio

BLOCK H — Chat Integration (8h) [P2]
  H1: ai_design_generate chat tool
  H2: apply_design_to_product chat tool (needsApproval)
  H3: show_design_history chat tool
  H4: DesignHistoryArtifact component
  H5: Bidirectional context (activeProduct in system prompt)
  H6: Modify DesignPreviewArtifact (add "Apply to Product" button)

BLOCK I — Scalability & Polish (8h) [P2]
  I1: Generation queue con Realtime subscriptions
  I2: rembg result caching (Redis)
  I3: Concurrency control (max 2 per user)
  I4: Cancellation support (AbortController)
  I5: Asset cleanup cron function
  I6: Storage lifecycle policies
```

### 9.2 Dependencias entre Bloques

```
    A (Bug Fixes)
    │
    ├──▶ B (Text Improvements) — independiente de C-I
    │
    └──▶ C (DB Schema) ◀── requerido por todo lo demás
         │
         ├──▶ D (AI Pipeline) ──▶ F (Composition)
         │         │                    │
         │         └──▶ E (UI) ◀────────┘
         │              │
         │              └──▶ H (Chat Integration)
         │
         ├──▶ G (Memory) ──▶ D (enriches prompts)
         │
         └──▶ I (Scale) — puede hacerse en paralelo
```

### 9.3 Estimación de Features para `feature_list.json`

```
Block A:  9 features  (IDs 244-252, ya en Section 15 parcialmente)
Block B:  6 features  (IDs 253-258, ya en Section 15 parcialmente)
Block C:  6 features  (IDs 259-264)
Block D:  8 features  (IDs 265-272)
Block E: 10 features  (IDs 273-282)
Block F:  5 features  (IDs 283-287)
Block G:  5 features  (IDs 288-292)
Block H:  6 features  (IDs 293-298)
Block I:  6 features  (IDs 299-304)
─────────────────────────
TOTAL:   ~61 features nuevas (+ 15 ya existentes de Section 15)
```

---

## RIESGOS TÉCNICOS

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|-------------|---------|------------|
| R1 | FAL API downtime | Media | Alto | Fallback chain ya implementado (4 proveedores) |
| R2 | Gemini rate limits | Baja | Medio | Cache de clasificaciones similares, retry con backoff |
| R3 | Storage costs crecientes | Media | Medio | Lifecycle policies agresivas, thumbnails solo webp |
| R4 | rembg calidad variable | Media | Bajo | Allow manual toggle, mostrar original como alternativa |
| R5 | Printify API cambios | Baja | Alto | Abstracción existente en connector, versionado |
| R6 | UX complexity overload | Alta | Alto | Progressive disclosure: Tab 1 simple, Tab 2 para power users |
| R7 | Mobile performance | Media | Medio | Lazy load tabs, skeleton loading, image optimization |
| R8 | Prompt injection | Baja | Alto | Sanitization + blocklist + Gemini safety filters |
| R9 | Cost runaway | Baja | Alto | Cost guards con hard limits + alertas |
| R10 | DB migration conflicts | Baja | Medio | 1 statement per migration, test in staging first |

---

## VERIFICACIÓN END-TO-END

### Flujo Completo de Validación

```
1. Abrir producto → Click "Personalizar" → DesignStudio abre
2. Tab Texto: escribir texto, elegir fuente/color/tamaño → preview correcto
3. Tab IA: escribir prompt "logo minimalista" → genera diseño en <10s
4. Diseño aparece sobre mockup del producto → posición correcta
5. Click "Generar variaciones" → 3 alternativas aparecen
6. Seleccionar una → combinar con texto → composición multi-capa
7. Click "Aplicar y añadir al carrito" → personalization_id guardado en DB
8. Cart muestra preview de la composición + surcharge
9. Checkout → Stripe → Printify recibe temp product con overlay correcto
10. Volver → Tab IA → historial muestra diseño anterior → puede reutilizar
11. Abrir chat → "diseña algo para esta camiseta" → genera desde chat
12. Chat artifact muestra "Aplicar al producto" → funciona end-to-end
13. Mobile 375px → todo funciona con layout responsive
14. User free: 5 generaciones → 6ta muestra UpgradeModal
15. User anonymous: Tab IA muestra AuthGateOverlay
```

---

## RESUMEN EJECUTIVO

| Aspecto | Estado Actual | Estado Objetivo |
|---------|---------------|-----------------|
| Personalización | Texto only, roto E2E | Multi-layer: texto + IA + upload |
| Generación IA | Solo vía chat (oculto) | Product page + chat (bidireccional) |
| Fuentes | 6 básicas | 12 (+ script, handwriting) |
| Colores | Input HTML básico | 16 swatches + picker |
| Preview | Inconsistente (3 SIZE_MAP) | Unificado, WYSIWYG |
| Persistencia | useState (se pierde) | DB completa + composition pipeline |
| Historial | Ninguno | RAG-powered, reutilizable |
| Memoria | Ninguna | Preferencias aprendidas, embeddings |
| Mobile | No optimizado | Mobile-first responsive |
| Costo | Sin control | Cost guards + tier limits |
| Chat ↔ Product | Desconectados | Contexto compartido bidireccional |
| Escalabilidad | Síncrono | Queue + cache + concurrency control |

**Esfuerzo total estimado**: ~80h de desarrollo (Blocks A-I)
**Features totales**: ~61 nuevas + 15 existentes (Section 15) = ~76 features
**ROI**: Convierte la personalización de "feature rota" a "diferenciador competitivo"
