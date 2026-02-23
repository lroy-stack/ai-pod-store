# Plan 02 — Admin Dashboard

**Prioridad**: P0 — BLOQUEANTE
**Estimación**: 35-45h
**Dependencias**: Plan 01 (Seguridad) Bloques A+B deben completarse primero
**Bloquea**: Plan 06 (PodClaw observabilidad), Plan 10 (Growth)

---

## 1. Objetivo

Transformar el admin panel de colección de páginas independientes a dashboard cohesivo, mantenible y funcional. Establecer patrones arquitectónicos que escalen a 50+ páginas.

## 2. Estado Actual (Validado)

| Área | Score | Evidencia |
|------|-------|-----------|
| Layout | 3/10 | 27/34 páginas sin sidebar (importan DashboardLayout manualmente) |
| Data Fetching | 2/10 | 33/34 páginas usan `useEffect` + `fetch` (solo Dashboard usa React Query) |
| UI Consistency | 4/10 | 62 violaciones de color tokens, 24 `alert()`/`prompt()` nativos |
| Error Handling | 1/10 | Sin `error.tsx`, sin `not-found.tsx`, sin error boundaries |
| Accessibility | 2/10 | Solo 2 `alt` en imágenes, 6 `aria-label` en todo el admin |
| State Management | 3/10 | Sin global state, settings page es stub (`setTimeout` fake save) |
| Dark Mode | 2/10 | ThemeToggle existe pero no está wired |
| adminFetch | 9/10 | 130+ usos, 0 raw `fetch()` — patrón bien adoptado |
| ReactMarkdown | 3/10 | 4 páginas admin sin DOMPurify (legal editor, soul, memory, chat) |
| Test Routes | 1/10 | `test-sse/route.ts` en producción |

## 3. Gap Estructural

El admin fue construido "página a página" sin un layout system centralizado. Cada página reimplementa sidebar, loading states, y error handling. No hay shared state, no hay data cache (React Query), y el design system (shadcn/ui + tokens semánticos) no se aplica consistentemente. Esto hace que cada nueva página requiera ~3x más esfuerzo del necesario y acumule deuda visual.

## 4. Decisión Arquitectónica

### Layout: Route Group `(dashboard)` con layout compartido

**Justificación**:
- Next.js route groups permiten layout nesting sin afectar URLs
- Un solo `(dashboard)/layout.tsx` con sidebar + header + breadcrumbs elimina 27 importaciones manuales
- Login queda fuera del route group (sin sidebar)

### Data: React Query + typed API hooks

**Justificación**:
- React Query ya está instalado (solo usado en 1 página)
- Elimina el patrón `useEffect` + `useState` + `setLoading` + `setError` × 33 páginas
- Cache automático, deduplicación, retry, optimistic updates
- Permite prefetching y background refetch

### UI: Token audit + component library enforcement

**Justificación**:
- Los 62 color violations son mecánicos de corregir (find & replace semántico)
- `alert()`/`prompt()` se reemplazan por `toast()` de sonner + `<Dialog>` de shadcn
- Un theme provider wired correctamente habilita dark mode gratis

## 5. Plan de Implementación

### Bloque A: Arquitectura de Layout (8h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| A1 | Crear route group `(dashboard)/` | `admin/src/app/(dashboard)/layout.tsx` | 2h |
| A2 | Mover 27 páginas sin sidebar al route group | `admin/src/app/(dashboard)/*/page.tsx` | 2h |
| A3 | Crear `Sidebar` como componente autónomo con nav items dinámicos | `admin/src/components/layout/Sidebar.tsx` | 1.5h |
| A4 | Crear `Header` con breadcrumbs + user menu + command palette trigger | `admin/src/components/layout/Header.tsx` | 1h |
| A5 | Crear `error.tsx` y `not-found.tsx` globales | `admin/src/app/(dashboard)/error.tsx`, `not-found.tsx` | 1h |
| A6 | Eliminar `DashboardLayout` component (reemplazado por route group) | `admin/src/components/DashboardLayout.tsx` | 30min |

### Bloque B: Data Fetching con React Query (10h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| B1 | Configurar `QueryClientProvider` en root layout | `admin/src/app/layout.tsx` | 30min |
| B2 | Crear hooks tipados: `useProducts()`, `useOrders()`, `useCustomers()` | `admin/src/hooks/queries/` | 2h |
| B3 | Crear mutations tipadas: `useCreateProduct()`, `useUpdateOrder()` | `admin/src/hooks/mutations/` | 2h |
| B4 | Migrar top 10 páginas más usadas a React Query | 10 page files | 4h |
| B5 | Migrar 23 páginas restantes | 23 page files | 1.5h (mecánico post-patrón) |

