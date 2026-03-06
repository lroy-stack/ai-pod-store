# SKAPARA Pricing Rules

## Pricing Philosophy

- **Minimum margin**: 35% over cost (enforced by cron sync margin fixer)
- **Target margin**: 50-65% depending on category
- **Currency**: EUR only
- **Prices on Printify**: Set in USD cents (Printify API). The cron sync converts to EUR
- **Prices on Supabase**: Stored in EUR cents (base_price_cents)

## Pricing by Category

### Apparel — DTG (P26 Textildruck Europa)

| Product | Cost Range (EUR) | Price (EUR) | Margin | Notes |
|---|---|---|---|---|
| T-Shirt (Gildan 5000) | €8–10 | €24.99 | ~60% | BP6 |
| T-Shirt (Bella+Canvas) | €10–12 | €27.99 | ~57% | BP12, premium feel |
| T-Shirt (B&C TU01T) | €9–11 | €24.99 | ~56% | BP454, EU-sourced |
| Pullover Hoodie | €18–22 | €49.99 | ~56% | BP77 |
| Crewneck | €16–19 | €44.99 | ~58% | BP49, BP457 |
| Long Sleeve | €11–14 | €29.99 | ~53% | BP80 |
| Zip-Up Hoodie | €20–24 | €54.99 | ~55% | BP455 |
| Kids T-Shirt | €7–9 | €19.99 | ~55% | BP TBD |
| Kids Hoodie | €14–17 | €39.99 | ~58% | BP TBD |
| Baby Bodysuit | €7–9 | €17.99 | ~50% | BP TBD |
| Tank Top | €7–9 | €22.99 | ~61% | BP TBD |
| Tote Bag | €6–8 | €16.99 | ~53% | BP TBD |

### Headwear — Embroidery (P410 Printful)

| Product | Cost Range (EUR) | Price (EUR) | Margin | Notes |
|---|---|---|---|---|
| Structured Cap | €10–13 | €29.99 | ~57% | BP1744 |
| Flat Bill Cap | €11–14 | €32.99 | ~58% | BP1755 |
| Snapback Trucker | €10–13 | €29.99 | ~57% | BP1743 |
| Dad Hat | €9–12 | €27.99 | ~57% | BP1729 |
| Cuffed Beanie | €8–11 | €24.99 | ~56% | BP1691 |
| Bucket Hat | €10–13 | €29.99 | ~57% | BP1910 |
| Embroidered Hoodie | €22–28 | €59.99 | ~53% | BP793, premium |

### Drinkware — Sublimation/UV

| Product | Cost Range (EUR) | Price (EUR) | Margin | Notes |
|---|---|---|---|---|
| Mug 11oz (Two-Tone) | €5–7 | €16.99 | ~59% | BP1018, P26 |
| SS Water Bottle | €10–14 | €29.99 | ~53% | BP854, P23 |
| Tumbler 20oz | €12–16 | €32.99 | ~52% | BP1927/P410 or BP966/P86 |

### Accessories — Sublimation/UV

| Product | Cost Range (EUR) | Price (EUR) | Margin | Notes |
|---|---|---|---|---|
| Vinyl Sticker | €1.50–2.50 | €4.99 | ~50% | BP476, P30 |
| Mouse Pad | €4–6 | €14.99 | ~60% | BP442, P30 |
| Desk Mat LED | €15–20 | €44.99 | ~56% | BP969, P90 |
| Sneaker Low Top | €25–35 | €79.99 | ~56% | BP767, P90 |
| Sneaker High Top | €28–38 | €89.99 | ~58% | BP1470, P90 |
| Phone Case | €4–7 | €19.99 | ~65% | BP TBD |

## Pricing Rules

1. **Always round to .99** (psychological pricing)
2. **Set price on Printify FIRST** — the cron sync reads from Printify
3. **If margin < 35%**, the margin fixer will override your price upward
4. **Bundle pricing**: Consider "Buy 2 Get 10% Off" for stickers and mugs (future feature)
5. **Premium uplift**: Embroidered products and sneakers command 10-15% more than DTG equivalents
6. **Kids discount**: Kids products 15-20% less than adult equivalents
7. **Seasonal**: No seasonal pricing for now — consistent year-round
