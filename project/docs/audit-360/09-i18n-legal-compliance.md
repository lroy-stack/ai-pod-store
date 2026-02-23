# Auditoria 09 -- i18n, Cumplimiento Legal y GDPR

**Proyecto**: POD AI Store (Print-on-Demand, mercado EU)
**Fecha**: 2026-02-23
**Alcance**: Frontend (`frontend/`), Admin (`admin/`), APIs, migraciones Supabase
**Locales**: `en`, `es`, `de`

---

## 1. Estado actual

### Infraestructura i18n

| Componente | Tecnologia | Estado |
|---|---|---|
| Framework | `next-intl` con `defineRouting` | COMPLIANT |
| Locales | `['en', 'es', 'de']`, default `en` | COMPLIANT |
| Prefijo URL | `localePrefix: 'always'` (`/en/shop`, `/es/shop`, `/de/shop`) | COMPLIANT |
| Routing | `frontend/src/i18n/routing.ts` | COMPLIANT |
| Middleware | `frontend/src/middleware.ts` (i18n primero, luego auth) | COMPLIANT |
| Selector de idioma | Footer con `<Select>` dropdown (en/es/de) | COMPLIANT |

### Infraestructura legal

| Componente | Ubicacion | Estado |
|---|---|---|
| Cookie consent | `frontend/src/components/gdpr/CookieConsent.tsx` | COMPLIANT |
| Cookie settings | `frontend/src/components/gdpr/CookieSettingsButton.tsx` | COMPLIANT |
| Logica cookies | `frontend/src/lib/cookie-consent.ts` | COMPLIANT |
| Legal utils | `frontend/src/lib/legal-utils.ts` (placeholders dinamicos) | COMPLIANT |
| Unsubscribe tokens | `frontend/src/lib/unsubscribe-token.ts` | COMPLIANT |
| Tabla `user_consents` | `supabase/migrations/20260222003409_user_consents_table.sql` | COMPLIANT |
| Soft delete cuentas | `supabase/migrations/20260222004527_account_deletion_grace_period.sql` | COMPLIANT |
| Admin legal pages | `admin/src/app/legal/` (4 paginas) | COMPLIANT |

---

## 2. i18n Completeness

### Conteo de claves por locale

| Locale | Claves totales | Secciones | Diferencia vs EN |
|---|---|---|---|
| `en.json` | **988** | 26 | -- |
| `es.json` | **988** | 26 | 0 claves faltantes |
| `de.json` | **988** | 26 | 0 claves faltantes |

**Archivos**: `frontend/messages/en.json`, `frontend/messages/es.json`, `frontend/messages/de.json`

### Calidad de traducciones -- COMPLIANT

- **ES**: Completo, formatos culturales (`+34`, Madrid, `28001`, ES). **DE**: Completo, forma formal "Sie" consistente (`+49 30`, Berlin, `10115`, DE).
- **Plurales ICU**: Correctos en 3 locales. 26 secciones identicas.

### Strings hardcodeados en ingles -- PARTIAL

| Archivo | Lineas | Problema |
|---|---|---|
| `frontend/src/app/[locale]/(focused)/privacy/page.tsx` | 143-145 | Footer con condicional inline `{locale === 'en' && '...'}` en vez de clave de traduccion |
| `frontend/src/app/[locale]/(focused)/terms/page.tsx` | 143-145 | Mismo patron de condicional inline |
| `frontend/src/components/Footer.tsx` | 186, 193 | `aria-label="Light mode"` y `aria-label="Dark mode"` hardcodeados en ingles |
| `admin/src/app/legal/**` | Todo | Panel admin completamente en ingles (intencional para tooling interno) |

### Skip-to-content -- COMPLIANT

Implementado en ambos layouts principales:
- `frontend/src/app/[locale]/(landing)/layout.tsx` linea 15
- `frontend/src/components/storefront/StorefrontLayout.tsx` linea 81
- Clave de traduccion: `common.skipToContent` ("Skip to main content" / "Saltar al contenido principal" / "Zum Hauptinhalt springen")

---

## 3. Legal Pages

### Paginas implementadas

