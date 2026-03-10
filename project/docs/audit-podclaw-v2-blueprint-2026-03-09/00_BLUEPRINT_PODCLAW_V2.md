# PodClaw v2 — Blueprint Definitivo

*Consolidación de 7 documentos de auditoría técnica (2026-03-09)*

---

## Visión

PodClaw v2 es un **asistente AI event-driven** que gestiona un e-commerce POD (Print-on-Demand) end-to-end. El CEO comunica via **WhatsApp/Telegram**, dando instrucciones como "crea un diseño basado en esta imagen, hagamos una camiseta". PodClaw orquesta sub-agentes especializados que diseñan en SVG, renderizan a print specs, crean productos en Printful, gestionan pedidos, responden clientes, y reportan resultados — todo reactivo a eventos, no cron.

---

## Principios Arquitectónicos

1. **Event-First**: Todo es un evento. CEO message, webhook Stripe, email cliente, diseño completado.
2. **CEO = Decision Maker**: PodClaw ejecuta, el CEO aprueba. Botones approve/reject en WhatsApp.
3. **Sub-agentes con Skills**: Cada agente tiene skills (.claude/skills/) que definen sus capacidades exactas.
4. **Provider-Agnostic**: Anti-corruption layer ya existe (frontend). PodClaw opera con tipos canónicos.
5. **Fail-Closed Security**: Mantener el modelo de seguridad actual (deny chain, budget limits, protected tables).

---

## Arquitectura de Alto Nivel

```
                        ┌──────────────────────┐
                        │      CEO (Humano)     │
                        │  WhatsApp / Telegram  │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │    Message Gateway     │
                        │  (Webhook Receiver)    │
                        │  Inbound: text, image  │
                        │  Outbound: text, image, │
                        │  buttons, templates    │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │    Event Router        │
                        │  Clasifica + Prioriza  │
                        │  + Despacha a agente   │
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼──────┐  ┌────────▼────────┐  ┌───────▼────────┐
    │  Design Agent   │  │  Catalog Agent   │  │ Customer Agent │
    │  SVG → PNG      │  │  Printful CRUD   │  │ Email/Support  │
    │  + Mockup       │  │  + Pricing       │  │ + Refunds      │
    └────────┬────────┘  └────────┬────────┘  └───────┬────────┘
             │                    │                    │
    ┌────────▼────────────────────▼────────────────────▼────────┐
    │                     Tool Layer (MCP)                       │
    │  Printful │ Supabase │ Stripe │ Resend │ FAL │ Rembg     │
    └──────────────────────────────────────────────────────────┘
             │                    │                    │
    ┌────────▼────────────────────▼────────────────────▼────────┐
    │                   Event Store (Supabase)                   │
    │  agent_events │ support_tickets │ design_tasks │ approvals │
    └──────────────────────────────────────────────────────────┘
```

---

## Event Sources (Inputs al sistema)

### 1. CEO Messages (WhatsApp/Telegram)

| Tipo | Ejemplo | Evento | Agente Target |
|------|---------|--------|---------------|
| Texto comando | "crea un diseño minimalista S mark" | `ceo.design_request` | Design Agent |
| Imagen + texto | [foto] "hagamos una camiseta con esto" | `ceo.design_from_image` | Design Agent |
| Aprobación | [botón Approve] | `ceo.approve` | Catalog Agent |
| Rechazo | [botón Reject] + "más oscuro" | `ceo.reject_with_feedback` | Design Agent |
| Pregunta negocio | "¿cuánto vendimos esta semana?" | `ceo.query` | Finance Agent |
| Comando operativo | "pausa el agente marketing" | `ceo.system_command` | Orchestrator |
| Texto libre | "investiga qué gorras se venden más" | `ceo.research_request` | Researcher |

### 2. Webhooks Externos

| Source | Eventos | Agente Target |
|--------|---------|---------------|
| **Stripe** | checkout.completed, dispute, refund, subscription.* | Finance + Customer |
| **Printful** | order.shipped, order.failed, stock.updated, product.* | Catalog + Customer |
| **Resend** | email.bounced, email.complained (futuro) | Customer Agent |

