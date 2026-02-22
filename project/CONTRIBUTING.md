# Contributing to POD AI Store

Thank you for your interest in contributing to the POD AI Store! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Project Structure](#project-structure)

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and professional in all interactions.

---

## Getting Started

### Prerequisites

Before contributing, ensure you have the following installed:

- **Node.js** 22 or higher
- **Python** 3.12 or higher
- **Docker** and **Docker Compose** (for local development)
- **Git** for version control

### First Time Contributors

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/pod-ai-store.git
   cd pod-ai-store
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/ORIGINAL-OWNER/pod-ai-store.git
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Setup

### Quick Setup

The project consists of 5 separate sub-projects under `project/`:

1. **Frontend** (Next.js storefront, port 3000) — `project/frontend/`
2. **Admin** (Next.js admin panel, port 3001) — `project/admin/`
3. **PodClaw** (Python agent, port 8000) — `project/podclaw/`
4. **Deploy** (Docker Compose configuration) — `project/deploy/`
5. **Supabase** (Database migrations) — `project/supabase/`

### Frontend Development

```bash
cd project/frontend
npm install
cp .env.example .env.local  # Configure with your API keys
npm run dev  # Start on port 3000
```

### Admin Panel Development

```bash
cd project/admin
npm install
cp .env.example .env.local  # Configure with your API keys
npm run dev  # Start on port 3001
```

### PodClaw Agent Development

```bash
cd project/podclaw
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Configure with your API keys
python -m bridge.api  # Start FastAPI on port 8000
```

### Full Docker Stack

```bash
# From project root
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml up -d
```

For detailed setup instructions, see [README.md](./README.md).

---

## Coding Standards

### Design System (MANDATORY)

**Before making ANY UI changes, read [CLAUDE.md](./CLAUDE.md)** — it defines mandatory design standards for this project.

Key rules:
- **shadcn/ui ONLY**: Use shadcn/ui components from `@/components/ui/` — NEVER write raw HTML for buttons, inputs, dialogs, etc.
- **Semantic tokens ONLY**: Use `bg-primary`, `text-foreground`, `border-border` — NEVER use color utilities like `bg-blue-600` or `bg-gray-200`.
- **Mobile-first responsive**: Base styles for 375px, `md:` for 768px, `lg:` for 1024px+.
- **cn() utility**: Use `cn()` from `@/lib/utils` for conditional class merging.
- **Route groups IMMUTABLE**: Do NOT modify the route group structure `(landing)`, `(app)`, `(focused)`.

### TypeScript

- All new code must be written in **TypeScript** with strict mode enabled.
- Avoid `any` types — use proper type definitions.
- Export types and interfaces from component files when needed.
- Use Zod for runtime validation in API routes.

### Code Style

- **Frontend/Admin**: Use ESLint + Prettier (config included).
- **PodClaw**: Use Black + Ruff for Python formatting.
- Run linters before committing:
  ```bash
  # Frontend
  cd project/frontend && npm run lint

  # Admin
  cd project/admin && npm run lint

  # PodClaw
  cd project/podclaw && ruff check . && black --check .
  ```

### File Organization

- **API Routes**:
  - Frontend: `project/frontend/src/app/api/{path}/route.ts`
  - Admin: `project/admin/src/app/api/{path}/route.ts`
- **Components**:
  - Frontend: `project/frontend/src/components/`
  - Admin: `project/admin/src/components/`
- **Utilities**:
  - Frontend: `project/frontend/src/lib/`
  - Admin: `project/admin/src/lib/`
- **Types**: Colocate with the files that use them, or in `src/types/` for shared types.

### Internationalization (i18n)

- All user-facing text in the **frontend** must be translated (EN/ES/DE).
- Add translation keys to `project/frontend/messages/{locale}.json`.
- Use `useTranslations()` hook from `next-intl`.
- **Admin panel** is English-only — no i18n needed.

### Database Migrations

- Use Supabase CLI for all database changes:
  ```bash
  cd project
  supabase migration new <migration_name>
  # Edit the generated file in supabase/migrations/
  supabase db push  # Push to remote Supabase Cloud
  ```
- Always include RLS (Row Level Security) policies.
- Never commit raw SQL outside of migrations.

---

## Pull Request Process

### Before Submitting

1. **Update from upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests**:
   ```bash
   # Frontend tests
   cd project/frontend && npm test

   # E2E tests
   npx playwright test

   # Admin tests
   cd project/admin && npm test
   ```

3. **Run type checking**:
   ```bash
   # Frontend
   cd project/frontend && npx tsc --noEmit

   # Admin
   cd project/admin && npx tsc --noEmit
   ```

4. **Run linters**:
   ```bash
   # Frontend
   cd project/frontend && npm run lint

   # Admin
   cd project/admin && npm run lint
   ```

5. **Test in browser**:
   - Verify changes work in Chrome, Firefox, and Safari.
   - Test responsive layouts at 375px (mobile), 768px (tablet), 1280px (desktop).
   - Test with keyboard navigation and screen readers (if UI changes).

### Submitting a Pull Request

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub with:
   - **Title**: Brief description (under 70 characters)
   - **Description**:
     - What does this PR do?
     - What issue does it fix? (use `Fixes #123` to auto-close issues)
     - Screenshots/GIFs for UI changes
     - Testing checklist
   - **Labels**: Add appropriate labels (bug, feature, documentation, etc.)

3. **PR Template**:
   ```markdown
   ## Summary
   Brief description of changes

   ## Related Issue
   Fixes #123

   ## Changes
   - [ ] Change 1
   - [ ] Change 2

   ## Testing
   - [ ] Unit tests pass
   - [ ] E2E tests pass
   - [ ] Tested in Chrome, Firefox, Safari
   - [ ] Tested responsive layouts (375px, 768px, 1280px)
   - [ ] Tested with screen reader (if UI changes)

   ## Screenshots
   (Add screenshots for UI changes)
   ```

4. **Review Process**:
   - Address review comments promptly.
   - Push additional commits to the same branch.
   - Request re-review when ready.

5. **Merging**:
   - PRs must have at least 1 approval.
   - All CI checks must pass.
   - Squash and merge is preferred for feature branches.

---

## Testing Requirements

### Unit Tests

- Write unit tests for all new utility functions.
- Place tests next to the code: `myFunction.test.ts` or `myFunction.test.tsx`.
- Use Vitest for testing framework.
- Aim for >80% code coverage.

### Integration Tests

- Test API routes with actual HTTP requests.
- Mock external services (Stripe, Printify, Supabase).
- Place tests in `__tests__/integration/`.

### E2E Tests

- Use Playwright for end-to-end browser tests.
- Test critical user flows:
  - Auth flow (register, login, logout)
  - Shopping flow (browse, add to cart, checkout)
  - Chat flow (send message, receive response)
  - Admin flow (login, manage orders, manage products)
- Place tests in `project/frontend/e2e/`.

### Test Users

For testing, use these pre-seeded accounts:
- **Frontend**: `e2e-test@example.com` / `testpass123456`
- **Admin**: `admin@podstore.local` / `admin123`

---

## Commit Message Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic changes)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build, CI, dependencies, or tooling changes
- `perf`: Performance improvements
- `security`: Security fixes

### Examples

```bash
# Feature
git commit -m "feat(chat): add voice input support for Spanish locale"

# Bug fix
git commit -m "fix(checkout): resolve Stripe tax calculation for EU customers"

# Documentation
git commit -m "docs(readme): update Docker setup instructions"

# Chore
git commit -m "chore(deps): upgrade Next.js to 16.1.7"

# Security
git commit -m "security(auth): add rate limiting to login endpoint"
```

### Scope (optional but recommended)

- `chat` — Chat/storefront features
- `admin` — Admin panel features
- `podclaw` — PodClaw agent features
- `checkout` — Checkout and payments
- `products` — Product catalog
- `auth` — Authentication and authorization
- `i18n` — Internationalization
- `deploy` — Deployment and infrastructure
- `ci` — Continuous integration
- `deps` — Dependencies

---

## Project Structure

```
project/
├── frontend/                 # Next.js storefront (port 3000)
│   ├── src/app/[locale]/     # Pages with i18n routing
│   │   ├── (landing)/        # Landing page route group
│   │   ├── (app)/            # Main app route group (chat, shop, cart)
│   │   └── (focused)/        # Auth + checkout route group
│   ├── src/app/api/          # 90+ API routes
│   ├── src/components/       # React components
│   │   └── ui/               # shadcn/ui primitives
│   ├── src/lib/              # Utilities
│   ├── messages/             # i18n translations (en.json, es.json, de.json)
│   ├── public/               # Static assets
│   └── .env.local            # Environment variables (DO NOT COMMIT)
│
├── admin/                    # Next.js admin panel (port 3001, English-only)
│   ├── src/app/              # Admin pages
│   ├── src/app/api/          # 35+ admin API routes
│   ├── src/components/       # Admin components
│   └── .env.local            # Admin env vars (DO NOT COMMIT)
│
├── podclaw/                  # Python autonomous agent (port 8000)
│   ├── agents/               # Agent definitions (9 agents)
│   ├── bridge/               # FastAPI bridge API
│   ├── skills/               # Agent skills
│   ├── connectors/           # Service connectors
│   ├── context/              # Brand config, memory
│   └── config.py             # Agent configuration
│
├── deploy/                   # Docker Compose deployment
│   ├── docker-compose.yml    # Base compose (6 services)
│   ├── docker-compose.local.yml   # Local dev overrides
│   ├── docker-compose.prod.yml    # Production overrides
│   └── Caddyfile             # Reverse proxy config
│
├── supabase/                 # Database migrations
│   ├── migrations/           # 60+ SQL migration files
│   └── config.toml           # Supabase CLI config
│
├── scripts/                  # Python analytics scripts
├── shared/                   # Shared utilities
├── CLAUDE.md                 # Design standards (READ FIRST!)
└── README.md                 # Project overview
```

---

## Additional Resources

- **Design System**: [CLAUDE.md](./CLAUDE.md)
- **Setup Guide**: [README.md](./README.md)
- **PodClaw Architecture**: [podclaw/AGENTS.md](./podclaw/AGENTS.md)
- **Security Guidelines**: [podclaw/SECURITY.md](./podclaw/SECURITY.md)
- **Deployment Guide**: [deploy/README.md](./deploy/README.md)

---

## Questions?

If you have questions about contributing, please:

1. Check existing documentation (README, CLAUDE.md, etc.)
2. Search existing issues on GitHub
3. Open a new issue with the `question` label

Thank you for contributing to POD AI Store! 🎉