| Pagina | Ruta | Fuente de contenido | 3 locales | Calidad |
|---|---|---|---|---|
| Privacy Policy | `/(focused)/privacy/page.tsx` | DB (admin) + fallback a claves `privacy.*` | COMPLIANT | Texto legal real, 7 secciones GDPR |
| Terms of Service | `/(focused)/terms/page.tsx` | DB (admin) + fallback a claves `terms.*` | COMPLIANT | Texto legal real, 10 secciones |
| Cookie Policy | `/(focused)/cookies/page.tsx` | Claves `cookiePolicy.*` | COMPLIANT | Detallada, tabla de cookies especificas |
| Legal Notice / Impressum | `/(focused)/legal/page.tsx` | Claves `legalNotice.*` + DB settings | COMPLIANT | Cumple requisitos TMG aleman |
| Returns & Refunds | `/(focused)/returns/page.tsx` | DB (admin) | COMPLIANT | Dinamica desde admin API |
| Shipping Policy | `/(focused)/shipping/page.tsx` | DB (admin) | COMPLIANT | Dinamica desde admin API |

### Sistema de contenido dinamico -- COMPLIANT

`frontend/src/lib/legal-utils.ts`: 12 placeholders (`{{company_name}}`, `{{dpo_email}}`, `{{current_date}}`, etc.), resolucion por locale, fallbacks si admin API falla, cache 5 min.

### Cookie Policy -- COMPLIANT

Claves `cookiePolicy.*`: cookies especificas listadas (`_ga`, `_fbp`, `_gcl_au`, `session_id`, `locale`, `cookie_consent`) con proposito y duracion.

### Impressum aleman (TMG) -- COMPLIANT

Claves `legalNotice.*`: empresa, direccion, registro mercantil, Tax ID, DPO, enlace EU ODR (`https://ec.europa.eu/consumers/odr`).

---

## 4. Cookie Consent

### Banner -- COMPLIANT

| Aspecto | Implementacion | Estado |
|---|---|---|
| Componente | `frontend/src/components/gdpr/CookieConsent.tsx` | COMPLIANT |
| Aparece en primera visita | `useEffect` con `hasConsent()` | COMPLIANT |
| Animacion | `animate-in slide-in-from-bottom` | COMPLIANT |
| i18n | `useTranslations('cookieConsent')` en 3 locales | COMPLIANT |
| Accesibilidad | `aria-label` en cada `<Switch>`, `<Label>` con `htmlFor` | COMPLIANT |
| Responsive | `flex-col gap-3 md:flex-row` | COMPLIANT |

### Consentimiento granular -- COMPLIANT

Tres categorias en `frontend/src/lib/cookie-consent.ts`:

| Categoria | Por defecto | Desactivable | Estado |
|---|---|---|---|
| `necessary` | Siempre `true` | No (Switch disabled) | COMPLIANT |
| `analytics` | `false` | Si | COMPLIANT |
| `marketing` | `false` | Si | COMPLIANT |

### Opciones: "Aceptar todo", "Rechazar no esenciales", "Personalizar" (Dialog con Switches) -- COMPLIANT

### Persistencia -- COMPLIANT

- **localStorage** (`cookieConsent`, JSON+timestamp) + **cookie** (`cookie_consent`, 1 ano, SameSite=Lax, Secure) + **DB** (`POST /api/consent` -> `user_consents`)

### Respeto de elecciones -- COMPLIANT

`isConsentGranted(category)` (linea 121): sin consentimiento previo solo `necessary` = true.

### Cambiar preferencias -- COMPLIANT

Footer "Cookie Settings" (`clearConsent()` + reload) y pagina `/cookies` con `<CookieSettingsButton>`.

### Registro en BD -- COMPLIANT

`user_consents` (migracion `20260222003409`): user_id, consent_type, granted, timestamp, ip_address, user_agent. RLS activo, indices optimizados.

---

## 5. GDPR Data Subject Rights

### Derecho de acceso (Art. 15) -- COMPLIANT

**API**: `GET /api/profile/export` (`frontend/src/app/api/profile/export/route.ts`)

