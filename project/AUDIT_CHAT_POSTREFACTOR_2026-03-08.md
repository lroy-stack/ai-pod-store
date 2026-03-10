# Auditoría Post-Refactoring ChatArea — 2026-03-08

## Resumen Ejecutivo

Auditoría completa de los 8 archivos del refactoring de ChatArea.tsx (975 → 195 LOC).
6 agentes especializados auditaron en paralelo. Se encontraron **8 bugs reales**, todos corregidos en esta sesión.

## Archivos Auditados

| Archivo | LOC | Estado |
|---------|-----|--------|
| `src/components/storefront/ChatArea.tsx` | 195 | Orquestador |
| `src/components/storefront/ChatWelcome.tsx` | 130 | Welcome screen |
| `src/components/storefront/ChatMessages.tsx` | 330 | Message rendering + artifacts |
| `src/components/storefront/ChatInputBar.tsx` | 165 | Input, voice, image |
| `src/hooks/useChatSession.ts` | 195 | Session persistence, TTL |
| `src/hooks/useChatTransport.ts` | 150 | AI SDK, CSRF, engagement |
| `src/hooks/useImageUpload.ts` | 110 | Image validation, drag-drop |
| `src/components/artifacts/registry.tsx` | 107 | Tool→Component mapping |

## Bugs Encontrados y Corregidos

### CRITICAL (3)

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 1 | HTML entities `&#10024;` se renderizaban como texto literal | ChatWelcome.tsx | Reemplazado por Unicode: ✨👕🎨🎁 |
| 2 | `&euro;` no se renderizaba como € | ChatWelcome.tsx | Reemplazado por carácter `€` |
| 3 | handleKeyDown useCallback con stale closure (handleSubmit no en deps) | ChatInputBar.tsx | Eliminado useCallback, función regular |

### HIGH (5)

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 4 | `window.location.href` como side effect en render (confirm_checkout) | ChatMessages.tsx | Extraído a `CheckoutRedirect` con useEffect |
| 5 | `response.json()` en error path sin try-catch (return handler) | ChatMessages.tsx | Añadido try-catch con fallback HTTP status |
| 6 | SVG aceptado en upload (XSS via `image/svg+xml`) | useImageUpload.ts | Rechazo explícito de SVG con toast |
| 7 | FileReader sin onerror handler + memory leak en unmount | useImageUpload.ts | Añadido onerror + readerRef.abort() en cleanup |
| 8 | File input no se reseteaba post-submit (re-upload mismo archivo fallaba) | ChatInputBar.tsx | `fileInputRef.current.value = ''` en submit |

### MEDIUM (2) — También corregidos

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 9 | `sessionExpired` nunca se reseteaba (chat muerto tras login) | useChatSession.ts | Reset automático cuando `isLoggedIn` cambia a true |
| 10 | Locale 'en' mapeaba a USD (SKAPARA es EU-only, todo EUR) | ChatMessages.tsx | Currency hardcoded a `'eur'` |

## Hallazgos NO corregidos (Low risk / No bug real)

| Hallazgo | Razón de no corregir |
|----------|---------------------|
| `as any` cast en useChat initialMessages | Incompatibilidad de tipos AI SDK — cast necesario |
| response.clone() en customFetch | Falso positivo — body NO consumido antes del clone |
| 9 tools sin registro en artifact registry | Son tools de acción (add_to_cart, etc.) que no producen UI visual — `getArtifact()` devuelve null y ChatMessages lo maneja con `return null` |
| addToolApprovalResponse no usado | Disponible para futuro uso con tool approvals — mantener |
| Handlers recreados en ToolArtifact | Componente interno, no memoizable sin useCallback en función estática — overhead mínimo |
| Empty SSE response para engagement limit | Patrón original pre-refactoring, testeado en producción |

## Verificación Final

- `npx tsc --noEmit` — Zero errores
- Todos los imports usados
- No dead code
- No infinite loops
- Dependency arrays completos y correctos

## Estado de Archivos Post-Fix

```
ChatArea.tsx         195 LOC  (orquestador — de 975 original)
ChatWelcome.tsx      130 LOC  (welcome + suggested prompts)
ChatMessages.tsx     330 LOC  (messages + tool artifacts + CheckoutRedirect)
ChatInputBar.tsx     163 LOC  (input + voice + image preview)
useChatSession.ts    200 LOC  (persistence + TTL + sessionExpired)
useChatTransport.ts  150 LOC  (AI SDK + CSRF + engagement)
useImageUpload.ts    110 LOC  (validation + SVG block + drag-drop)
registry.tsx         107 LOC  (+2 entries: ai_design_generate, apply_design_to_product)
```

**Total**: 1385 LOC distribuidas en 8 archivos SRP vs 975 LOC en 1 God Component.
Aumento neto: ~410 LOC (overhead esperado de interfaces, imports, y doc headers).