### 3. Email Inbound (Futuro)

| Source | Evento | Agente Target |
|--------|--------|---------------|
| customer reply to order email | `customer.email` | Customer Agent |
| contact form submission | `customer.contact` | Customer Agent |
| partnership inquiry | `business.inquiry` | CEO notification |

### 4. System Events

| Evento | Trigger | Agente Target |
|--------|---------|---------------|
| `design.render_complete` | SVG→PNG pipeline done | Design Agent → CEO preview |
| `product.published` | Printful product live | CEO notification |
| `sale.completed` | Order paid | CEO notification + Finance |
| `agent.needs_approval` | Agente necesita decisión | CEO WhatsApp |
| `agent.error` | Agente falla | CEO alert |
| `budget.threshold` | 80% daily budget consumed | CEO warning |

### 5. Cron Residuales (no migrables a events)

| Cron | Frecuencia | Razón |
|------|-----------|-------|
| Reconciliación Printful | 30 min | Catch-all (webhooks cubren 80%) |
| Check delivery status | 6h | Printful no envía webhook delivered |
| Product metrics ETL | Diario | Batch analytics |
| Cleanup datos temporales | Diario | Maintenance |
| Hard delete accounts | Diario | GDPR compliance |

---

## Sub-Agentes Especializados

### Design Agent

**Responsabilidad**: Crear diseños, renderizar a print specs, generar mockups.

**Skills activos**:
- `design-dtg` — Camisetas, hoodies, crewnecks (P26 Textildruck Europa)
- `design-embroidery` — Gorras, snapbacks, beanies (P410 Printful Latvia)
- `design-sublimation` — Mugs, botellas, desk mats, sneakers (multi-provider)
- 16 skills Printful-específicos (M2580, SASU024, STSU177, gorras, etc.)

**Pipeline**:
```
1. CEO envía prompt + imagen referencia
   ↓
2. Clasificar intención: DTG / Embroidery / Sublimation
   ↓
3. Seleccionar blueprint + consultar CANVAS_SPECS
   ↓
4. Generar diseño SVG (Claude code gen o Recraft API)
   ↓
5. Renderizar SVG → PNG (@resvg/resvg-js, density:300, exact dims)
   ↓
6. Background removal si necesario (rembg sidecar)
   ↓
7. Upscale si gen_dims < target_dims (ESRGAN via FAL)
   ↓
8. Validar: dimensiones, transparencia, DPI
   ↓
9. Upload a Supabase Storage
   ↓
10. Generar mockup (Printful mockup API, async polling)
   ↓
11. Enviar preview al CEO via WhatsApp (imagen + botones Approve/Reject)
   ↓
12. Si aprobado → emit event `design.approved`
```

**Canvas Specs disponibles**:

| Blueprint | Producto | Front | Back | Neck |
|-----------|----------|-------|------|------|
| BP6 | T-Shirt | 4606×5787 | 4606×5787 | 1181×614 |
| BP12 | Hoodie | 2953×3710 | 2953×3710 | — |
| BP145 | Crewneck | 2953×3710 | 2953×3710 | — |
| BP793 | Hoodie Embroidery | 3000×1800 (chest) | — | — |
| BP1744 | Cap | 1770×600 | — | — |

**Herramientas de rendering**:
- `@resvg/resvg-js` — SVG→PNG primario (mejor fidelidad texto/gradientes)
- `sharp` — Post-processing (resize, composite, DPI metadata)
- `node-canvas` — Text rendering con fuentes custom
- ESRGAN (FAL.ai) — Upscaling 2x/4x con alpha preservation
- rembg sidecar — Background removal local ($0, ~200ms)

**Regla de oro multi-position**: Diseñar TODAS las posiciones (front + back + neck + sleeves). Cada posición con diseño propio, NUNCA copiar front a back.

### Catalog Agent

**Responsabilidad**: Crear productos en Printful, gestionar catálogo, pricing, GPSR.

