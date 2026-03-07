# POD AI Store — Shop Architecture Analysis
**Date**: 2026-02-24 | **Analyzed Files**: 6 core components + 2 route pages

---

## File Structure & Locations

```
frontend/src/
├── app/[locale]/(app)/shop/
│   ├── page.tsx                    ← Server component (main shop page)
│   ├── loading.tsx                 ← Loading skeleton (defined)
│   ├── [id]/page.tsx              ← Product detail page
│   ├── [id]/not-found.tsx         ← 404 handler
│   └── category/[slug]/page.tsx   ← Category page (server component)
│
├── components/shop/
│   └── ShopPageClient.tsx          ← Client wrapper (filters, pagination, search)
│
└── components/products/
    ├── ProductCard.tsx             ← Individual product card
    ├── ProductCardSkeleton.tsx      ← Loading skeleton for cards
    └── ProductGrid.tsx             ← Grid layout + loading/empty states
```

---

## 1. RESPONSIVE PATTERNS ANALYSIS

### Grid Layout (ProductGrid.tsx)

**Current Pattern**: CSS Grid with `auto-fill`
```tsx
const gridClasses = 'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4'
```

**Responsive Behavior**:
- Uses fluid grid with minimum 200px column width
- Automatically scales: 1→2→3→4 columns based on container width
- NOT explicitly using `md:` or `lg:` breakpoints (CSS grid handles it organically)
- Gap: 4 units (16px) on all sizes
- **Issue**: This is different from CLAUDE.md recommendation (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- **Advantage**: Better UX on different screen sizes without hard breakpoints

### ShopPageClient Container

```tsx
<div className="container mx-auto px-4 py-8">
```

- Mobile-first: `px-4` on all sizes
- `container` centers and constrains width
- `py-8` uniform vertical spacing
- Category chips on mobile are full width, compress on `md:`

### Filters & Sort (ShopPageClient)

```tsx
<div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
```

- Vertical stack on mobile (`flex-col`)
- Horizontal on tablet+ (`md:flex-row`)
- Good use of `md:` breakpoint for responsive layout

### Loading State (shop/loading.tsx)

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
```

- Uses explicit breakpoints: `grid-cols-1 → sm:grid-cols-2 → md:grid-cols-3 → lg:grid-cols-4`
- **Inconsistency**: Different from ProductGrid's fluid grid approach

### Pagination

```tsx
<div className="mt-8 flex items-center justify-center gap-2">
```

- Centered, responsive gap
- Buttons have `size-10` (40px) — touch-friendly
- No explicit mobile adjustments (scales naturally)

---

## 2. SHADCN/UI COMPONENTS USED

| Component | File | Usage | Notes |
|---|---|---|---|
| `Button` | ProductCard, ShopPageClient | Add to cart, filters, pagination | Multiple variants: `default`, `outline`, `ghost` |
| `Input` | ShopPageClient | Search field | With icon overlay (lucide-react Search) |
| `Select` + `SelectTrigger` + `SelectContent` + `SelectItem` | ShopPageClient | Sort dropdown | Proper a11y ids |
| `Badge` | ProductCard | Out-of-stock overlay | `variant="secondary"` |
| `Breadcrumb` + `BreadcrumbList` + `BreadcrumbItem` + `BreadcrumbLink` + `BreadcrumbSeparator` + `BreadcrumbPage` | shop/page.tsx, category/page.tsx | Navigation breadcrumbs | SEO + UX |
| `Skeleton` | shop/loading.tsx | Loading placeholders | For page-level loading state |

**Missing shadcn/ui Components**:
- `Tabs` — not used for category filtering (using Button chips instead)
- `Dialog` — quick view uses StorefrontContext instead
- `Drawer` / `Sheet` — mobile filters would benefit from this

---

## 3. SEMANTIC TOKENS ANALYSIS

### Correct Usage

```tsx
// Colors
className="text-foreground"                    ✓ Primary text
className="text-muted-foreground"              ✓ Secondary text, hints
className="bg-card"                            ✓ Card background
className="border-border"                      ✓ Border color
className="bg-background"                      ✓ Page background (in loading.tsx)
className="bg-primary text-primary-foreground" ✓ Primary button
className="border-primary ring-primary/30"     ✓ Focus rings
className="fill-destructive text-destructive"  ✓ Wishlist heart (filled)
className="bg-muted animate-pulse"             ✓ Loading skeleton
className="text-rating"                        ✓ Star rating color
```

### Violations Found

**None detected** in the 6 analyzed files. The codebase strictly adheres to semantic tokens.

### Opacity Usage

```tsx
className="border-border/40"                   ✓ Reduced opacity for borders
className="border-border/60"                   ✓ Color variant swatches
className="bg-card/80 backdrop-blur-sm"        ✓ Wishlist button overlay
className="bg-background/60"                   ✓ Out-of-stock overlay
className="text-muted-foreground/40"           ✓ Image error placeholder
```

**Pattern**: Opacity levels are well-thought-out, using `/40`, `/60`, `/80` for visual hierarchy.

---

## 4. LOADING STATES / ERROR HANDLING / EMPTY STATES

### Loading State (ProductGrid)

```tsx
if (isLoading) {
  return (
    <div className={gridClasses}>
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
```

- Uses `ProductCardSkeleton` component with `bg-muted animate-pulse`
- Respects `skeletonCount` prop (default 8, configurable)
- Maintains grid layout consistency during load

### Empty State (ProductGrid)

```tsx
if (products.length === 0) {
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground text-lg">{emptyMessage}</p>
    </div>
  )
}
```

- Centered, readable message
- Uses `text-muted-foreground` for secondary text
- Generous `py-12` padding for visual balance
- **Pattern**: Message is configurable via `emptyMessage` prop

### Image Error Handling (ProductCard)

```tsx
const [imgError, setImgError] = useState(false)

// In Image component:
{displayImage && !imgError ? (
  <Image ... onError={() => setImgError(true)} />
) : (
  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
    <ImageOff className="h-10 w-10" />
    <span className="text-xs font-medium text-muted-foreground/60">{product.title}</span>
  </div>
)}
```

- Graceful fallback with lucide `ImageOff` icon
- Shows product title as text
- Uses reduced opacity for visual de-emphasis

### Page-Level Loading (shop/loading.tsx)

- Comprehensive skeleton for entire page
- Breadcrumb skeleton
- Search/filter skeleton
- Product grid skeleton (8 items)
- Pagination skeleton
- Uses `Skeleton` component from shadcn/ui

### API Error Handling (ShopPageClient)

```tsx
const fetchProducts = useCallback(async () => {
  setIsLoading(true)
  try {
    const res = await fetch(`/api/products?${urlParams.toString()}`, { cache: 'no-store' })
    const data = await res.json()
    if (data.success) {
      setProducts(data.items || [])
      setTotalProducts(data.total || 0)
    }
  } catch (error) {
    console.error('Error fetching products:', error)
    // NO user-facing toast — silent failure
  } finally {
    setIsLoading(false)
  }
}, [...])
```

- **Issue**: Errors are logged but not shown to user
- No toast notification (could use `sonner`)
- Silent fallback: keeps previous products on-screen
- **Recommendation**: Add toast for network errors

---

## 5. ACCESSIBILITY FEATURES

### Aria Labels

```tsx
// Pagination buttons
aria-label="Previous page"
aria-label="Next page"

// Wishlist button
aria-label={wishlisted ? t('removeFromWishlist') : t('addToWishlist')}

// Color swatches
aria-label={color}
```

### Form Accessibility

```tsx
<label htmlFor="sort" className="text-sm font-medium whitespace-nowrap">
  {t('sortBy')}:
</label>
<Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortOption)}>
  <SelectTrigger id="sort" className="w-[200px]">