**Orden de migración por impacto**:
1. `/products` + `/products/[id]` (CRUD principal)
2. `/orders` + `/orders/[id]` (operaciones diarias)
3. `/customers` (PII, necesita cache controlado)
4. `/designs` + `/designs/[id]` (flujo creativo)
5. `/analytics` + `/finance` (dashboards pesados)
6. `/reviews` + `/returns` (gestión)
7. Resto de páginas

### Bloque C: UI Consistency (8h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| C1 | Fix 62 color token violations (bg-blue→bg-primary, etc.) | 11 archivos | 2h |
| C2 | Reemplazar 24 `alert()`/`prompt()` por `toast()` + `<Dialog>` | 12 archivos | 2h |
| C3 | Reemplazar `ReactMarkdown` por `SafeMarkdown` en 4 páginas admin | legal/[slug], soul, memory, ChatMessage | 1h |
| C4 | Wire ThemeProvider para dark mode funcional | `admin/src/app/layout.tsx`, `admin/src/components/ThemeToggle.tsx` | 1h |
| C5 | Añadir aria-labels, alt text, roles semánticos | Todos los componentes interactivos | 1h |
| C6 | Eliminar `test-sse/route.ts` | `admin/src/app/api/test-sse/route.ts` | 5min |
| C7 | Fix settings page: conectar a API real (no setTimeout stub) | `admin/src/app/settings/page.tsx` | 1h |

### Bloque D: Paginación y Performance (5h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| D1 | Añadir paginación server-side a `/designs` | API + page | 1h |
| D2 | Añadir paginación server-side a `/returns` | API + page | 1h |
| D3 | Añadir paginación server-side a `/audit` (quitar hardcoded 100) | API + page | 1h |
| D4 | Añadir paginación server-side a `/legal/consents` | API + page | 1h |
| D5 | Crear componente `<PaginationControls>` reutilizable | `admin/src/components/ui/PaginationControls.tsx` | 1h |

### Bloque E: Supabase Client Cleanup (2h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| E1 | Consolidar `supabase.ts` y `supabase-admin.ts` en un solo módulo | `admin/src/lib/supabase.ts` | 1h |
| E2 | Asegurar que service-role key solo se use server-side (API routes) | Todos los imports | 1h |

## 6. Orden de Ejecución

```
[Plan 01 Bloques A+B completos]
        ↓
Bloque A (Layout) ──→ Bloque B (React Query) ──→ Bloque D (Paginación)
        ↓
Bloque C (UI) ──→ Bloque E (Cleanup)
```

- A es prerequisito de todo (el layout define dónde viven las páginas)
- B y C pueden ejecutarse en paralelo después de A
- D depende de B (usa React Query para paginación)
- E es independiente, puede ir en cualquier momento

## 7. Validaciones Técnicas

| # | Validación | Criterio |
|---|-----------|----------|
| V1 | Todas las páginas tienen sidebar | Navegar a cada ruta → sidebar visible |
| V2 | React Query activo | DevTools muestran cache entries para cada página |
| V3 | 0 color token violations | `grep -r "bg-blue\|bg-green\|bg-red\|bg-gray\|bg-slate\|bg-white\|text-gray" admin/src/` → 0 |
| V4 | 0 alert()/prompt() | `grep -r "alert(\|prompt(" admin/src/app/ admin/src/components/` → 0 |
| V5 | Error boundaries | Navegar a ruta inexistente → not-found.tsx renderiza |
| V6 | Dark mode | Toggle → toda la UI cambia coherentemente |
| V7 | Paginación | Páginas con >50 items muestran controles de paginación |
| V8 | Settings funcional | Guardar settings → verificar en DB que persisten |

## 8. Validaciones de Negocio

- Admin puede gestionar productos, pedidos y clientes sin fricciones visuales
- Todas las acciones destructivas tienen confirmación (Dialog, no alert)
- La navegación es consistente y predecible (sidebar siempre visible)
- Dark mode funcional para sesiones nocturnas de gestión

## 9. Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Páginas con sidebar | 7/34 (21%) | 33/34 (97%) |
| React Query adoption | 1/34 (3%) | 34/34 (100%) |
| Color token violations | 62 | 0 |
| Native alert/prompt | 24 | 0 |
| Error boundaries | 0 | 2 (error.tsx + not-found.tsx) |
| Admin score audit | 5.5/10 | 8.0/10 |

## 10. Estimación Total

| Bloque | Horas |
|--------|-------|
| A — Layout | 8h |
| B — React Query | 10h |
| C — UI Consistency | 8h |
| D — Paginación | 5h |
| E — Cleanup | 2h |
| **Total** | **33h** |

**Con 2 agentes paralelos (B+C simultáneos)**: ~25h elapsed

---

*Plan derivado de audit 01-admin-dashboard.md validado (95% precisión). 2026-02-23.*