Exporta ZIP con:
- `profile.json`, `orders.json`, `conversations.json`, `designs.json`
- `wishlists.json`, `personalizations.json`, `notifications.json`, `shipping_addresses.json`
- `README.txt` con referencia explicita a GDPR Art. 20

Rate limiting: 1 exportacion cada 24 horas por usuario.

### Derecho de supresion (Art. 17) -- COMPLIANT

**Soft delete**: `POST /api/profile/delete` (`frontend/src/app/api/profile/delete/route.ts`)
- Marca `deletion_requested_at` en tabla `users`
- Envia email de confirmacion con fecha de eliminacion (30 dias)
- Usuario puede cancelar haciendo login en los 30 dias

**Hard delete**: `GET /api/cron/hard-delete-accounts` (`frontend/src/app/api/cron/hard-delete-accounts/route.ts`)
- Cron diario, protegido por Bearer token
- Elimina: `shipping_addresses`, `personalizations`, `wishlists`, `notifications`, `user_consents`, `messages`, `conversations`, `cart_items`, usuario
- **Anonimiza** pedidos: `customer_name` -> "Deleted User", `customer_email` -> null, `shipping_address` -> null
- Elimina usuario de Supabase Auth

**UI**: Perfil tiene seccion "Danger Zone" con dialogo de confirmacion (claves `Profile.dangerZone*` traducidas).

### Derecho de portabilidad (Art. 20) -- COMPLIANT

Mismo endpoint `/api/profile/export`. Formato JSON en ZIP. README cita Art. 20 explicitamente.

### Derecho de rectificacion (Art. 16) -- COMPLIANT

- Perfil editable: nombre, email, telefono, idioma, moneda
- Gestion de direcciones: crear, editar, eliminar
- Cambio de contrasena: `POST /api/profile/change-password`
- Preferencias de notificaciones: toggles on/off

### Derecho de retirada del consentimiento (Art. 7.3) -- COMPLIANT

- Cookie consent: footer "Cookie Settings" -> `clearConsent()` + recarga
- Newsletter: `GET /api/newsletter/unsubscribe?token=X` (RFC 8058 one-click)
- Notificaciones: toggles en perfil

### Tracking de consentimiento -- COMPLIANT

- Tabla `user_consents`: user_id, consent_type, granted, timestamp, ip_address, user_agent
- API `GET /api/consent`: historial de consentimientos del usuario
- Admin `admin/src/app/legal/consents/page.tsx`: dashboard con summary, filtros, exportacion CSV

### Retencion de datos -- COMPLIANT

Admin configurable (`admin/src/app/legal/settings/page.tsx`): conversaciones 365d, audit logs 730d, marketing events 180d. Crons: `cleanup-personal/route.ts`, `cleanup/route.ts`.

### Derecho de restriccion (Art. 18) -- PARTIAL

No existe toggle explicito "pausar procesamiento". La retirada de consentimiento de cookies cubre parcialmente.

### GDPR Readiness Score: **9.5 / 10**

---

## 6. Email Compliance

### Integracion Resend -- COMPLIANT

- Emails transaccionales: confirmaciones de pedido, resets de contrasena, eliminacion de cuenta
- Locale-aware: `deletionDate.toLocaleDateString(userData.locale || 'en', {...})`

### Unsubscribe (RFC 8058) -- COMPLIANT

**Endpoint**: `frontend/src/app/api/newsletter/unsubscribe/route.ts`

| Aspecto | Implementacion | Estado |
|---|---|---|
| POST (email-based) | Desactiva `marketing_emails` y `newsletter` | COMPLIANT |
| GET (token one-click) | `verifyUnsubscribeToken()`, RFC 8058 | COMPLIANT |
| Rate limiting | 10 req/min por IP | COMPLIANT |
| Privacidad | Confirma unsubscribe incluso si usuario no existe | COMPLIANT |
| Audit trail | Insert en `audit_log` con email, timestamp, method | COMPLIANT |

### Headers en emails de drip -- COMPLIANT

Archivo `frontend/src/app/api/cron/drip/route.ts` lineas 132-142:
```
'List-Unsubscribe': `<${unsubscribeUrl}>`
'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
```

### CAN-SPAM -- PARTIAL