**Pipeline post-diseño aprobado**:
```
1. Recibe event `design.approved` con design_id
   ↓
2. Upload diseño a Printful (POST /files)
   ↓
3. Crear sync product (POST /store/products)
   - Blueprint, provider, variants (colores/tallas)
   - Print areas por posición
   - Pricing según PRICING_RULES.md
   ↓
4. Set GPSR data (EU Regulation 2023/988)
   - safety_information, material, manufacturing_country
   - Almacenar en product_details JSONB (Supabase)
   ↓
5. Sync a Supabase (INSERT products + product_variants)
   ↓
6. Generar traducciones (name_en/es/de, description_en/es/de)
   ↓
7. Asignar categoría
   ↓
8. Activar producto (status: active)
   ↓
9. Notificar CEO: "Producto publicado: [nombre] — [link]"
```

**Endpoints Printful necesarios** (18 disponibles en frontend client):
- `POST /store/products` — Crear
- `POST /files` — Upload diseño
- `POST /mockup-generator/create-task/{id}` — Mockups
- `GET /products` — Catálogo (cached 10 min)
- `POST /shipping/rates` — Tarifas envío
- `POST /orders?confirm=true` — Crear pedido

**Decisión arquitectónica**: PodClaw accede a Printful via **MCP tools** que wrappean el frontend client existente. Evita duplicar rate limiter, caching, mapper.

### Customer Agent

**Responsabilidad**: Soporte cliente, refunds, reviews, email.

**Event sources**:
- `customer.email` — Resend inbound webhook
- `customer.contact` — Formulario contacto (API pendiente)
- `sale.completed` — Post-purchase follow-up
- Printful `order.failed` — Auto-refund

**Capacidades**:
- Responder emails (Resend, max 100/ciclo)
- Auto-approve refunds <€100
- Enviar satisfaction surveys (7d post-delivery)
- Escalación al CEO para refunds >€100
- Responder product reviews (locale-aware)

### Finance Agent

**Responsabilidad**: Reporting financiero, cost tracking.

**Triggers**:
- `ceo.query` — "¿cuánto vendimos?"
- `sale.completed` — Registrar venta
- `budget.threshold` — Alertar 80% consumido
- Diario (cron residual) — Reporte end-of-day

### Researcher Agent

**Triggers**: `ceo.research_request`
**Modelo**: Haiku 4.5 ($0.60/sesión)
**Capacidades**: Tendencias, competencia, insights de mercado

### Marketing Agent

**Triggers**: `ceo.marketing_request`, `product.published` (auto-generate social post)
**Capacidades**: Contenido social, campaign copy, A/B subject lines

### Newsletter Agent

**Triggers**: `ceo.newsletter_request`, scheduled (semanal)
**Capacidades**: Segmentación RFM, personalización, A/B testing, drip sequences

### QA Inspector

**Triggers**: `product.published` (auto-inspect), `ceo.qa_request`
**Capacidades**: Verificar GPSR, dimensiones, pricing, traducciones

### Brand Manager

**Triggers**: `design.approved` (verify brand consistency), weekly report
**Capacidades**: Consistencia visual, paleta colores, guidelines

---

## Message Gateway — WhatsApp/Telegram

### Estado Actual vs Requerido

| Capability | WhatsApp Actual | WhatsApp Requerido | Gap |
|------------|----------------|-------------------|-----|
| Enviar texto | ✅ | ✅ | — |
| Enviar template | ✅ | ✅ | — |
| Enviar imagen | ❌ | ✅ | CRITICAL |
| Recibir texto | ❌ | ✅ | CRITICAL |
| Recibir imagen | ❌ | ✅ | CRITICAL |
| Botones interactivos | ❌ | ✅ | CRITICAL |
| Webhook inbound | ❌ | ✅ | CRITICAL |

| Capability | Telegram Actual | Telegram Requerido | Gap |
|------------|----------------|-------------------|-----|
| Enviar texto | ✅ | ✅ | — |
| Enviar foto | ✅ | ✅ | — |
| Inline keyboards | ❌ | ✅ | HIGH |
| Webhook inbound | Parcial (test) | ✅ | HIGH |
| Admin commands | ✅ | ✅ | — |

### Arquitectura Gateway Propuesta

