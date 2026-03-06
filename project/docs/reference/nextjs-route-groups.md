# Next.js Route Groups Documentation

## Overview

Route Groups are a folder convention in Next.js that let you organize routes by category, team, or feature. They provide a way to structure your application logically without affecting URL paths.

## Convention

A route group can be created by wrapping a folder's name in parenthesis: `(folderName)`.

This convention indicates the folder is for organizational purposes and should **not be included** in the route's URL path.

### Example Structure

```
app/
├── (marketing)/
│   ├── layout.js
│   ├── page.js          # Routes to /
│   ├── about/page.js    # Routes to /about
│   └── contact/page.js  # Routes to /contact
├── (shop)/
│   ├── layout.js
│   ├── page.js          # Routes to /
│   ├── products/page.js # Routes to /products
│   └── cart/page.js     # Routes to /cart
└── api/
    └── route.js
```

URL Mapping:
- `(marketing)/page.js` → `/`
- `(marketing)/about/page.js` → `/about`
- `(shop)/products/page.js` → `/products`
- `(shop)/cart/page.js` → `/cart`

## Use Cases

### 1. Organizing Routes by Team or Concern

Partition your application by different teams or logical concerns:

```
app/
├── (admin)/
│   ├── dashboard/page.js
│   ├── users/page.js
│   └── settings/page.js
├── (customer)/
│   ├── profile/page.js
│   ├── orders/page.js
│   └── wishlist/page.js
└── (public)/
    ├── page.js
    ├── pricing/page.js
    └── about/page.js
```

### 2. Defining Multiple Root Layouts

Create completely different layouts for different sections:

```
app/
├── (marketing)/
│   ├── layout.js        # Marketing layout with footer, nav
│   └── page.js
├── (dashboard)/
│   ├── layout.js        # Dashboard layout with sidebar
│   ├── page.js
│   └── analytics/page.js
└── (auth)/
    ├── layout.js        # Auth layout (minimal)
    ├── login/page.js
    └── register/page.js
```

### 3. Opting Routes Into Shared Layout

Share a layout for specific routes while keeping others separate:

```
app/
├── layout.js            # Global layout
├── (account)/
│   ├── layout.js        # Account layout (inherits from global)
│   ├── profile/page.js
│   └── settings/page.js
└── (checkout)/
    ├── layout.js        # Checkout layout (inherits from global)
    ├── page.js
    └── success/page.js
```

## Important Caveats

### Full Page Reload on Layout Changes

Navigating between routes that use different root layouts triggers a **full page reload**.

**Example:**
```
Navigation from /cart (uses (shop)/layout.js)
to /blog (uses (marketing)/layout.js)
= Full page reload
```

**Note:** This only applies when you have multiple root layouts. Single root layout navigation is smooth.

**Workaround:** Keep shared UI in the top-level layout if you want smooth transitions across sections.

### Conflicting Paths

Routes in different groups cannot resolve to the same URL path.

**Invalid Example:**
```
(marketing)/about/page.js  → Would resolve to /about
(shop)/about/page.js       → Would also resolve to /about
= ERROR
```

This prevents ambiguous routing and ensures predictable behavior.

**Solution:** Use different slugs or path segments for each group.

### Top-Level Root Layout Requirement

If you use multiple root layouts without a top-level `layout.js` file:
- Your home route (/) **must** be defined within one of the route groups
- Example: `app/(marketing)/page.js`

**Required Structure:**
```
app/
├── (marketing)/
│   ├── layout.js
│   └── page.js          # Home page REQUIRED here
├── (dashboard)/
│   ├── layout.js
│   └── page.js
└── api/
    └── route.js         # API routes outside groups
```

**Invalid Structure:**
```
app/
├── layout.js            # MISSING top-level layout
├── (marketing)/page.js
└── (dashboard)/page.js
# Would cause "no home route" error
```

## Best Practices

### 1. Logical Organization

