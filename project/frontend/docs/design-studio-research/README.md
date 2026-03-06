# Design Studio Research — Documentacion Completa

> Investigacion exhaustiva para planificar el redeseno del modulo de diseno de SKAPARA.
> Generada por 12 agentes de investigacion especializados (Marzo 2026).

---

## Objetivo

Documentar todo lo necesario para disenar e implementar un **editor de diseno dedicado** (pagina completa, no modal) que permita a los clientes personalizar productos sobre un canvas interactivo, responsive y mobile-first.

## Estado Actual

El modulo actual (`DesignStudio.tsx`) es un modal con 3 tabs (texto, AI, upload). No esta montado en ninguna pagina. El componente en produccion es `ProductPersonalizer.tsx` (1051 lineas).

---

## Informes

| # | Tema | Archivo | Estado |
|---|---|---|---|
| 01 | Auditoria del Codebase | `01-codebase-audit.md` | Regenerando |
| 02 | Integracion Printful en Codebase | `02-printful-api-in-codebase.md` | Regenerando |
| 03 | Referencias de Mercado | `03-market-references.md` | Regenerando |
| 04 | Editores Canvas Open-Source (GitHub) | `04-github-oss-editors.md` | Completo |
| 05 | Pipeline Diseno-a-Produccion | `05-design-to-production-pipeline.md` | Regenerando |
| 06 | Restricciones por Tecnica de Impresion | `06-print-technique-constraints.md` | Completo |
| 07 | Sistema de Fuentes | `07-font-system.md` | Completo |
| 08 | Flujos UX End-to-End | `08-ux-flows.md` | Completo |
| 09 | Performance Canvas en Movil | `09-mobile-canvas-performance.md` | Completo |
| 10 | Printful API — Scope Completo para Diseno | `10-printful-api-design-scope.md` | Completo |
| 11 | Analisis de Gaps entre Informes | `11-gap-analysis.md` | Completo |

---

## Hallazgos Clave

### Libreria Recomendada: Konva.js + react-konva

- **55 kB gzipped** vs 300+ kB Fabric.js
- 910K downloads/semana (vs 485K Fabric)
- React declarativo nativo (no imperativo)
- Mobile-first con multi-touch built-in
- MIT, sin vendor lock-in
- **Referencia**: [Webster](https://github.com/YaroslavChuiko/Webster) — editor OSS con stack identico (React + Konva + Tailwind + shadcn/ui)

### Gap del Mercado (Oportunidad)

Ninguna plataforma POD resuelve el flujo **AI-generate + personalizar manualmente** de forma integrada. El flujo "describe en texto natural -> AI genera -> ajustar en canvas" no existe.

### Arquitectura Propuesta

```
Canvas Konva (preview local instantaneo)
    → Export PNG alta resolucion (OffscreenCanvas Worker)
    → Upload a Supabase Storage
    → Printful Mockup API (async, 10-30s)
    → Checkout con placements + URL del diseno
```

### Restricciones Criticas de iOS

- Max 16,777,216 pixels por canvas (4096x4096)
- Cap DPR a 2x obligatorio
- Destruir canvas explicitamente (iOS no libera memoria)
- Max 384 MB de canvas memory total

### Fuentes: 12 actuales, todas OFL/Apache 2.0

Brechas: sin filtrado por tecnica (DTG/bordado), sin monospace en editor, FOUT en 10 de 12 fuentes.

### Printful API para Editor Custom

- File upload → Mockup generation (async) → Order con placements
- Preview local en canvas (no depender de mockup API para preview)
- Pricing en tiempo real via `/v2/catalog-variants/{id}/prices`
- EDM (Embedded Design Maker) requiere contrato enterprise — descartado

---

## Decisiones Pendientes

1. **Fabric.js vs Konva**: El doc interno `design-generator-architecture.md` ya eligio Fabric. Los informes nuevos recomiendan Konva. Resolver antes de implementar.
2. **Migracion 201500**: Verificar si fue aplicada en produccion.
3. **Checkout con personalizacion**: `provider_temp_product_id: null` siempre — flujo no implementado.

---

## Para la Proxima Sesion

1. Leer todos los informes
2. Resolver la decision Fabric vs Konva con evidencia
3. Crear plan de implementacion end-to-end
4. Definir MVP vs features avanzadas
5. Establecer timeline por fases
