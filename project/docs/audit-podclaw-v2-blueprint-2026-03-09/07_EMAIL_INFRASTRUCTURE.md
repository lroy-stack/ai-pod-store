# Email Infrastructure — Estado Completo

*Generado por agente de exploración 2026-03-09*

## Resumen

Email **60% completo**: Transaccional y marketing sólidos via Resend. **Gaps críticos**: formulario de contacto sin API, no hay inbound email, no hay sistema de tickets de soporte.

## Outbound Email (Operativo)

### Emails Transaccionales (6 tipos)

**Archivo**: `frontend/src/lib/resend.ts`

| Email | Trigger | Contenido | i18n |
|-------|---------|-----------|------|
| Order Confirmation | Stripe checkout.session.completed | Nº pedido, items, total | EN/ES/DE |
| Order Shipped | Printful webhook order.shipped | Tracking number, carrier, URL | EN/ES/DE |
| Order Cancelled/Refunded | Cancelación | Monto refund, timeline 5-10d | EN/ES/DE |
| Order Delivered | Delivery confirmed | Review request, support CTA | EN/ES/DE |
| Order Failed | Processing failure | Auto-refund notice, support link | EN/ES/DE |
| Credit Purchase | Design credit purchase | Credits added, new balance | EN/ES/DE |

