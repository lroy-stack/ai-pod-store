---
name: playwright-e2e
description: >
  E2E browser testing with Playwright MCP. Use when asked to test frontend flows, verify UI behavior,
  navigate pages, fill forms, check visual state, or debug browser issues. Trigger words: "test E2E",
  "prueba de frontend", "navegar", "registrarse", "loguearse", "verificar en el navegador", "playwright",
  "browser test".
allowed-tools:
  - "mcp__playwright__browser_navigate"
  - "mcp__playwright__browser_navigate_back"
  - "mcp__playwright__browser_snapshot"
  - "mcp__playwright__browser_take_screenshot"
  - "mcp__playwright__browser_console_messages"
  - "mcp__playwright__browser_network_requests"
  - "mcp__playwright__browser_click"
  - "mcp__playwright__browser_type"
  - "mcp__playwright__browser_fill_form"
  - "mcp__playwright__browser_select_option"
  - "mcp__playwright__browser_hover"
  - "mcp__playwright__browser_drag"
  - "mcp__playwright__browser_press_key"
  - "mcp__playwright__browser_file_upload"
  - "mcp__playwright__browser_wait_for"
  - "mcp__playwright__browser_tabs"
  - "mcp__playwright__browser_close"
  - "mcp__playwright__browser_resize"
  - "mcp__playwright__browser_evaluate"
  - "mcp__playwright__browser_handle_dialog"
  - "mcp__playwright__browser_verify_text_visible"
  - "mcp__playwright__browser_verify_element_visible"
  - "mcp__playwright__browser_verify_value"
  - "mcp__playwright__browser_generate_locator"
---

# Playwright MCP — E2E Browser Testing

## Prerequisites

- Playwright MCP configured with `--browser chromium` (bundled Chromium, no system install)
- Install once: `npx playwright install chromium`
- Frontend running on `localhost:3000`

## Test Credentials

| System | Email | Password |
|--------|-------|----------|
| Frontend | e2e-test@example.com | testpass123456 |
| Admin | admin@podstore.local | admin123 |

## Core Workflow

**Every interaction follows: Navigate → Snapshot → Interact → Snapshot**

### 1. Navigate
```
browser_navigate(url: "http://localhost:3000/en/auth/login")
```

### 2. Snapshot (ALWAYS after navigate or action)
```
browser_snapshot()
```
Returns accessibility tree with `ref` identifiers like `[ref=e45]`.

### 3. Interact using refs
```
browser_click(ref: "e45", element: "Login button")
browser_type(ref: "e12", text: "user@example.com", element: "Email input")
browser_fill_form(fields: [
  { ref: "e12", value: "user@example.com" },
  { ref: "e15", value: "password123" }
])
browser_select_option(ref: "e20", values: ["option1"], element: "Size selector")
browser_press_key(key: "Enter")
```

### 4. Wait and verify
```
browser_wait_for(text: "Welcome back")
browser_wait_for(textGone: "Loading...")
browser_wait_for(time: 2)
browser_take_screenshot()
browser_verify_text_visible(text: "Dashboard")
```

## Element Reference System

After `browser_snapshot()`:
```
- button "Login" [ref=e45]
- textbox "Email" [ref=e12]
- link "Register" [ref=e30]
```

Use `ref` value (e.g. `"e45"`) in interaction tools. **Refs are ephemeral** — they change after every page update. Always re-snapshot.

## Tool Reference

### Navigation
| Tool | Params | Description |
|------|--------|-------------|
| `browser_navigate` | `url` | Go to URL |
| `browser_navigate_back` | — | Browser back |

### Page State
| Tool | Params | Description |
|------|--------|-------------|
| `browser_snapshot` | `filename?` | Accessibility tree (primary reading tool) |
| `browser_take_screenshot` | `type?`, `filename?`, `ref?`, `fullPage?` | PNG/JPEG screenshot |
| `browser_console_messages` | — | JS console output |
| `browser_network_requests` | — | Network requests since page load |