```
WhatsApp Cloud API v18.0        Telegram Bot API
  (Meta Business)                  (grammY/polling)
       │                              │
       ▼                              ▼
  POST /api/webhooks/           POST /api/webhooks/
    whatsapp/inbound              telegram/inbound
       │                              │
       └──────────┬───────────────────┘
                  │
           ┌──────▼──────┐
           │  Normalizer  │
           │  → unified   │
           │    message    │
           │    format     │
           └──────┬──────┘
                  │
           ┌──────▼──────┐
           │ Event Router │
           │ classify +   │
           │ dispatch     │
           └──────┬──────┘
                  │
           ┌──────▼──────┐
           │ Agent Pool   │
           └─────────────┘
```

### Mensaje Normalizado

```typescript
interface NormalizedMessage {
  id: string
  platform: 'whatsapp' | 'telegram'
  sender: {
    platformUserId: string
    isAdmin: boolean  // CEO flag
  }
  type: 'text' | 'image' | 'button_response' | 'location'
  content: {
    text?: string
    imageUrl?: string
    buttonPayload?: string  // approve|reject|{custom}
  }
  replyTo?: string  // message ID para threading
  timestamp: Date
}
```

### Outbound: CEO Communication

```typescript
interface OutboundMessage {
  platform: 'whatsapp' | 'telegram'
  recipientId: string
  type: 'text' | 'image' | 'buttons' | 'template'
  content: {
    text?: string
    imageUrl?: string  // Preview de diseño
    buttons?: Array<{
      id: string
      text: string  // "✅ Aprobar" | "❌ Rechazar"
    }>
  }
}
```

### WhatsApp Interactive Messages (Meta API)

```json
{
  "messaging_product": "whatsapp",
  "to": "CEO_PHONE",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "header": {
      "type": "image",
      "image": { "link": "https://storage.../design-preview.png" }
    },
    "body": {
      "text": "Nuevo diseño: SKAPARA Ghost Tee\nCanvas: 4606×5787 @300dpi\nPrecio: €24.99\n¿Aprobar para producción?"
    },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "approve_design_123", "title": "✅ Aprobar" }},
        { "type": "reply", "reply": { "id": "reject_design_123", "title": "❌ Rechazar" }},
        { "type": "reply", "reply": { "id": "edit_design_123", "title": "✏️ Editar" }}
      ]
    }
  }
}
```

---

## Data Model — Tablas Nuevas

### design_tasks (Cola de trabajo de diseño)

```sql
CREATE TABLE design_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending → designing → rendering → preview_sent → approved → rejected → product_created
  ceo_prompt TEXT,
  reference_image_url TEXT,
  design_type TEXT NOT NULL, -- dtg | embroidery | sublimation
  blueprint_id INTEGER,
  canvas_specs JSONB, -- {width, height, dpi, positions: [...]}
  svg_url TEXT,
  png_url TEXT,
  mockup_url TEXT,
  printful_product_id TEXT,
  supabase_product_id UUID,
  feedback TEXT, -- CEO feedback si rejected
  agent_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### ceo_approvals (Workflow de aprobación)

```sql
CREATE TABLE ceo_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL, -- design | product | refund | newsletter
  resource_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  message_id TEXT, -- WhatsApp/Telegram message ID
  platform TEXT, -- whatsapp | telegram
  ceo_response TEXT, -- Texto adicional del CEO
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
```

### support_tickets (Soporte cliente)

```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT, -- general | support | order | product | partnership | feedback
  body TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open | in_progress | resolved | escalated
  assigned_agent TEXT, -- customer_manager | ceo
  thread_id TEXT, -- Email thread tracking
  order_id UUID REFERENCES orders, -- Si es sobre un pedido
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### event_queue (Cola de eventos persistente)