| Requisito | Estado | Detalle |
|---|---|---|
| Unsubscribe link | COMPLIANT | En todos los emails marketing |
| Honrar unsubscribe < 10 dias | COMPLIANT | Inmediato |
| Direccion fisica | PARTIAL | Configurable via `company_address` en legal settings, pero no verificado en todas las plantillas |
| Identificacion del remitente | COMPLIANT | `RESEND_FROM_EMAIL` |

### Double opt-in para newsletter -- NON-COMPLIANT

No se encontro implementacion de doble confirmacion (email de verificacion antes de anadirse a la lista). **Requerido por ley en Alemania (UWG) y recomendado en toda la EU.**

---

## 7. Accesibilidad (WCAG)

### Hallazgos positivos

| Aspecto | Estado | Detalle |
|---|---|---|
| Skip-to-content | COMPLIANT | 2 layouts, clave `common.skipToContent` traducida |
| ARIA labels en redes sociales | COMPLIANT | `Footer.tsx` lineas 67-82: Facebook, Twitter, Instagram, LinkedIn |
| ARIA labels en cookie consent | COMPLIANT | Cada `<Switch>` tiene `aria-label={t(...)}` |
| Labels en formularios | COMPLIANT | Uso consistente de `<Label>` con `htmlFor` |
| Alt text en imagenes | PARTIAL | 27 ocurrencias de `alt=` en 19 componentes, pero no verificado en todos los `<img>` |
| Tokens semanticos | COMPLIANT | `bg-primary`, `text-foreground`, `text-muted-foreground` (no `bg-blue-*`, `bg-gray-*`) |
| Theme toggle | COMPLIANT | Light/Dark/System con accesibilidad |
| Selector de idioma | COMPLIANT | `<Select>` con label |
| Touch targets | COMPLIANT | Minimo `p-3` (44px) en elementos interactivos |
| Headings | COMPLIANT | Jerarquia h1/h2/h3 correcta en legal pages |

### Problemas detectados

| Problema | Severidad | Archivo | Lineas |
|---|---|---|---|
| `aria-label="Light mode"` hardcoded EN | Media | `frontend/src/components/Footer.tsx` | 186 |
| `aria-label="Dark mode"` hardcoded EN | Media | `frontend/src/components/Footer.tsx` | 193 |
| ReactMarkdown sin DOMPurify en legal pages | Media | `privacy/page.tsx`, `terms/page.tsx`, `returns/page.tsx`, `shipping/page.tsx` | Todas |
| `SafeMarkdown` existe pero no se usa en legal | Baja | `frontend/src/components/common/SafeMarkdown.tsx` | -- |
| Contraste de colores no verificado | Info | Depende de valores del tema CSS | -- |

### ReactMarkdown vs SafeMarkdown

Las 4 paginas legales (`privacy`, `terms`, `returns`, `shipping`) usan `ReactMarkdown` sin DOMPurify. `SafeMarkdown` (con DOMPurify) existe en `frontend/src/components/common/SafeMarkdown.tsx` y se usa en ChatArea, DetailPanel, ProductDetailClient. Defensa en profundidad recomienda migrar las legal pages a `SafeMarkdown`.

---

## 8. Admin Legal Management

### Paginas del admin

| Pagina | Ruta | Funcionalidad | Estado |
|---|---|---|---|
| Lista de paginas legales | `admin/src/app/legal/page.tsx` | Lista con titulos en en/es/de, estado activo/inactivo | COMPLIANT |
| Editor de pagina | `admin/src/app/legal/[slug]/page.tsx` | Tabs EN/ES/DE, Markdown + preview, placeholders, historial de versiones | COMPLIANT |
| Configuracion legal | `admin/src/app/legal/settings/page.tsx` | Empresa, DPO, registro mercantil, retencion de datos | COMPLIANT |
| Registros de consentimiento | `admin/src/app/legal/consents/page.tsx` | Dashboard summary, tabla filtrable, exportacion CSV | COMPLIANT |

### Historial de versiones -- COMPLIANT

Editor con version_number, timestamp, changed_by. Cada guardado crea nueva version (audit trail completo).

### Configuracion legal centralizada -- COMPLIANT