### Diseño de Email
- Header con gradiente (purple #667eea → #764ba2)
- CTA button prominente
- Footer con info empresa + unsubscribe link
- Brand: SKAPARA UG, Musterstraße 1, 10115 Berlin, Germany

### Direcciones Configuradas

| Tipo | Dirección | Variable |
|------|-----------|----------|
| Transaccional | `noreply@skapara.com` | `RESEND_FROM_EMAIL` |
| General | `hello@skapara.com` | Hardcoded |
| Soporte | `support@skapara.com` | Hardcoded |
| Privacy/DPO | `privacy@skapara.com` | Hardcoded |
| Admin | `admin@skapara.com` | Hardcoded |
| PodClaw | `noreply@podai.com` | podclaw/config.py (inconsistente) |

**Problema**: Dominio dual — frontend usa skapara.com, PodClaw config referencia podai.com.

## Newsletter & Drip System

### Double Opt-In (GDPR)

**Archivo**: `frontend/src/app/api/newsletter/subscribe/route.ts`

```
1. User submit email + locale
2. Generate confirmation token (32-byte crypto)
3. Create newsletter_subscribers (unconfirmed)
4. Send confirmation email via Resend
5. User clicks link → /api/newsletter/confirm/[token]
6. Set confirmed_at → eligible for emails
```

### Drip Sequences

**Archivo**: `frontend/src/lib/email-drip.ts`

```
welcome sequence:
  Day 0 (1h):   "Welcome to Skapara — Your AI Design Studio"
  Day 3 (72h):  "3 Ways to Create Amazing Designs with AI"
  Day 7 (168h): "Unlock More Designs — Upgrade to Premium"
```

**Procesador**: `/api/cron/drip` cada 15-30 min
- Fetch pending donde `send_at <= now()`
- Verifica `confirmed_at` (GDPR gate)
- Envía via Resend con unsubscribe token
- Marca sent/failed

### Abandoned Cart Recovery

**Archivo**: `frontend/src/app/api/cron/abandoned-cart-recovery/route.ts`

| Tiempo | Subject | CTA |
|--------|---------|-----|
| +1h | "You left N items in your cart" | "Complete Your Order" |
| +24h | "Your cart is still waiting!" | "Complete Your Order" |

- Tracking via tabla `abandoned_carts` (first_email_sent_at, second_email_sent_at)
- Recovery detection: marca `recovered_at` cuando se completa compra
- i18n: EN/ES/DE

### Tablas DB

| Tabla | Propósito |
|-------|-----------|
| `newsletter_subscribers` | email, locale, confirmed_at, token, subscribed |
| `newsletter_campaigns` | campaign_name, segment, subject_a/b, body, drip_sequence, status |
| `drip_queue` | user_id, email, sequence, step, template, send_at, status |
| `abandoned_carts` | user_id, email, locale, first_email, second_email, recovered_at |

## PodClaw Email Agents

### Newsletter Agent

**Archivo**: `podclaw/agents/newsletter.py`
**Schedule**: 09:00 + 17:00 UTC
**Tools**: supabase, resend, gemini

Funciones:
- Segmentar subscribers por RFM (Recency, Frequency, Monetary)
- Contenido personalizado por segmento (Champions, At-Risk, New)
- A/B test subject lines y CTAs
- Embeddings via Gemini para personalización
- Max 500 emails/ciclo
- Log a `newsletter_campaigns` table

### Customer Manager Agent

**Archivo**: `podclaw/agents/customer_manager.py`
**Schedule**: 12:00 + 22:00 UTC
**Tools**: supabase, resend, stripe (read)

Funciones definidas (skeleton):
- Review support tickets (NO HAY TABLA)
- Respond to product reviews (locale-aware)
- Process return/refund requests (auto-approve <$100)
- Send retention emails
- Post-purchase satisfaction surveys (7d after delivery)
- Escalate complex issues

**Estado**: Skeleton definido pero **no hay sistema de tickets**.

## PodClaw Resend Connector

**Archivo**: `podclaw/connectors/resend_connector.py`

| Tool | Propósito |
|------|-----------|
| `resend_send` | Email individual (HTML, text, reply-to, tags) |
| `resend_send_batch` | Bulk emails (hasta 100/call) |
| `resend_list_emails` | Archivo de emails con filtrado por tag |
| `resend_get_bounce_stats` | Métricas: bounce, delivery, open, click rates |

## Formulario de Contacto

### UI ✅ Existe

**Archivo**: `frontend/src/components/contact/ContactForm.tsx`

- Campos: Name, Email, Subject (dropdown: general/support/order/product/partnership/feedback), Message
- i18n: EN/ES/DE
- Submit: `POST /api/contact`

### API ❌ NO EXISTE

**`/api/contact/route.ts` NO IMPLEMENTADO**

- Form submissions retornan 404
- Datos del cliente se pierden
- Fallo silencioso (sin error handling en el form)

## Inbound Email — NO IMPLEMENTADO

### Estado actual: ZERO inbound
- No hay IMAP/POP3 integration
- No hay email forwarding desde support@skapara.com
- No hay webhook de Resend inbound
- No hay Mailgun/SendGrid/PostMark integration
- Comunicación es 100% unidireccional

### Alternativas existentes (no son email)
- `conversations` table: Chat AI en UI, no soporte
- Telegram bot: Solo comandos admin, no soporte cliente
- WhatsApp: Solo texto outbound, sin procesamiento inbound real

## Compliance

### CAN-SPAM ✅
- Sender name + email en todos
- Subject claro
- RFC 8058 List-Unsubscribe header (one-click)
- Footer unsubscribe link
- Dirección física incluida
- 24h unsubscribe honor

### GDPR ✅
- Double opt-in para newsletter
- Solo envío a subscribers confirmados
- Unsubscribe tokens seguros (32-byte crypto)
- Consent tracking

### Email Authentication ⚠️
- Resend maneja DKIM, SPF, DMARC (servicio managed)
- Custom domain (skapara.com) requiere DNS config en Resend
- No hay DMARC policy explícita en codebase

## GAPS para PodClaw v2

### CRITICAL

| Gap | Impacto | Solución Propuesta |
|-----|---------|-------------------|
| API `/api/contact` no existe | Clientes no pueden contactar soporte | Implementar endpoint + tabla `support_tickets` |
| No inbound email | Comunicación unidireccional | Resend inbound webhook → event source |
| Customer manager sin tickets | Agente sin datos que procesar | Crear tabla + workflow |

### HIGH

| Gap | Impacto | Solución Propuesta |
|-----|---------|-------------------|
| Dominio inconsistente | skapara.com vs podai.com | Unificar a skapara.com |
| No bounce suppression | Emails a direcciones inválidas | Auto-disable bounced addresses |
| No thread tracking | No se puede seguir conversación | Thread ID en email headers |

### MEDIUM

| Gap | Impacto | Solución Propuesta |
|-----|---------|-------------------|
| No tracking UI | Sin dashboard de métricas email | Panel admin con stats |
| A/B auto-selection incompleto | Winner manual | Automatizar selección 4h |
| No email templates React | HTML inline | React Email para templates |

## Recomendación para PodClaw v2

### Email como Event Source

```
INBOUND EMAIL FLOW (propuesto):

Cliente responde a noreply@skapara.com
  ↓
Resend inbound webhook → POST /api/webhooks/email/inbound
  ↓
Parsear: from, subject, body, in-reply-to (thread ID)
  ↓
Clasificar: soporte / feedback / reply-to-order
  ↓
Crear evento: customer.email
  ↓
PodClaw customer_manager agent procesa
  ↓
Respuesta automática o escalación al CEO via WhatsApp
```

### Requisitos Resend Inbound
1. Configurar dominio MX para inbound en Resend
2. Webhook endpoint `/api/webhooks/email/inbound`
3. Tabla `support_tickets` (id, email, subject, body, thread_id, status, assigned_to, created_at)
4. Event emission a PodClaw

### Prioridad de Implementación
1. **Fase 1**: API `/api/contact` + tabla `support_tickets` (inmediato)
2. **Fase 2**: Resend inbound webhook (pre-lanzamiento)
3. **Fase 3**: Customer manager agent conectado a tickets (PodClaw v2)
4. **Fase 4**: Thread tracking + auto-categorización (post-lanzamiento)