```sql
CREATE TABLE event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- ceo.design_request, customer.email, sale.completed, etc.
  payload JSONB NOT NULL,
  priority INTEGER DEFAULT 5, -- 1 (highest) → 10 (lowest)
  status TEXT DEFAULT 'pending', -- pending | processing | completed | failed | dead
  target_agent TEXT, -- design | catalog | customer | finance | null (router decides)
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

---

## Tablas Existentes Relevantes (Sin Cambios)

| Tabla | Uso en PodClaw v2 |
|-------|-------------------|
| `products` | Catalog agent crea/edita (service_role) |
| `product_variants` | Catalog agent sync variantes |
| `orders` | Finance agent lee, Customer agent gestiona |
| `order_items` | Finance agent reporta |
| `categories` | Catalog agent asigna |
| `agent_events` | Audit trail inmutable (mantener) |
| `user_messaging_links` | Vincular CEO phone con user_id |
| `whatsapp_messages` | Historial mensajes |
| `telegram_messages` | Historial mensajes |
| `newsletter_subscribers` | Newsletter agent |
| `newsletter_campaigns` | Newsletter agent |
| `drip_queue` | Drip email processor |
| `abandoned_carts` | Cart recovery |

---

## Stack Tecnológico

### Runtime
- **Python 3.12+** — PodClaw core (Claude Agent SDK)
- **Node.js 22+** — SVG rendering sidecar (@resvg/resvg-js + sharp)
- **FastAPI** — Bridge API (WebSocket + REST)

### AI Models
- **Claude Sonnet 4.5** — Agentes principales (diseño, catálogo, cliente)
- **Claude Haiku 4.5** — Researcher, QA, SEO (bajo coste)
- **Recraft V3** — SVG generation (vector illustrations)
- **FAL.ai FLUX** — Image generation fallback
- **FAL.ai ESRGAN** — Upscaling 2x/4x

### Infrastructure
- **Supabase** — PostgreSQL + Auth + Storage + Realtime (futuro)
- **Redis** — Event queue caching, rate limiting, distributed locks
- **Printful API** — POD provider (via MCP tools)
- **Stripe** — Pagos
- **Resend** — Email transaccional + marketing
- **rembg sidecar** — Background removal local
- **Meta WhatsApp Cloud API** — Mensajería CEO
- **Telegram Bot API** — Mensajería CEO alternativa

### Deployment
- **Docker Compose** en VPS single-instance
- **Caddy** reverse proxy + auto HTTPS
- Supabase cloud (no self-hosted)

---

## Presupuesto Diario Propuesto

| Agente | Modelo | Budget/sesión | Budget/día | Trigger |
|--------|--------|---------------|------------|---------|
| Design | Sonnet 4.5 | $1.50 | €5.00 | CEO request |
| Catalog | Sonnet 4.5 | $2.00 | €8.00 | design.approved + reconciliation |
| Customer | Sonnet 4.5 | $1.00 | €3.00 | customer.email + sale events |
| Finance | Sonnet 4.5 | $1.20 | €2.50 | CEO query + daily report |
| Researcher | Haiku 4.5 | $0.60 | €1.50 | CEO request |
| Marketing | Sonnet 4.5 | $1.00 | €2.00 | CEO request + product.published |
| Newsletter | Sonnet 4.5 | $0.80 | €1.50 | CEO request + weekly |
| QA Inspector | Haiku 4.5 | $0.15 | €0.50 | product.published |
| Brand Manager | Sonnet 4.5 | $0.80 | €1.00 | design.approved |
| **Total** | | | **€25.50/día** | |

**Global daily limit**: €30.00 (mantener)

---

## Flujos End-to-End

### Flujo 1: CEO pide diseño de camiseta

```
CEO [WhatsApp]: "Diseña una camiseta minimalista con el S mark, fondo negro,
                 estilo ghost outline. Para la colección Urban Noir."
  ↓
Gateway: Normalizar mensaje → evento `ceo.design_request`
  ↓
Event Router: Clasificar como diseño DTG → dispatch Design Agent
  ↓
Design Agent:
  1. Consulta skill `design-dtg` → CANVAS_SPECS: BP6 (4606×5787)
  2. Consulta `DESIGN_GUIDELINES.md` → patrón "Extreme Minimalism"
  3. Genera SVG (Claude code gen: S mark ghost outline, fondo transparente)
  4. Renderiza SVG → PNG (@resvg/resvg-js, 4606×5787 @300dpi)
  5. Valida dimensiones + transparencia
  6. Upload a Supabase Storage
  7. Genera mockup (Printful mockup API)
  8. Crea design_task (status: preview_sent)
  9. Envía preview al CEO via WhatsApp con botones
  ↓