```

- Proper `htmlFor` → `id` association
- Descriptive labels

### Semantic HTML

- `<Link>` for navigation (not `<button>`)
- `<form>` for search submission
- Proper button types (`type="button"`, `type="submit"`)

### Color Contrast

- All text uses semantic tokens, likely meets WCAG AA
- Wishlist heart: filled/unfilled states use `text-destructive` for high contrast

### Keyboard Navigation

- Form submission via Enter key (`handleSearchSubmit`)
- Button clicks via Space/Enter
- SelectTrigger/SelectContent handle arrow keys (shadcn/ui)
- **Good**: All interactive elements are keyboard-accessible

---

## 6. TECHNICAL DEBT & ANTI-PATTERNS

### **Issue #1: Silent Error Handling**
- API errors are logged but not shown to users
- **Fix**: Add `toast.error()` from `sonner`

### **Issue #2: Image Priority Logic**
```tsx
const displayImage = hasMultipleColors ? colorEntries[colorIdx][1] : product.image
// ... later:
<Image priority={priority} />
```
- Color swatches change `displayImage`, but if user changes color, the full-size Image already loaded previous color's URL
- **Fix**: Cache color images in state during component mount

### **Issue #3: Category Filtering UI vs Pagination**
- Mobile: category chips wrap and show "+N more"
- On mobile, selecting a new category keeps current page number
- **Fix**: Reset page to 1 on category change (actually already done: `setCurrentPage(1)`)

### **Issue #4: No Debounce on Search Input**
```tsx
onChange={(e) => setSearchQuery(e.target.value)}
```
- Each keystroke updates state and triggers `useEffect` → API fetch
- **Recommendation**: Add 300ms debounce

### **Issue #5: Pagination Shows All Pages**
```tsx
{Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
  <Button key={page} ...>{page}</Button>
))}
```
- With 1000 products (50 pages), shows 50 buttons
- **Better UX**: Show first 3, dots, last 3, or use "previous/next 5"

### **Issue #6: Loading Skeleton Count Mismatch**
- `shop/loading.tsx` shows 8 skeleton items
- `ShopPageClient` has `PRODUCTS_PER_PAGE = 20` (default `skeletonCount` is 8)
- **Inconsistency**: Loading shows fewer items than page displays

### **Issue #7: Responsive Breakpoint Inconsistency**
- `ProductGrid.tsx`: Fluid CSS grid (no breakpoints)
- `shop/loading.tsx`: Explicit `sm:`, `md:`, `lg:` breakpoints
- **Fix**: Unify on one approach; fluid grid is better for this use case

---

## 7. WHAT STORE PORTAL COMPONENTS NEED TO INTEGRATE WITH

### Data Flow

```
shop/page.tsx (Server)
  ↓ fetches products + variants from Supabase
  ↓ creates props
  ↓
