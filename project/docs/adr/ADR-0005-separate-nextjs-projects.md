# ADR-0005: Separate Next.js Projects for Frontend and Admin

## Status

Accepted

## Context

POD AI has two web applications with fundamentally different purposes:
1. **Frontend (Storefront)**: Customer-facing e-commerce site with chat, product browsing, checkout, and account management
2. **Admin Panel**: Internal management interface for product CRUD, order fulfillment, agent monitoring, and legal/settings management

Initially, we considered three architectural approaches:
- **Single Next.js project with route-based separation**: `/` for storefront, `/admin` for admin panel
- **Two separate Next.js projects**: `frontend/` and `admin/` as sibling directories
- **Monorepo with shared components**: Turborepo or pnpm workspaces with `apps/frontend` and `apps/admin`

**Key differences between frontend and admin**:
| Aspect | Frontend | Admin |
|--------|----------|-------|
| **Auth** | Supabase Auth (email/password, OAuth) | iron-session (bcrypt, signed cookies) |
| **i18n** | 3 locales (en, es, de) with next-intl | English-only (no i18n) |
| **UI framework** | shadcn/ui + Tailwind v4 | shadcn/ui + Tailwind v4 |
| **Deployment** | Vercel/Cloudflare (port 3000) | VPS/Docker (port 3001, /panel basePath) |
| **Bundle size** | ~200KB (chat, product catalog, checkout) | ~150KB (data tables, charts, forms) |
| **Users** | 10,000+ customers | 1-5 admin users |
| **Security** | Public routes + authenticated routes | All routes require authentication |
| **SEO** | Critical (landing pages, product pages) | Not needed (internal tool) |

## Decision

We will use **two separate Next.js projects** in `frontend/` and `admin/` directories.

**Directory structure**:
```
project/
├── frontend/              # Customer-facing storefront
│   ├── src/
│   │   ├── app/
│   │   │   ├── [locale]/(landing)/
│   │   │   ├── [locale]/(app)/
│   │   │   ├── [locale]/(focused)/
│   │   │   └── api/
│   │   ├── components/
│   │   ├── lib/
│   │   └── providers/
│   ├── messages/          # i18n (en.json, es.json, de.json)
│   ├── .env.local         # Supabase keys, Stripe, etc.
│   └── package.json       # Dependencies for frontend
├── admin/                 # Internal management panel
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   ├── api/
│   │   │   └── login/
│   │   ├── components/
│   │   └── lib/
│   ├── .env.local         # Admin-specific keys
│   └── package.json       # Dependencies for admin
└── shared/                # (future) Shared types, utilities
```

**Deployment**:
- **Frontend**: Port 3000, basePath `/`, deployed to Vercel or Cloudflare Pages
- **Admin**: Port 3001, basePath `/panel`, deployed to Docker container on VPS

**Shared dependencies** (via copy-paste for now):
- shadcn/ui components (identical in both projects)
- Tailwind config (semantic tokens, dark mode)
- Database client (`@supabase/supabase-js`)

## Consequences

**Positive**:
- ✅ **Independent deployments**: Can deploy frontend without affecting admin, and vice versa
- ✅ **Smaller bundles**: Admin doesn't load i18n, chat, or product catalog code
- ✅ **Security isolation**: Admin auth is completely separate from frontend auth
- ✅ **Clearer mental model**: Developers instantly know which project they're in
- ✅ **Optimized for purpose**: Frontend optimized for SEO and performance, admin optimized for data-heavy UIs
- ✅ **Faster builds**: Frontend builds don't recompile admin code

**Negative**:
- ❌ **Code duplication**: shadcn/ui components must be copied between projects
- ❌ **Two dependency trees**: Must update packages in both `frontend/` and `admin/` separately
- ❌ **No type sharing**: TypeScript types for database models must be duplicated or imported via relative paths
- ❌ **Inconsistent versions**: Risk of frontend using React 19.2 while admin uses React 19.1

**Mitigations**:
- **Phase 1 (current)**: Accept duplication - projects are small enough that copying shadcn components is manageable
- **Phase 2** (future, if needed): Introduce monorepo with shared packages:
  - `packages/ui`: Shared shadcn/ui components
  - `packages/db`: Shared Supabase types and client
  - `packages/utils`: Shared utilities (cn(), formatCurrency(), etc.)
- Use script to sync shadcn components: `scripts/sync-shadcn.sh` (copies ui/ between projects)
- Pin dependencies with `package-lock.json` to avoid version drift

## Implementation Notes

**Running both projects locally**:
```bash
# Terminal 1: Frontend
cd frontend && npm run dev  # http://localhost:3000

# Terminal 2: Admin
cd admin && npm run dev     # http://localhost:3001
```

**Docker Compose**:
```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
  admin:
    build: ./admin
    ports:
      - "3001:3001"
    environment:
      - NEXT_PUBLIC_BASE_PATH=/panel
```

**Admin basePath** (`admin/next.config.mjs`):
```javascript
export default {
  basePath: process.env.NODE_ENV === 'production' ? '/panel' : '',
  // In production: http://example.com/panel/dashboard
  // In dev: http://localhost:3001/dashboard
}
```

**API route consistency**:
- Both projects have `/api` routes, but namespaced by deployment
- Frontend: `http://localhost:3000/api/products`
- Admin: `http://localhost:3001/api/products` (or `/panel/api/products` in production)

## References

- Frontend directory: `project/frontend/`
- Admin directory: `project/admin/`
- Docker Compose: `project/docker-compose.yml`
- Next.js basePath: https://nextjs.org/docs/app/api-reference/next-config-js/basePath