CEO [WhatsApp]: [imagen mockup] "SKAPARA Ghost Tee — ¿Aprobar?"
               [✅ Aprobar] [❌ Rechazar] [✏️ Editar]
  ↓
CEO toca "✅ Aprobar"
  ↓
Gateway: evento `ceo.approve` (resource_id: design_task_123)
  ↓
Event Router: dispatch Catalog Agent
  ↓
Catalog Agent:
  1. Upload diseño a Printful (POST /files)
  2. Crear sync product con variantes (6 colores × 6 tallas)
  3. Set GPSR data en product_details
  4. Sync a Supabase (INSERT products + product_variants)
  5. Traducciones EN/ES/DE
  6. Asignar categoría "T-Shirts"
  7. Status: active
  ↓
QA Inspector (auto-triggered por product.published):
  1. Verifica GPSR completo
  2. Verifica pricing (margen ≥35%)
  3. Verifica traducciones
  4. Verifica imágenes
  ↓
CEO [WhatsApp]: "✅ Producto publicado: SKAPARA Ghost Tee
                 Precio: €24.99 | 36 variantes | Categoría: T-Shirts
                 Link: https://skapara.com/shop/skapara-ghost-tee"
```

### Flujo 2: Cliente compra → Fulfillment → Soporte

```
Cliente: Compra SKAPARA Ghost Tee (Black, M) via checkout
  ↓
Stripe webhook: checkout.session.completed
  ↓
Handler:
  1. Crear order en Supabase (status: paid)
  2. Submit order a Printful (POST /orders?confirm=true)
  3. Enviar email confirmación al cliente
  4. Emit evento `sale.completed`
  ↓
CEO [WhatsApp]: "🎉 Nueva venta: SKAPARA Ghost Tee (Black, M)
                 Total: €24.99 | Cliente: J.García
                 Pedido enviado a producción."
  ↓
[3-7 días después]
Printful webhook: order.shipped (tracking: DE123456789)
  ↓
Handler:
  1. Update order.status = 'shipped'
  2. Update tracking_number + tracking_url
  3. Enviar email "shipped" al cliente
  ↓
CEO [WhatsApp]: "📦 Pedido #1234 enviado. Tracking: DE123456789"
  ↓
[7 días después]
Cron check-delivery: Marca como delivered
  ↓
Handler:
  1. Update order.status = 'delivered'
  2. Enviar email "delivered" + review request
  ↓
[Cliente responde al email]
Resend inbound webhook → `customer.email`
  ↓
Customer Agent:
  1. Clasifica: ¿soporte, feedback, return?
  2. Si soporte → crear support_ticket
  3. Si return request <€100 → auto-approve refund
  4. Si return >€100 → escalar al CEO
```

### Flujo 3: CEO desde imagen de referencia

```
CEO [WhatsApp]: [adjunta foto de diseño de calle]
               "Me gusta este estilo. Hagamos una gorra snapback con este vibe."
  ↓
Gateway: Normalizar → evento `ceo.design_from_image`
  ↓
Design Agent:
  1. Analiza imagen referencia (Claude vision)
  2. Extrae: estilo, colores, composición
  3. Consulta skill `design-embroidery` → BP1744 (1770×600)
  4. Genera diseño adaptado a embroidery constraints:
     - Max 3 colores de hilo
     - Sin gradientes
     - Líneas min 1.5mm
  5. Renderiza preview
  6. Genera mockup en cap
  7. Envía al CEO con botones
  ↓
CEO [WhatsApp]: [mockup gorra] "¿Aprobar?"
               [✅ Aprobar] [❌ Rechazar] [✏️ Editar]
  ↓
CEO toca "✏️ Editar": "Ponle el S mark en el lateral"
  ↓
Design Agent:
  1. Modifica diseño: añade S mark en posición lateral
  2. Re-renderiza
  3. Re-envía preview
