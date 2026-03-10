# Email Infrastructure Audit — POD AI Store (SKAPARA)

**Date**: 2026-03-09
**Scope**: Resend integration, email templates, newsletter system, inbound email, customer support flow
**Provider**: Resend (https://resend.com)

---

## 1. Resend Integration — Estado Actual

### 1.1 SDK & Configuration

| Item | Valor |
|---|---|
| SDK | `resend` npm package (TypeScript) |
| API Key env var | `RESEND_API_KEY` |
| From email env var | `RESEND_FROM_EMAIL` |
| Default from | `SKAPARA <noreply@skapara.com>` |
| Domain configurado | `skapara.com` (en .env.example: `noreply@yourdomain.com`) |
| Contact emails | `hello@skapara.com`, `support@skapara.com` |

### 1.2 Frontend Resend Client

**Archivo**: `frontend/src/lib/resend.ts`

- Lazy singleton via Proxy (no se inicializa hasta primer uso)
- Graceful degradation: si `RESEND_API_KEY` no existe, warn en console pero no crashea
- Paleta de colores centralizada (`EMAIL_COLORS`)
- Datos de empresa centralizados (`COMPANY_INFO`)
- `COMPANY_INFO.address`: `c/o SKAPARA UG, Musterstrasse 1, 10115 Berlin, Germany`

### 1.3 PodClaw Resend Connector

**Archivo**: `podclaw/connectors/resend_connector.py`

Clase `ResendMCPConnector` con 4 tools expuestas a los agentes:

| Tool | Descripcion | Params |
|---|---|---|
| `resend_send` | Enviar email individual | `to`, `subject`, `html`, `text`, `reply_to`, `tags` |
| `resend_send_batch` | Enviar batch (max 100) | `emails[]` con `to`, `subject`, `html` |
| `resend_list_emails` | Listar emails enviados | `tag` (opcional) |
| `resend_get_bounce_stats` | Estadisticas de bounces/delivery | ninguno |

**Agentes que usan Resend**: `newsletter`, `customer_manager`, `marketing`

---

## 2. Emails Outbound — Inventario Completo

### 2.1 Emails Transaccionales (Order Lifecycle)

Todos definidos en `frontend/src/lib/resend.ts` con templates HTML inline, soporte trilingue (en/es/de):

| Email | Funcion | Trigger | Archivo trigger |
|---|---|---|---|
| **Order Confirmation** | Confirmacion de pedido pagado | `checkout.session.completed` webhook de Stripe | `webhooks/stripe/checkout-completed.ts` |
| **Order Shipped** | Pedido enviado con tracking | Webhook POD provider `order.shipped` | `pod/webhooks/handlers/order-shipped.ts` |
| **Order Delivered** | Pedido entregado + CTA review | Webhook POD provider `order.delivered` | `pod/webhooks/handlers/order-delivered.ts` |
| **Order Cancelled** | Pedido cancelado + refund info | Webhook POD provider `order.cancelled` | `pod/webhooks/handlers/order-cancelled.ts` |
| **Order Failed** | Error en produccion + refund | Webhook POD provider `order.failed` | `pod/webhooks/handlers/order-failed.ts` |
| **Credit Purchase** | Compra de creditos confirmada | `checkout.session.completed` (type=credit_pack) | `webhooks/stripe/checkout-completed.ts` |

### 2.2 Emails Operacionales (No-template, inline HTML)

| Email | Funcion | Trigger | Archivo |
|---|---|---|---|
| **Order Issue / Review Required** | Pedido requiere revision manual | Fallo en submission a POD provider | `webhooks/stripe/shared.ts` (`sendOrderIssueEmail`) |
| **Payment Failed** | Pago de suscripcion fallido | `invoice.payment_failed` de Stripe | `webhooks/stripe/invoice-handlers.ts` |
| **Account Deletion Confirmation** | Confirmacion de baja GDPR | POST `/api/profile/delete` | `api/profile/delete/route.ts` |

### 2.3 Emails Marketing / Drip

| Email | Funcion | Trigger | Archivo |
|---|---|---|---|
| **Newsletter Confirmation** | Double opt-in (GDPR) | POST `/api/newsletter/subscribe` | `api/newsletter/subscribe/route.ts` |
| **Welcome Drip (1h)** | Bienvenida al registrarse | `triggerDripSequence('welcome')` -> cron `/api/cron/drip` | `lib/email-drip.ts` + `api/cron/drip/route.ts` |
| **Tips Drip (72h)** | 3 tips para crear disenos | Drip queue send_at | `api/cron/drip/route.ts` |
| **Credit Offer Drip (168h)** | Upsell a Premium | Drip queue send_at | `api/cron/drip/route.ts` |
| **Abandoned Cart (1h)** | Primer recordatorio carrito | Cron `/api/cron/abandoned-cart-recovery` | `api/cron/abandoned-cart-recovery/route.ts` |
| **Abandoned Cart (24h)** | Segundo recordatorio carrito | Cron (isSecondEmail=true) | `api/cron/abandoned-cart-recovery/route.ts` |

### 2.4 Emails via PodClaw Agents

| Agente | Tipo de emails | Herramienta |
|---|---|---|
| **Newsletter Agent** | Campanas segmentadas (RFM), drip post-purchase (D7 survey, D14 review), win-back | `resend_send` / `resend_send_batch` |
| **Customer Manager Agent** | Retention emails, respuestas a tickets | `resend_send` |
| **Marketing Agent** | Emails promocionales, campanas | `resend_send` / `resend_send_batch` |

---

## 3. Templates de Email

### 3.1 Estado: NO hay sistema de templates React

- **Todos los emails usan HTML inline** (template literals en TypeScript)
- **No se usa** `react-email`, `@react-email/components`, ni ningun sistema de componentes de email
- La paleta de colores esta centralizada en `EMAIL_COLORS` en `resend.ts`
- Los textos estan duplicados para cada locale (en/es/de) dentro de cada funcion

### 3.2 Templates del Drip System

Definidos en `api/cron/drip/route.ts` como funciones que retornan `{ html: string }`:

| Template | Contenido |
|---|---|
| `welcome` | Bienvenida + features (chat AI, 5 disenos/mes, mockups) |
| `tips` | 3 consejos para crear disenos (specificity, styles, preview) |
| `credit_offer` | Upsell a Premium (50 disenos/mes, 100 mockups) |

### 3.3 Template de PodClaw Newsletter

**Archivo**: `podclaw/skills/newsletter/templates/email_campaign.md`

Template markdown para campanas con campos: `{campaign_name}`, `{target_segment}`, `{locale}`, `{subject_a}`, `{subject_b}`, `{preview_text}`, `{email_html_body}`, `{cta_a}`, `{cta_b}`, metricas post-envio.

### 3.4 Design Consistency

Todos los emails transaccionales comparten:
- Header con gradient `#667eea -> #764ba2` + brand name
- Body en panel `#f9fafb`
- Cards con border `#e5e7eb`
- CTA button `#667eea`
- Footer con tagline + CAN-SPAM address
- `List-Unsubscribe` header (RFC 8058) en shipped/delivered

**Inconsistencia**: Los emails del drip system y newsletter subscribe usan estilos diferentes (mas simples, sin gradient header).

---

## 4. Newsletter System

### 4.1 Frontend Components

| Componente | Ubicacion | Funcion |
|---|---|---|
| `NewsletterSignup` | `components/landing/NewsletterSignup.tsx` | Formulario email en landing page |
| `Footer` | `components/Footer.tsx` | Incluye newsletter signup (referenciado) |

### 4.2 API Routes

| Route | Metodo | Funcion |
|---|---|---|
| `/api/newsletter/subscribe` | POST | Crear subscriber + enviar double opt-in email |
| `/api/newsletter/confirm/[token]` | GET | Confirmar email (set `confirmed_at`) |
| `/api/newsletter/unsubscribe` | POST | Desuscribir por email |
| `/api/newsletter/unsubscribe?token=X` | GET | One-click unsubscribe (RFC 8058) |
| `/api/newsletter/campaigns` | GET | Listar campanas (admin) |
| `/api/newsletter/drip-sequence-docs` | GET | Documentacion del drip post-purchase |

### 4.3 Database Tables

| Tabla | Funcion |
|---|---|
| `newsletter_subscribers` | Subscribers con `email`, `locale`, `confirmation_token`, `confirmed_at` |
| `newsletter_campaigns` | Campanas con A/B testing, segments, drip sequences |
| `drip_queue` | Cola de emails drip con `send_at`, `status`, `template` |
| `abandoned_carts` | Tracking de carritos abandonados y emails enviados |

### 4.4 Compliance

- **GDPR Double Opt-In**: Token criptografico de 32 bytes, confirmacion obligatoria antes de enviar
- **CAN-SPAM**: Direccion fisica en footer, link de unsubscribe, honor <24h
- **RFC 8058**: Headers `List-Unsubscribe` y `List-Unsubscribe-Post` en emails marketing
- **Rate Limiting**: `newsletterLimiter` (10 req/min/IP) en subscribe/unsubscribe
- **Audit Log**: Unsubscribe events logueados en `audit_log`

### 4.5 PodClaw Newsletter Agent

**Archivo**: `podclaw/agents/newsletter.py`

- **Model**: Claude Sonnet
- **Schedule**: Daily 09:00 + 17:00 UTC
- **AM Cycle**: Creacion de campanas + envios segmentados (RFM)
- **PM Cycle**: Analisis de performance + drip sequence triggers
- **Guardrails**: Max 500 emails/ciclo, CAN-SPAM obligatorio
- **Drip Sequences**: Welcome (D1/D3/D7), Post-Purchase (D7/D14), Win-Back (W1/W3/W6)
- **A/B Testing**: 2 variantes minimo, winner auto-select despues de 4 horas

---

## 5. Inbound Email — NO EXISTE

### 5.1 Estado Actual

- **No hay endpoint para recibir emails** (Resend inbound webhooks no configurados)
- **No hay MX records** configurados para recepcion de email
- **No hay parsing de emails entrantes** en ningun componente
- Los emails de contacto (`hello@skapara.com`, `support@skapara.com`) estan definidos como constantes pero **no tienen backend de recepcion**

### 5.2 Busqueda de "inbound"

Solo menciones en documentacion de auditoria (planes futuros), migraciones de messaging (WhatsApp/Telegram), y blueprints de PodClaw v2. **Cero implementacion.**

---

## 6. Customer Support Flow — Estado Actual

### 6.1 Contact Form

**Archivo**: `frontend/src/components/contact/ContactForm.tsx`

- Formulario completo con campos: name, email, subject (6 categorias), message
- Categorias: General, Technical Support, Order Issues, Product Inquiry, Partnership, Feedback
- Multilingue (en/es/de via translations)
- Posts a `/api/contact`

**BUG CRITICO**: La ruta `/api/contact` **NO EXISTE**. El ContactForm hace `POST /api/contact` pero no hay handler en `frontend/src/app/api/contact/`. Esto significa que el formulario de contacto esta **roto** en produccion -- siempre devuelve 404.

### 6.2 Contact Page

**Archivo**: `frontend/src/app/[locale]/(focused)/contact/page.tsx`

- Muestra 3 cards: Email (hello/support@skapara.com), Live Chat (referencia al AI chat), Response Time
- Incluye el ContactForm (que no funciona, ver arriba)
- SEO metadata completa

### 6.3 PodClaw Customer Manager Agent

**Archivo**: `podclaw/agents/customer_manager.py`

- **Schedule**: Daily 12:00 + 22:00 UTC + continuous (chat)
- **Funciones**: Tickets, reviews, refunds (<EUR100 auto), retention emails, satisfaction surveys
- **Tools**: supabase, resend, stripe, telegram, whatsapp, printify
- **Guardrails**: Refunds >EUR100 requieren aprobacion humana, max 100 emails/ciclo

### 6.4 Flujo de Soporte Actual (Real)

1. **AI Chat**: El asistente AI en el storefront es el canal principal de soporte
2. **Email directo**: `support@skapara.com` esta en la pagina de contacto (sin backend)
3. **Formulario de contacto**: ROTO (404)
4. **No hay ticketing system**: No hay tabla de `support_tickets` ni sistema de gestion
5. **No hay email forwarding**: Los emails a `hello@skapara.com` no llegan a ningun sistema

---

## 7. Gaps Identificados para PodClaw v2

### 7.1 CRITICOS

| # | Gap | Impacto | Solucion Propuesta |
|---|---|---|---|
| 1 | **Contact form roto (404)** | Clientes no pueden contactar soporte via web | Crear `/api/contact/route.ts` que guarde en DB + envie email a admin |
| 2 | **No hay inbound email** | Emails a support@skapara.com se pierden | Configurar Resend Inbound Webhooks |
| 3 | **No hay ticketing system** | No hay tracking de issues de clientes | Crear tabla `support_tickets` + CRUD |
| 4 | **Templates inconsistentes** | Emails del drip vs transaccionales tienen estilos diferentes | Migrar a `react-email` o centralizar layout |

### 7.2 IMPORTANTES

| # | Gap | Impacto | Solucion Propuesta |
|---|---|---|---|
| 5 | **Drip templates no localizados** | Welcome/tips/credit_offer solo en ingles | Agregar soporte i18n a los templates del drip |
| 6 | **No hay email de welcome post-registro** | Nuevo usuario no recibe email hasta 1h despues (drip) | Enviar welcome inmediato en auth callback |
| 7 | **No hay email de review de diseno** | Cuando un diseno personalizado esta listo, no se notifica | Agregar trigger en design_compositions.status='ready' |
| 8 | **Bounce handling pasivo** | `resend_get_bounce_stats` agrega de la lista, no webhooks | Configurar Resend webhooks para bounces/complaints |
| 9 | **No hay unsubscribe page** | El link de unsubscribe es una API, no una pagina amigable | Crear pagina `/unsubscribe` con confirmacion visual |
| 10 | **COMPANY_INFO hardcoded** | Direccion postal esta hardcoded en `resend.ts` | Mover a `store-config.ts` o DB |

### 7.3 NICE-TO-HAVE

| # | Gap | Impacto | Solucion Propuesta |
|---|---|---|---|
| 11 | **No hay email analytics** | No se trackean open rates ni click rates en DB | Integrar Resend webhooks de tracking |
| 12 | **No hay email preview/test** | No se puede previsualizar emails antes de enviar | Agregar ruta admin `/admin/email-preview` |
| 13 | **CAN-SPAM address inconsistente** | `resend.ts` dice Musterstrasse 1, newsletter agent dice Friedrichstrasse 123 | Unificar en una sola fuente |

---

## 8. Recomendacion: Resend Inbound Webhooks como Event Source para PodClaw

### 8.1 Arquitectura Propuesta

```
Customer sends email to support@skapara.com
    |
    v
Resend receives email (MX records configured)
    |
    v
Resend sends POST webhook to /api/webhooks/resend/inbound
    |
    v
Frontend handler:
  1. Valida webhook signature
  2. Parsea email (from, subject, body, attachments)
  3. Crea support_ticket en Supabase
  4. Emite evento a PodClaw via Bridge API
    |
    v
PodClaw Customer Manager Agent:
  1. Recibe evento de nuevo ticket
  2. Analiza contenido con AI (categoria, urgencia, sentimiento)
  3. Si es simple: responde automaticamente via resend_send
  4. Si es complejo: escala a humano + notifica via Telegram
  5. Actualiza ticket status en DB
```

### 8.2 Implementacion Requerida

1. **Resend Dashboard**: Configurar dominio inbound + webhook URL
2. **MX Records**: Agregar records MX de Resend en DNS de skapara.com
3. **Webhook handler**: `frontend/src/app/api/webhooks/resend/inbound/route.ts`
4. **DB table**: `support_tickets` con campos: id, email, subject, body, status, priority, agent_id, assigned_to, created_at, resolved_at
5. **PodClaw event**: Nuevo evento `email.inbound` en el Bridge API
6. **Customer Manager update**: Agregar handler para `email.inbound` en el agente

### 8.3 Beneficios

- **Automatizacion**: 80% de consultas respondidas sin intervencion humana
- **Tracking**: Historial completo de comunicacion con cada cliente
- **SLA**: Tiempo de respuesta medible y trackeable
- **Escalation**: Flujo claro para issues complejos
- **Multichannel**: Email + Chat + Telegram + WhatsApp unificados en un sistema

---

## 9. Mapa de Archivos Relevantes

### Frontend — Email Core
- `frontend/src/lib/resend.ts` — Resend client + 6 funciones de email transaccional
- `frontend/src/lib/email-drip.ts` — Sistema de drip sequences + triggerDripSequence()

### Frontend — API Routes
- `frontend/src/app/api/newsletter/subscribe/route.ts` — Double opt-in subscribe
- `frontend/src/app/api/newsletter/confirm/[token]/route.ts` — Confirmation endpoint
- `frontend/src/app/api/newsletter/unsubscribe/route.ts` — Unsubscribe (POST + GET/RFC 8058)
- `frontend/src/app/api/newsletter/campaigns/route.ts` — List campaigns
- `frontend/src/app/api/newsletter/drip-sequence-docs/route.ts` — Drip documentation
- `frontend/src/app/api/cron/drip/route.ts` — Cron processor para drip queue
- `frontend/src/app/api/cron/abandoned-cart-recovery/route.ts` — Cron abandoned cart emails

### Frontend — Webhook Email Triggers
- `frontend/src/lib/webhooks/stripe/checkout-completed.ts` — Order confirmation + credit purchase
- `frontend/src/lib/webhooks/stripe/shared.ts` — sendOrderIssueEmail
- `frontend/src/lib/webhooks/stripe/invoice-handlers.ts` — Payment failed email
- `frontend/src/lib/pod/webhooks/handlers/order-shipped.ts` — Shipped email
- `frontend/src/lib/pod/webhooks/handlers/order-delivered.ts` — Delivered email
- `frontend/src/lib/pod/webhooks/handlers/order-cancelled.ts` — Cancelled + refund email
- `frontend/src/lib/pod/webhooks/handlers/order-failed.ts` — Failed + refund email

### Frontend — UI Components
- `frontend/src/components/landing/NewsletterSignup.tsx` — Landing page newsletter form
- `frontend/src/components/contact/ContactForm.tsx` — Contact form (ROTO: /api/contact no existe)
- `frontend/src/app/[locale]/(focused)/contact/page.tsx` — Contact page
- `frontend/src/app/api/profile/delete/route.ts` — Account deletion email

### PodClaw — Agents & Connectors
- `podclaw/connectors/resend_connector.py` — Resend MCP connector (4 tools)
- `podclaw/agents/newsletter.py` — Newsletter agent
- `podclaw/agents/customer_manager.py` — Customer manager agent
- `podclaw/agents/marketing.py` — Marketing agent
- `podclaw/skills/newsletter/SKILL.md` — Newsletter skill definition
- `podclaw/skills/newsletter/templates/email_campaign.md` — Campaign template
- `podclaw/skills/customer_manager/SKILL.md` — Customer manager skill
- `podclaw/skills/marketing/SKILL.md` — Marketing skill

### Scripts
- `scripts/test-email-notification.mjs` — Test script for email notifications
- `scripts/test-email-notification-final.mjs` — Final version

### Migrations
- `supabase/migrations/20260215100000_marketing_newsletter_tables.sql`
- `supabase/migrations/20260224023857_add_newsletter_confirmation_columns.sql`
- `supabase/migrations/20260307100900_rls_policy_newsletter_subscribers_service_role.sql`

---

## 10. Resumen Ejecutivo

| Dimension | Estado | Score |
|---|---|---|
| **Outbound transaccional** | Completo (6 emails lifecycle + 3 operacionales) | 9/10 |
| **Newsletter system** | Funcional (double opt-in, GDPR, CAN-SPAM) | 8/10 |
| **Drip sequences** | Basico (welcome 3-step, abandoned cart 2-step) | 6/10 |
| **PodClaw email agents** | Definidos pero no validados en produccion | 5/10 |
| **Inbound email** | NO EXISTE | 0/10 |
| **Customer support email** | Contact form ROTO, no hay ticketing | 1/10 |
| **Template consistency** | Inconsistente entre transaccional y drip | 4/10 |
| **Email analytics** | Solo via Resend dashboard, no en DB | 3/10 |

**Prioridad 1**: Arreglar contact form (crear `/api/contact/route.ts`)
**Prioridad 2**: Implementar Resend Inbound Webhooks para `support@skapara.com`
**Prioridad 3**: Crear sistema de ticketing (`support_tickets` table)
**Prioridad 4**: Unificar templates de email (consistencia visual)