ShopPageClient.tsx (Client)
  ↓ manages: search, filters, pagination, sorting
  ↓ calls /api/products for dynamic fetches
  ↓ passes data to:
  ↓
ProductGrid.tsx (Client)
  ↓ maps each product to:
  ↓
ProductCard.tsx (Client)
  ↓ handles: wishlist, cart, quick view
  ↓ uses hooks: useWishlist, useCart, useStorefront
  ↓ opens artifact: setSelectedProduct() → StorefrontContext
```

### Integration Points for Store Portal

1. **Props Contract (ShopPageClient)**
   ```tsx
   interface ShopPageClientProps {
     locale: string
     initialProducts: Product[]
     initialTotal: number
     initialCategories: string[]
     initialCategoryCounts: Record<string, number>
     searchQuery?: string
     category?: string
     sort?: SortOption
   }
   ```
   - Store Portal must accept these exact props
   - Or inherit the same data-fetching pattern

2. **Product Type**
   ```tsx
   interface Product {
     id: string
     title: string
     description: string
     price: number
     currency: string
     image: string
     rating?: number
     reviewCount?: number
     category?: string
     inStock?: boolean
     variants?: { sizes?: string[]; colors?: string[]; colorImages?: Record<string, string> }
   }
   ```
   - Store Portal ProductCard must accept this shape
   - Can extend with additional fields (vendor, SKU, etc.)

3. **Context Integration**
   - `useStorefront()` → `setSelectedProduct(id)`, `addArtifact()`
   - Store Portal artifacts must trigger this same context
   - Quick view button triggers artifact + detail panel

4. **Hooks Integration**
   - `useWishlist()` → `isWishlisted(id)`, `toggleWishlist(id)`
   - `useCart()` → `addToCart(id, qty, variants, title, price)`
   - Store Portal must use same hooks (or wrap them)

5. **API Endpoint Integration**
   - `/api/products` — fetches paginated product list with filters
   - Store Portal should call same endpoint or equivalent
   - Query params: `page`, `limit`, `locale`, `category`, `q`, `sort`, `newArrivals`

6. **Responsive Container**
   - Parent div: `container mx-auto px-4 py-8`
   - Store Portal should respect this width constraint
   - Breadcrumbs use `max-w-7xl` — consider standardizing

7. **Translations (i18n)**
   - Uses `useTranslations('shop')` namespace
   - Store Portal should use same namespace or create new one (e.g., `useTranslations('portal')`)
   - Fallback to charCase if translation missing: `t.has(...) ? t(...) : fallback`

8. **Loading State Pattern**
   - ProductGrid accepts `isLoading` + `skeletonCount`
   - Store Portal should use same pattern
   - Page-level: `shop/loading.tsx` provides template

9. **Pagination Pattern**
   ```tsx
   const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE)
   // Then show 1...totalPages buttons
   // On click: goToPage(page) → window.scrollTo() + setCurrentPage()
   ```
   - Store Portal pagination should follow same logic

10. **Empty State Pattern**
    ```tsx
    if (products.length === 0) {
      return <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">{emptyMessage}</p>
      </div>
    }
    ```

---

## 8. SEMANTIC SUMMARY TABLE

| Feature | Implemented | Pattern | Notes |
|---|---|---|---|
| **Responsive Grid** | ✓ | Fluid CSS auto-fill | Good for POD (variable product counts) |
| **Mobile Navigation** | ✓ | Flex column → row on md: | Category chips collapse on mobile |
| **Loading State** | ✓ | Skeleton + Spinner | Page-level + component-level |
| **Empty State** | ✓ | Centered text with padding | Configurable message |
| **Error State** | ⚠ | Logged only, no toast | Missing user feedback |
| **Image Fallback** | ✓ | ImageOff + product title | Graceful degradation |
| **Aria Labels** | ✓ | On buttons + form labels | Some translation strings missing |
| **Semantic Tokens** | ✓ | All colors follow CLAUDE.md | No violations detected |
| **Touch Targets** | ✓ | Min 40px (size-10) buttons | Meets 44px guideline |
| **Keyboard Nav** | ✓ | Form submission + button clicks | Select component handles arrows |
| **SEO** | ✓ | JSON-LD ItemList schema | Breadcrumbs + meta tags |
| **Search Performance** | ⚠ | No debounce on input | Triggers API on every keystroke |
| **Pagination UX** | ⚠ | Shows all pages | Scales poorly beyond 50 pages |
| **Category Count** | ✓ | Shows in chip label | Updates on filters |

---

## 9. INTEGRATION CHECKLIST FOR STORE PORTAL

- [ ] Accept `ShopPageClientProps` or equivalent data structure
- [ ] Use ProductCard component or extend it
- [ ] Use ProductGrid or create equivalent with same loading/empty patterns
- [ ] Hook into `useWishlist()` and `useCart()` for interactions
- [ ] Call `setSelectedProduct()` + `addArtifact()` for quick view
- [ ] Use semantic tokens only (no bg-blue, bg-gray, etc.)
- [ ] Implement pagination with `totalPages` logic
- [ ] Add toast error handling for failed API calls
- [ ] Use responsive container and breakpoints consistently
- [ ] Add aria-labels for interactive elements
- [ ] Support i18n via `useTranslations()`
- [ ] Match ProductCard's image priority/sizing strategy