```

---

## Componentes Nuevos a Implementar

### 1. Message Gateway (Python)

```
podclaw/gateway/
├── __init__.py
├── whatsapp.py       — Meta Cloud API v18.0 (enviar/recibir texto, imagen, botones)
├── telegram.py       — Telegram Bot API (enviar/recibir texto, foto, inline keyboards)
├── normalizer.py     — Normalizar mensajes a formato unificado
└── outbound.py       — Enviar mensajes al CEO (text, image, buttons)
```

**LOC estimado**: ~400

### 2. Event Router (Python)

```
podclaw/router/
├── __init__.py
├── classifier.py     — Clasificar evento → tipo + agente target
├── dispatcher.py     — Despachar evento al agente correcto
├── priority.py       — Queue de prioridad (1-10)
└── dead_letter.py    — DLQ con auto-retry exponential backoff
```

**LOC estimado**: ~300

### 3. SVG Rendering Sidecar (Node.js)

```
deploy/svg-renderer/
├── Dockerfile
├── package.json       — @resvg/resvg-js, sharp
├── server.js          — FastAPI-style HTTP server
└── routes/
    ├── render.js      — POST /render (SVG → PNG @300dpi, exact dims)
    ├── composite.js   — POST /composite (multi-layer composition)
    └── health.js      — GET /health
```

**LOC estimado**: ~200

### 4. Printful MCP Connector (Python)

```
podclaw/connectors/printful_connector.py
  — 20+ tools wrapping frontend client via HTTP
  — O direct Printful API calls con rate limiter propio