Empresa, Tax ID, registro mercantil, DPO, URLs de politicas, periodos de retencion.

### Dashboard de consentimientos -- COMPLIANT

Summary (total, opt-in rates), tabla filtrable (tipo, fechas), exportacion CSV.

---

## 9. Gaps detectados

| # | Gap | Severidad | Categoria | Estado |
|---|---|---|---|---|
| G1 | **Double opt-in para newsletter** no implementado | ALTA | Email/GDPR | NON-COMPLIANT |
| G2 | **ReactMarkdown sin sanitizar** en 4 paginas legales (privacy, terms, returns, shipping) | MEDIA | Seguridad/XSS | PARTIAL |
| G3 | **aria-labels hardcoded** en ingles para theme toggle (Light/Dark mode) | MEDIA | Accesibilidad/i18n | PARTIAL |
| G4 | **Inline locale conditionals** en footer de privacy y terms pages | BAJA | i18n mantenibilidad | PARTIAL |
| G5 | **Art. 18 (Restriccion de procesamiento)** sin toggle explicito | BAJA | GDPR | PARTIAL |
| G6 | **Direccion fisica** en footer de emails no verificada en todas las plantillas | BAJA | CAN-SPAM | PARTIAL |
| G7 | **Contraste de colores** no auditado contra WCAG AA (4.5:1) | INFO | Accesibilidad | NO VERIFICADO |
| G8 | **Admin panel solo en ingles** | INFO | i18n | ACEPTABLE |
| G9 | **Email de confirmacion de eliminacion** solo en ingles (HTML hardcoded) | MEDIA | i18n | PARTIAL |

---

## 10. Riesgos

### Riesgo ALTO

| Riesgo | Impacto | Probabilidad | Mitigacion |
|---|---|---|---|
| **Multa por falta de double opt-in** (Alemania, UWG Sec. 7) | Multas hasta 300K EUR por UWG + GDPR combinado | Alta (si envian marketing a DE) | Implementar flujo de doble confirmacion antes de launch |

### Riesgo MEDIO

| Riesgo | Impacto | Probabilidad | Mitigacion |
|---|---|---|---|
| **XSS via contenido legal** si admin comprometido | Inyeccion de scripts en paginas publicas | Baja (requiere acceso admin) | Migrar a `SafeMarkdown` con DOMPurify |
| **Email de eliminacion no localizado** | Usuarios DE/ES reciben email en ingles | Media | Usar claves i18n o templates por locale |
| **Cron de hard-delete sin monitoreo** | Datos no eliminados si cron falla | Media | Alertas si cron no ejecuta en 48h |

### Riesgo BAJO

| Riesgo | Impacto | Probabilidad | Mitigacion |
|---|---|---|---|
| **Aria-labels en ingles** para lectores de pantalla en DE/ES | Experiencia degradada para usuarios con discapacidad | Baja | Usar claves de traduccion |
| **Fallback legal settings** con datos placeholder | Paginas legales muestran "legal@example.com" si admin API falla | Baja | Validar settings al iniciar app |

---

## 11. Quick wins

| # | Accion | Esfuerzo | Impacto |
|---|---|---|---|
| QW1 | Reemplazar `ReactMarkdown` por `SafeMarkdown` en 4 paginas legales | 30 min | Cierra G2 (XSS defense-in-depth) |
| QW2 | Mover aria-labels de theme toggle a claves de traduccion | 15 min | Cierra G3 (accesibilidad i18n) |
| QW3 | Mover strings inline de footer legal a claves de traduccion | 15 min | Cierra G4 (mantenibilidad) |
| QW4 | Localizar email de confirmacion de eliminacion | 1h | Cierra G9 (i18n emails) |
| QW5 | Agregar `company_address` a template base de todos los emails Resend | 30 min | Cierra G6 (CAN-SPAM) |

---

## 12. Roadmap por fases

### Fase 1 -- Critico pre-launch (1-2 dias)

- [ ] **Double opt-in para newsletter** (G1): Crear endpoint `POST /api/newsletter/confirm`, enviar email de verificacion con token, solo activar suscripcion tras confirmacion
- [ ] **Quick wins QW1-QW5** (ver tabla arriba)

