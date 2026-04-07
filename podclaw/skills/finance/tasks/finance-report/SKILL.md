<!-- triggers: revenue, ventas, ingresos, beneficio, margen, pedidos, orders, sales, money, dinero, balance -->
<!-- description: Financial reporting — revenue, orders, margins, Stripe balance -->

# Finance Report — Task Skill

## Data Sources

### Orders (Supabase)
```
supabase_query on table "orders"
select: id, total_cents, status, created_at, user_id
filter: status IN ('paid', 'shipped', 'delivered')
```
For time ranges: add filter `created_at >= '{date}'`

### Stripe Balance
```
stripe_get_balance
→ Returns: available EUR, pending EUR
```

### Recent Charges
```
stripe_list_charges with limit 20
→ Returns: amount, status, created, customer
```

### Margin Analysis
```
supabase_query on table "products"
select: title, base_price_cents, cost_cents
filter: status = 'active' AND cost_cents > 0
```
Margin = (base_price_cents - cost_cents) / base_price_cents * 100

## Response Format

Always in EUR. Structure:
- Revenue period (today/week/month)
- Order count
- Average order value
- Stripe balance (available + pending)
- Top/bottom margin products (if margin analysis requested)

When data is unavailable, say so — do NOT estimate.