```

**LOC estimado**: ~800

### 5. Webhook Receivers (Next.js API routes)

```
frontend/src/app/api/webhooks/
├── whatsapp/inbound/route.ts    — NUEVO: recibir mensajes WhatsApp
├── telegram/inbound/route.ts    — NUEVO: recibir mensajes Telegram
├── email/inbound/route.ts       — NUEVO: Resend inbound
├── stripe/route.ts              — EXISTENTE
└── pod/[provider]/route.ts      — EXISTENTE
```

### 6. Approval Flow (Python)

```
podclaw/approval/
├── __init__.py
├── manager.py         — Crear/resolver aprobaciones
├── timeout.py         — Auto-timeout si CEO no responde en 24h
└── escalation.py      — Re-enviar reminder después de 4h
```

**LOC estimado**: ~200

---

## Roadmap de Implementación

### Fase 1: Foundation (Semana 1-2)

| Tarea | Componente | Prioridad |
|-------|-----------|-----------|
| Event queue table + model | Data Model | P0 |
| Design tasks table | Data Model | P0 |
| CEO approvals table | Data Model | P0 |
| Support tickets table | Data Model | P0 |
| WhatsApp inbound webhook | Gateway | P0 |
| Telegram inbound webhook | Gateway | P0 |
| Message normalizer | Gateway | P0 |
| Event Router (classify + dispatch) | Router | P0 |
| `/api/contact` route handler | Frontend | P0 |

### Fase 2: Design Pipeline (Semana 3-4)

| Tarea | Componente | Prioridad |
|-------|-----------|-----------|
| SVG rendering sidecar | Infrastructure | P0 |
| Design Agent con skills | Agent | P0 |
| Canvas specs lookup automático | Agent | P0 |
| WhatsApp image send + interactive buttons | Gateway | P0 |
| Mockup generation (Printful async) | Agent | P1 |
| Approval flow manager | Approval | P1 |

### Fase 3: Printful Integration (Semana 5-6)

| Tarea | Componente | Prioridad |
|-------|-----------|-----------|
| Printful MCP connector (Python) | Connector | P0 |
| Catalog Agent post-approval flow | Agent | P0 |
| GPSR automation | Agent | P0 |
| QA Inspector auto-trigger | Agent | P1 |
| Product publish notification | Gateway | P1 |

### Fase 4: Customer & Finance (Semana 7-8)

| Tarea | Componente | Prioridad |
|-------|-----------|-----------|
| Resend inbound webhook | Webhook | P0 |
| Customer Agent con tickets | Agent | P0 |
| Finance Agent event-driven | Agent | P1 |
| Newsletter Agent refactor | Agent | P1 |
| Sale notification al CEO | Gateway | P1 |
| Daily report al CEO | Agent | P2 |

### Fase 5: Hardening (Semana 9-10)

| Tarea | Componente | Prioridad |
|-------|-----------|-----------|
| DLQ auto-retry con backoff | Router | P1 |
| Budget tracking event-driven | Security | P1 |
| Supabase Realtime (live order tracking) | Infrastructure | P1 |
| Monitoring dashboard | Observability | P2 |
| E2E tests design pipeline | Testing | P2 |
| Load testing event router | Testing | P2 |

---

## Métricas de Éxito

| Métrica | PodClaw v1 (Cron) | PodClaw v2 Target |
|---------|-------------------|-------------------|
| Latencia CEO→Acción | 1-22 horas | <5 minutos |
| Utilización agentes | 52% (11.5h idle/día) | >80% (on-demand) |
| Coste diario | €30 fijo | €15-25 variable |
| Diseño→Producto publicado | Manual (horas) | <30 min (con aprobación) |
| Tiempo respuesta cliente | No existe | <2 horas |
| Webhooks procesados/día | ~50 | ~200+ |
| CEO satisfaction | N/A | Medible via interaction frequency |

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| WhatsApp API rate limits | Media | Alto | Queuing + backpressure |
| SVG rendering fidelity | Media | Alto | Fallback a Puppeteer si @resvg falla |
| CEO no responde aprobaciones | Alta | Medio | Auto-timeout 24h + reminder 4h |
| Printful API downtime | Baja | Alto | Circuit breaker + retry queue |
| Budget overrun por eventos | Media | Medio | Hard cap diario + per-session limit |
| Double-refund (bug existente) | Alta | Alto | Fix inmediato: dedup refund logic |
| Inbound email spam | Media | Bajo | Rate limit + classification |

---

## Decisiones Arquitectónicas Clave

### D1: ¿Python puro o Node.js sidecar para SVG?
**Decisión**: Node.js sidecar (`@resvg/resvg-js` + `sharp`)
**Razón**: @resvg/resvg-js tiene mejor fidelidad SVG que cairosvg. PodClaw es Python pero el rendering es un servicio aislado. Mismo patrón que rembg sidecar.

### D2: ¿Printful connector directo o via MCP tools?
**Decisión**: Nuevo connector Python directo (no via MCP)
**Razón**: MCP server es para clientes externos (ChatGPT, Claude). PodClaw es interno — acceso directo a Printful API es más eficiente y evita dependency circular.

### D3: ¿Event queue en Redis o PostgreSQL?
**Decisión**: PostgreSQL (Supabase) con Redis cache
**Razón**: Persistencia > velocidad para events críticos. Redis para dedup y rate limiting. PostgreSQL para audit trail y retry.

### D4: ¿Claude genera SVGs o usamos Recraft?
**Decisión**: Ambos. Claude para SVGs simples (logos, marcas, texto). Recraft para illustrations complejas.
**Razón**: Claude genera SVG code directamente (más control), Recraft para diseños artísticos.

### D5: ¿WhatsApp o Telegram como canal primario del CEO?
**Decisión**: WhatsApp primario, Telegram fallback.
**Razón**: WhatsApp tiene interactive buttons (approve/reject) nativos. Telegram es fallback con inline keyboards.

---

## Documentos de Referencia

| Doc | Contenido |
|-----|-----------|
| `01_SKILLS_DESIGN_PIPELINE.md` | Skills DTG, embroidery, sublimation, catalog planner |
| `02_WHATSAPP_TELEGRAM_STATE.md` | Estado actual conectores mensajería |
| `03_SUPABASE_PRODUCT_SCHEMA.md` | Schema productos, orders, variants, RLS |
| `04_SVG_RENDERING_PIPELINE.md` | Pipeline SVG→PNG, herramientas, gaps |
| `05_PRINTFUL_API_COMPLETE.md` | Integración Printful, endpoints, webhooks |
| `06_WEBHOOKS_EVENT_MAP.md` | Mapa completo webhooks, crons, triggers |
| `07_EMAIL_INFRASTRUCTURE.md` | Email transaccional, marketing, inbound |

---

*Blueprint generado a partir de 7 auditorías técnicas profundas ejecutadas por agentes especializados en paralelo. Todos los hallazgos verificados contra codebase real.*