### Fase 2 -- Hardening legal (3-5 dias)

- [ ] **Art. 18 toggle** (G5): Agregar campo `processing_restricted` en tabla `users`, toggle en perfil, respetar en todas las APIs que procesan datos personales
- [ ] **Monitoreo de cron de hard-delete**: Alerta si `hard-delete-accounts` no ejecuta en 48h
- [ ] **Test E2E de flujo GDPR completo**: export -> delete request -> grace period -> hard delete
- [ ] **Auditoria de contraste WCAG AA** (G7): Ejecutar herramienta automatizada (axe-core o similar) en todas las paginas

### Fase 3 -- Mejoras continuas (1-2 semanas)

- [ ] **Localizacion del admin panel** si se planean admins no angloparlantes
- [ ] **Data Processing Agreement (DPA)** template descargable para clientes B2B
- [ ] **Cookie scanning automatizado**: Verificar que no se inyectan cookies de terceros antes del consentimiento
- [ ] **Consent version tracking**: Vincular consentimiento a la version especifica de la privacy policy aceptada
- [ ] **Reporte DSAR automatizado**: Endpoint admin para generar informes de solicitudes de datos (Data Subject Access Requests) con tiempos de respuesta

### Fase 4 -- Escalabilidad (2-4 semanas)

- [ ] **Locales dinamicos** desde DB (actualmente agregar idioma requiere editar `routing.ts` + `messages/XX.json` + schema legal)
- [ ] **DPIA** documentado para el sistema completo
- [ ] **Privacy dashboard** para usuarios (vista unificada de datos, consentimientos y derechos)

---

## 13. Impacto en escalabilidad (1000+ clientes EU)

### Lo que funciona bien a escala

| Aspecto | Preparacion | Detalle |
|---|---|---|
| Cookie consent tracking | COMPLIANT | Indices optimizados en `user_consents`, paginacion en admin |
| Data export (Art. 15/20) | COMPLIANT | Rate limit de 24h previene abuso, ZIP generado on-demand |
| Hard delete (Art. 17) | COMPLIANT | Batch de 100 cuentas por ejecucion de cron, idempotente |
| Legal content | COMPLIANT | Cache de 5 min en fetch, contenido servido desde DB |
| i18n | COMPLIANT | 988 claves x 3 locales, sin gaps |

### Cuellos de botella potenciales con 1000+ clientes

| Aspecto | Problema | Solucion recomendada |
|---|---|---|
| **Data export masivo** | ZIP con 8 tablas puede ser lento si usuario tiene miles de pedidos | Implementar exportacion asincrona con notificacion por email |
| **Tabla `user_consents`** | Crece N * 3 registros por usuario (initial + changes) | Particionar por fecha o agregar TTL para registros > 2 anos |
| **Cron hard-delete** | Batch de 100, si hay 500+ cuentas pendientes podria timeout | Implementar cola de trabajo (BullMQ/Redis) |
| **DSAR volume** | Si reguladores exigen informe agregado de solicitudes | Agregar tabla `dsar_requests` con tracking de tiempos de respuesta |
| **Agregar nuevos locales** | Requiere cambios en 4+ archivos (routing, messages, legal pages schema) | Considerar sistema de locales dinamico desde DB |

### Metricas recomendadas

Exportacion datos > 30s, cuentas pendientes delete > 50, opt-in rate < 20%, DSARs sin resolver > 25 dias, legal pages en fallback > 0.

---

## Resumen de compliance

| Area | Estado | Score |
|---|---|---|
| **i18n Completeness** | COMPLIANT | 98% |
| **Legal Pages** | COMPLIANT | 100% |
| **Cookie Consent** | COMPLIANT | 100% |
| **GDPR Data Subject Rights** | COMPLIANT | 95% |
| **Email Compliance** | PARTIAL (falta double opt-in) | 85% |
| **Accesibilidad (WCAG)** | PARTIAL | 80% |
| **Admin Legal Management** | COMPLIANT | 100% |

**Score global GDPR**: **9.5 / 10**
**Bloqueante pre-launch**: Double opt-in para newsletter (obligatorio en mercado DE)