```
app/
├── (public)/            # Public/marketing pages
│   ├── layout.js
│   ├── page.js
│   ├── about/page.js
│   ├── pricing/page.js
│   └── contact/page.js
│
├── (auth)/              # Authentication flow
│   ├── layout.js        # Minimal layout
│   ├── login/page.js
│   ├── register/page.js
│   └── reset/page.js
│
├── (app)/               # Main application
│   ├── layout.js        # App layout with nav/sidebar
│   ├── page.js
│   ├── dashboard/page.js
│   ├── profile/page.js
│   └── settings/page.js
│
└── api/                 # API routes (outside groups)
    ├── auth/route.js
    └── products/route.js
```

### 2. Naming Conventions

Use clear, meaningful names:
- `(marketing)` - Public marketing pages
- `(dashboard)` - Admin/user dashboard
- `(auth)` - Authentication pages
- `(checkout)` - Purchase flow
- `(account)` - User account pages
- `(public)` - Public content

### 3. Layout Inheritance Strategy

```
app/
├── layout.js                        # Global layout
│   ├── Providers
│   ├── Analytics
│   ├── Global styles
│
├── (marketing)/
│   └── layout.js                    # Adds marketing-specific UI
│       ├── Header
│       ├── Footer
│       └── {children}
│
└── (dashboard)/
    └── layout.js                    # Adds dashboard-specific UI
        ├── Sidebar
        ├── TopNav
        └── {children}
```

### 4. API Routes

API routes should typically **not** be in groups:

```
app/
├── (public)/page.js
├── (dashboard)/page.js
└── api/                    # Not in a group
    ├── auth/route.js
    ├── users/route.js
    └── products/route.js
```

This ensures consistent API paths regardless of UI organization.

## Real-World Example: E-Commerce

```
app/
├── layout.js                        # Global layout
├── (public)/
│   ├── layout.js                    # Header + Footer
│   ├── page.js                      # Home
│   ├── about/page.js
│   ├── contact/page.js
│   └── pricing/page.js
│
├── (shop)/
│   ├── layout.js                    # Shop header + sidebar
│   ├── page.js                      # Shop home
│   ├── products/page.js
│   ├── products/[id]/page.js
│   ├── categories/[slug]/page.js
│   └── cart/page.js
│
├── (auth)/
│   ├── layout.js                    # Minimal auth layout
│   ├── login/page.js
│   ├── register/page.js
│   ├── forgot-password/page.js
│   └── reset-password/[token]/page.js
│
├── (account)/
│   ├── layout.js                    # Account layout with sidebar
│   ├── profile/page.js
│   ├── orders/page.js
│   ├── wishlist/page.js
│   └── settings/page.js
│
└── api/
    ├── auth/route.js
    ├── products/route.js
    ├── cart/route.js
    └── orders/route.js
```

## Migration Guide

### Moving Routes into Groups

Before:
```
app/
├── page.js
├── about/page.js
├── dashboard/page.js
└── login/page.js
```

After:
```
app/
├── (public)/
│   ├── page.js
│   └── about/page.js
├── (dashboard)/
│   └── page.js
├── (auth)/
│   └── login/page.js
```

### Maintaining URLs

URLs stay the same - only internal organization changes:
- `/` → still works
- `/about` → still works
- `/login` → still works

## Combining with Other Features

Route groups work well with:

- **Dynamic Routes:** `(shop)/products/[id]/page.js`
- **Catch-all Routes:** `(docs)/[[...slug]]/page.js`
- **Parallel Routes:** Multiple segments in same group
- **Intercepting Routes:** Advanced routing patterns
- **Middleware:** Applies across all routes regardless of groups

## Summary

Route groups provide a powerful way to organize Next.js applications without affecting URL structure. They enable:

1. Logical separation of concerns
2. Multiple root layouts for different sections
3. Cleaner project structure
4. Better team collaboration
5. Flexible routing patterns

Key rules to remember:
- Groups are in parentheses: `(name)`
- Don't appear in URLs
- Multiple root layouts cause full page reloads
- Must avoid conflicting paths
- Home route required if no top-level layout

Use route groups strategically to make your Next.js codebase more maintainable and organized.