### Interaction
| Tool | Params | Description |
|------|--------|-------------|
| `browser_click` | `ref`, `element?`, `doubleClick?`, `button?`, `modifiers?` | Click |
| `browser_type` | `ref`, `text`, `element?`, `submit?`, `slowly?` | Type into input |
| `browser_fill_form` | `fields[]` | Fill multiple fields |
| `browser_select_option` | `ref`, `values[]`, `element?` | Select dropdown |
| `browser_hover` | `ref`, `element?` | Hover |
| `browser_drag` | source `ref`, target `ref` | Drag and drop |
| `browser_press_key` | `key` | Keyboard key |
| `browser_file_upload` | `paths[]` | Upload files |

### Waiting
| Tool | Params | Description |
|------|--------|-------------|
| `browser_wait_for` | `text?`, `textGone?`, `time?` | Wait for condition |

### Browser Control
| Tool | Params | Description |
|------|--------|-------------|
| `browser_tabs` | `action`, `index?` | Tab management |
| `browser_close` | — | Close page |
| `browser_resize` | `width`, `height` | Resize viewport |
| `browser_evaluate` | `function`, `ref?` | Run JS in page |
| `browser_handle_dialog` | `accept`, `promptText?` | Handle alert/confirm/prompt |

### Assertions
| Tool | Params | Description |
|------|--------|-------------|
| `browser_verify_text_visible` | `text` | Assert text visible |
| `browser_verify_element_visible` | `role`, `name` | Assert element visible by role |
| `browser_verify_value` | `ref`, `value` | Assert input value |
| `browser_generate_locator` | `ref` | Generate Playwright locator |

## Standard Test Patterns

### Auth Flow
```
1. browser_navigate("/en/auth/register") → snapshot
2. Fill name, email, password → click register
3. Wait for redirect/success → snapshot
4. browser_navigate("/en/auth/login") → snapshot
5. Fill email, password → click login
6. Wait for redirect → snapshot → verify authenticated content
```

### Form Submission
```
1. Navigate → snapshot → get refs
2. Fill fields with browser_type or browser_fill_form
3. Click submit → browser_wait_for(text: "Success")
4. Snapshot → verify final state
```

### E-commerce Flow
```
1. Navigate /shop → snapshot → click product
2. Select variant → "Add to Cart"
3. Navigate /cart → verify items
4. Proceed to checkout → fill shipping/payment → complete
```

### CSRF Verification
```
1. Navigate any page → browser_evaluate("() => document.cookie")
2. Verify csrf-token cookie exists
3. POST request → verify no 403
```

## Gotchas

1. **ALWAYS snapshot after navigate** — refs required for interaction
2. **ALWAYS snapshot after actions** — page may have changed, refs stale
3. **Turnstile**: Test keys (`1x00000000000000000000AA`) auto-pass. Production keys require challenge handling
4. **Timeouts**: Action 5s, navigation 60s. Use `browser_wait_for` for slow ops
5. **Cookie auth**: Supabase `sb-*` cookies persist across navigations after login
6. **Locale prefix**: URLs must include `/en/`, `/es/`, or `/de/`
7. **i18n text**: Labels change by locale — use snapshot refs, not hardcoded text
8. **SPA navigation**: Next.js client-side nav may not trigger full page load — use `browser_wait_for`
9. **Dialog handling**: Call `browser_handle_dialog` BEFORE the action that triggers it
10. **Parallel calls**: Snapshot + interact can't be parallel (refs depend on snapshot result)

## Test Scope Checklist

- [ ] Auth: Register, Login, Logout, Forgot Password, Reset Password
- [ ] CSRF: Token in cookies, POST requests work (not 403)
- [ ] Turnstile: Widget renders on login/register/forgot-password
- [ ] Profile: View, edit name, change email, change password
- [ ] Cart: Add item, update quantity, remove item, clear cart
- [ ] Checkout: Shipping address, payment, order confirmation
- [ ] Wishlist: Add/remove items
- [ ] Chat: Send message, receive response
- [ ] Mobile: Responsive layout (browser_resize 375×812)
- [ ] i18n: Language switcher, translated content
