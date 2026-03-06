# /admin Feature Proposal — Experiencia Completa de Gestión POD

> Cruce del inventario real del admin (72 API routes, 27+ páginas, 26 componentes shadcn/ui) con mejores prácticas de Shopify Polaris, Medusa Admin, Retool, y patrones documentados de e-commerce POD.
>
> **Principio**: Gestiones de terceros (Stripe dashboard, Printful product creation) permanecen externas. Mejoramos **observabilidad** de esos sistemas.

---

## Estado actual — Lo que YA existe

### Infraestructura UX (sólida)
- Command Palette (Cmd+K) con navegación + búsqueda global + acciones rápidas
- Keyboard shortcuts (j/k navegación, ? ayuda)
- Dark mode / theme editor (OKLCH color picker)
- Activity Feed (timeline de eventos recientes)
- Sidebar colapsable con secciones (Operations, Content, AI & Agents, Marketing, System)
- Mobile sidebar (Sheet drawer)
- Breadcrumbs
- SSE provider (real-time server-sent events)
- React Query (caching 30s, dedup)
- Toast notifications (sonner)
- Error boundary
- 26 componentes shadcn/ui

### Páginas funcionales
| Módulo | Página | Datos reales | Search | Filter | Pagination | Bulk | Mobile |
|---|---|---|---|---|---|---|---|
| Dashboard | / | Sí (recharts, stats cards, activity feed) | — | — | — | — | Sí |
| Products | /products | Sí | Sí | Status/Category | Sí | Publish/Archive | Card view |
| Orders | /orders | Sí | Sí | Status tabs | Sí | Ship/Deliver/Cancel | Card view |
| Customers | /customers | Sí | Sí | — | Sí | — | Button cards |
| Returns | /returns | Sí | — | Tab status | — | — | Cards |
| Designs | /designs | Sí | — | Tab status | Sí | — | Grid |
| Reviews | /reviews | Sí | — | Status dropdown | Sí | — | Cards |
| Categories | /categories | Sí | — | Active/Inactive tabs | — | — | — |
| Analytics | /analytics | Sí | — | — | — | CSV export | — |
| Blog | /blog | Sí | — | — | — | CRUD | — |
| Agent | /agent/* (7 sub-pages) | Sí (Bridge API) | — | — | — | — | — |
| Tenants | /tenants | Sí | — | — | — | CRUD | — |
| Settings | /settings | Sí | — | — | — | — | — |
| Legal | /legal, /legal/[slug] | Sí | — | — | — | — | — |
| Translations | /translations | Sí | — | — | — | Auto-translate | — |
| SEO | /seo | Sí | — | — | — | — | — |
| Messaging | /messaging | Sí | — | — | — | — | — |
| Branding | /branding | Sí | — | — | — | — | — |
| Monitoring | /monitoring | Sí | — | — | — | — | — |
| Audit | /audit | Sí | — | Filters | — | — | — |
| A/B Tests | /ab-tests | Sí | — | — | — | Start/Stop | — |

### Librerías instaladas
- `@tanstack/react-table` v8.21.3 (instalada pero NO usada — tables usan shadcn/ui Table crudo)
- `@tanstack/react-query` v5.75.5
- `recharts` v2.15.3
- `sonner` v2.0.3
- `xlsx` v0.18.5 (export)
- `mermaid` v11.12.3
- `stripe` v20.3.1
- `zod` v4.3.6
- `pino` v10.3.1
- `iron-session` v8.0.4

---

## Propuesta de Features — Organizadas por Módulo

### Leyenda de prioridad
- **P0**: Bloquea operación diaria o es riesgo legal/seguridad
- **P1**: Impacto alto en eficiencia operativa
- **P2**: Mejora calidad y experiencia
- **P3**: Nice-to-have, polish

---

### M1. Seguridad & Auth (P0)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M1.1 | **Auth unificada en todas las rutas** | 39 sin auth + 12 forgeable | Migrar TODAS las rutas a `withAuth()` / `withPermission()`. Eliminar `JSON.parse(cookie)` |
| M1.2 | **RBAC granular** | Existe pero sin usar | Roles: `super_admin`, `admin`, `editor`, `viewer`. Permisos por `resource:action` |
| M1.3 | **SESSION_SECRET sin fallback** | Fallback hardcoded | Eliminar fallback en producción — forzar variable de entorno |
| M1.4 | **Audit trail en writes** | Tabla `audit_log` existe | Cada operación de escritura crea entrada: who, what, when, old_value, new_value |

---

### M2. Data Tables — Componente Reutilizable (P1)

`@tanstack/react-table` ya está instalada pero NO se usa. Todas las tablas usan `<Table>` crudo de shadcn/ui.

| # | Feature | Detalle |
|---|---|---|
| M2.1 | **`<DataTable>` component reutilizable** | Wrapper de TanStack Table: sorting, filtering, pagination, column visibility, row selection, sticky headers |
| M2.2 | **Column visibility toggle** | Botón "Columns" — admin elige qué columnas ver, persiste en localStorage |
| M2.3 | **Saved views** | Guardar combinaciones filter+sort como vistas nombradas ("Pending EU Orders", "Low Margin Products") |
| M2.4 | **Inline cell editing** | Click en celda → editar → save automático (para precio, status, título) |
| M2.5 | **Responsive card fallback** | Patrón Orders (table desktop, cards mobile) aplicado uniformemente a TODAS las tablas |
| M2.6 | **Data export universal** | Botón "Export" en cada tabla: CSV, Excel (xlsx ya instalado) |
| M2.7 | **Empty states diseñados** | Cada tabla vacía muestra ilustración + call-to-action contextual |

**Aplicar a**: Products, Orders, Customers, Designs, Reviews, Blog, Tenants, Audit, Returns

---

### M3. Observabilidad — Provider & System Health (P1)

**Principio**: No gestionamos Printful/Stripe/Supabase desde admin. Solo surfaceamos su estado.

| # | Feature | Detalle |
|---|---|---|
| M3.1 | **System health dashboard** | Panel con semáforo: Printful API, Stripe API, Supabase, Redis, PodClaw. Polling 30s vía React Query |
| M3.2 | **Webhook event log** | Lista scrollable de webhooks entrantes (Stripe, Printful): timestamp, type, status, payload preview expandible |
| M3.3 | **Cron job monitor** | Lista de crons: `sync-pod`, `abandoned-cart`, `drip`, `cleanup`, `retry-orders`. Last run, next run, status (success/failed/running), duración |
| M3.4 | **Sync status por producto** | Badge en cada producto: "Synced" (verde), "Pending" (amarillo), "Error" (rojo), "Not Published" (gris) |
| M3.5 | **Provider response times** | Sparkline de latencia P50/P95 para Printful/Stripe/Supabase (últimas 24h) |
| M3.6 | **Printful product link** | Link directo al dashboard de Printful para cada producto sincronizado |
| M3.7 | **Data integrity checks** | Checks automáticos: productos sin imágenes, variantes sin precio, órdenes sin items, diseños sin producto |

---

### M4. Orders — Mejoras (P1)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M4.1 | **Order timeline** | MISSING | Cronología visual por orden: created → paid → sent to provider → in production → shipped → delivered. Usa datos de webhooks Printful |
| M4.2 | **Order notes internas** | MISSING | Notas admin-only por orden para comunicación de equipo |
| M4.3 | **Fulfillment tracking board** | MISSING | Vista Kanban: Received → In Production → Shipped → Delivered. Agrupado por proveedor |
| M4.4 | **Fraud indicators** | MISSING | Flags: billing/shipping mismatch, high-risk countries, múltiples pagos fallidos |
| M4.5 | **Shipping label viewer** | MISSING | Link a etiqueta de envío de Printful |
| M4.6 | **Invoice / packing slip PDF** | MISSING | Generar PDF descargable por orden |

---

### M5. Products — Mejoras (P1)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M5.1 | **Product detail mejorado** | Parcial | Tabs: General, Variants, Images, SEO, GPSR. Contextual Save Bar (sticky) |
| M5.2 | **Variant matrix visual** | MISSING | Grid color × size con precio/stock por celda. Edición inline |
| M5.3 | **Product image gallery** | MISSING | Reordenar imágenes (drag&drop), set primary, bulk upload, preview mockups |
| M5.4 | **Price bulk editor** | MISSING | Vista spreadsheet para editar precios de múltiples productos/variantes |
| M5.5 | **Product health scorecard** | MISSING | Por producto: views, conversion rate, revenue, margin, return rate, rating — todo en una card |
| M5.6 | **Product duplication** | MISSING | Clonar producto como punto de partida |
| M5.7 | **GPSR compliance dashboard** | MISSING | Status de compliance por producto: compliant/missing fields. Bulk GPSR editor |
| M5.8 | **Margin calculator real** | MISSING | Retail price - base cost (Printful) - shipping - Stripe fee = margin. Alert si <35% |

---

### M6. Customers — Mejoras (P1)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M6.1 | **Customer detail page** | Solo modal básico | Full profile page: órdenes, spend total, RFM segment, wishlist, account status, communication log |
| M6.2 | **Customer tags/labels** | MISSING | Tags manuales: VIP, wholesale, influencer. Filtrar por tags |
| M6.3 | **CLV (Customer Lifetime Value)** | MISSING | CLV calculado, CLV trend, CLV por fuente de adquisición |
| M6.4 | **Customer export** | MISSING | Export CSV con filtros aplicados |
| M6.5 | **Account actions** | MISSING | Disable account, reset password link |

---

### M7. Designs — Gestión End-to-End (P1)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M7.1 | **Thumbnails 300px** | MISSING (carga full-size 2-6MB) | Auto-generate on upload, reducir carga de grid de 500MB→~15MB |
| M7.2 | **Design-to-product mapping** | MISSING (0/80 vinculados) | Ver qué diseños se usan en qué productos. Detectar huérfanos |
| M7.3 | **Design asset browser** | MISSING | Navegar bucket `designs/` con estructura de carpetas, preview, metadata |
| M7.4 | **Tags/categorías para diseños** | MISSING | Agrupar por tema (animals, Easter, feminist, groovy) |
| M7.5 | **Bulk actions** | MISSING | Approve/reject/delete en masa con checkboxes |
| M7.6 | **Filtros avanzados** | MISSING | Por modelo (gemini/fal/sourced), estilo, dimensiones, con/sin fondo |
| M7.7 | **Uploader directo** | MISSING | Subir diseños desde admin sin pasar por frontend |
| M7.8 | **Mockup generation status** | MISSING | Qué productos tienen mockups, cuáles pending, cuáles fallaron |

---

### M8. Analytics & Finance — Mejoras (P2)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M8.1 | **Revenue by geography** | MISSING | Revenue y órdenes por país/región (de Stripe billing address) |
| M8.2 | **Cohort retention** | MISSING | % de clientes del mes X que regresan en X+1, X+2 |
| M8.3 | **Abandoned cart analytics** | MISSING | Recovery rate, recovery revenue, top abandoned products |
| M8.4 | **Shipping & fulfillment metrics** | MISSING | Avg fulfillment time, on-time %, shipping cost vs paid, returns rate |
| M8.5 | **Comparison periods** | MISSING | This week vs last week, this month vs last month en cualquier métrica |
| M8.6 | **Custom date range** | MISSING | Selector de rango de fechas global para todas las analytics |
| M8.7 | **Real-time sales ticker** | MISSING | Feed SSE: "Order #X placed — Product Y — EUR Z" |
| M8.8 | **Stripe payment health** | MISSING | Success rate, failed payment log con reason codes, dispute tracker |

---

### M9. Content — Blog, Email, SEO (P2)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M9.1 | **Rich text editor para blog** | MISSING (solo form básico) | Tiptap/BlockNote con image upload, embeds, code blocks |
| M9.2 | **Blog multi-language** | MISSING | Posts en EN/ES/DE con language switcher |
| M9.3 | **Post scheduling** | MISSING | Publish date futuro, auto-publish via cron |
| M9.4 | **Email template editor** | MISSING | Ver/editar templates transaccionales, preview, test send |
| M9.5 | **Email delivery log** | MISSING | Emails enviados, delivered, opened (Resend webhooks) |
| M9.6 | **Translation completeness** | MISSING | % complete per language, missing keys highlighted, side-by-side editing |
| M9.7 | **SEO audit dashboard** | MISSING | Crawl pages, flag missing meta tags, duplicate titles, broken links |
| M9.8 | **Redirect manager** | MISSING | Gestionar 301/302 redirects para URLs cambiadas |

---

### M10. Notification Center (P1)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M10.1 | **Bell icon en TopBar** | MISSING | Dropdown con notificaciones unread, grouped by type, mark-as-read |
| M10.2 | **Real-time via SSE** | SSEProvider existe | Multiplexar eventos: new order, sync error, webhook failed, margin alert |
| M10.3 | **Notification rules** | MISSING | Configurar qué eventos generan notificación: orders >€100, sync failures, low margin |

---

### M11. UX Patterns Faltantes (P2)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M11.1 | **Contextual Save Bar** | MISSING | Sticky bar con Save/Discard que aparece al editar cualquier recurso |
| M11.2 | **Loading skeletons** | Parcial (solo Dashboard) | Extender a Products, Customers, Designs, Orders |
| M11.3 | **Confirmation dialogs** | Parcial | Extender AlertDialog a TODAS las operaciones destructivas |
| M11.4 | **Keyboard nav global** | Parcial | Añadir: `g d` (go dashboard), `g o` (go orders), `g p` (go products) |
| M11.5 | **Sticky table headers** | MISSING | Headers visibles al scrollear tablas largas |
| M11.6 | **Undo toast** | MISSING | Después de bulk action: toast con botón "Undo" por 10 segundos |
| M11.7 | **Date range picker global** | MISSING | Componente reutilizable para analytics, orders, audit |

---

### M12. Arquitectura & Escalabilidad (P2)

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M12.1 | **`<PageLayout>` estandarizado** | MISSING | Breadcrumbs → Title + Actions → Filter bar → Content → Pagination. Componente que todas las páginas usan |
| M12.2 | **Hooks por módulo** | Parcial (useOrders, useProducts) | Crear: `useCustomers`, `useDesigns`, `useSyncStatus`, `useWebhooks`, `useCronJobs` |
| M12.3 | **`usePersistedState`** | MISSING | Hook para guardar UI state en localStorage (column visibility, sort, filters, sidebar) |
| M12.4 | **SSE multiplexado** | SSEProvider existe | Single endpoint `/api/admin/events` que despacha a notification center, activity feed, dashboard |
| M12.5 | **API rate limiting** | rate-limit.ts existe | Verificar que TODAS las rutas lo usan, no solo algunas |

---

### M13. Printify→Printful Migration (P0)

| # | Feature | Detalle |
|---|---|---|
| M13.1 | **Migrar 14 refs Printify en 9 archivos** | Ver tabla exacta en `admin-audit-2026-03-06.md` Sección 8 |
| M13.2 | **Reemplazar costes hardcoded** | Finance usa 45% margen ficticio → usar costes reales de Printful API |
| M13.3 | **Actualizar Create Product dialog** | En designs/[id]: "Printify Template" → "Printful Template", categorías dinámicas |

---

## Resumen por prioridad

| Prioridad | Módulos | Features | Impacto |
|---|---|---|---|
| **P0** | M1 (Security), M13 (Migration) | 7 features | Bloquea producción |
| **P1** | M2 (DataTable), M3 (Observability), M4 (Orders), M5 (Products), M6 (Customers), M7 (Designs), M10 (Notifications) | 38 features | Operación diaria eficiente |
| **P2** | M8 (Analytics), M9 (Content), M11 (UX), M12 (Architecture) | 23 features | Calidad y escalabilidad |
| **P3** | Nice-to-haves mencionados inline | ~5-8 features | Polish |
| **Total** | 13 módulos | **~73 features** | Admin completo y competitivo |

---

## Arquitectura recomendada

### Patrón de página estándar
```
<PageLayout title="Products" actions={<Button>New Product</Button>}>
  <FilterBar filters={[status, category, dateRange]} onExport={exportCSV} />
  <DataTable
    columns={productColumns}
    data={products}
    enableColumnVisibility
    enableRowSelection
    enableSorting
    savedViews={savedViews}
    emptyState={<EmptyProducts />}
  />
</PageLayout>
```

### Real-time (SSE, no WebSocket)
- Un endpoint `/api/admin/events` SSE
- TopBar subscribe → despacha a NotificationCenter, ActivityFeed, DashboardWidgets
- Unidireccional (server→client) — SSE suficiente, no necesita WebSocket

### Caching
| Capa | Tool | TTL |
|---|---|---|
| Client | React Query | 30s-5min |
| Server | Redis | 1-10min (analytics pesadas) |
| Persist | localStorage | Indefinido (UI state, column prefs) |

---

## Fuentes consultadas
- Shopify Polaris Design System (Index Tables, Contextual Save Bar, Resource pages)
- Medusa Admin v2 (Widget system, UI Routes, Bulk editor)
- Retool (Inline editing, data sync patterns)
- TanStack Table docs (column visibility, virtual scroll)
- Hookdeck (Webhook health monitoring patterns)
- E-Commerce KPIs 2026 (Shopify, ThoughtSpot)
- POD-specific KPIs (FinancialModelsLab — 90%+ gross margin tracking)
- SSE vs WebSockets analysis (Dev.to)
- Material Design 3 responsive patterns
- Admin Dashboard UI/UX Best Practices 2025 (Medium)

---

*Documento generado: 2026-03-06. Pendiente: selección de features a implementar por el usuario.*
