# PodClaw — Long-term Memory

## Store Facts
- Domain: podai.com | Currency: EUR | Languages: EN, ES, DE
- Printify print-on-demand | Supabase DB | Stripe payments
- Physical address: Friedrichstraße 123, 10117 Berlin, Germany
- Minimum markup: 1.4x | Target gross margin: 40% | Target net margin: 30%

## Learned Patterns
(Updated weekly by consolidation)

## Known Issues
(Updated weekly by consolidation)
- [2026-02-16] [cataloger] **Extreme variant disparity across categories**: T-Shirts average 8 variants while Mugs average only 1.6—inconsistent product configuration strategy may indicate uneven merchandising effort or categorization issues.
- [2026-02-16] [cataloger] **Poster pricing outliers**: Posters range €16.99–€36.99 (117% variance), significantly wider than other categories, suggesting potential SKU-level pricing problems or missing variant configurations for some designs.
- [2026-02-16] [cataloger] **Single product categories**: Phone Cases and T-Shirts each have only 1 product—risk concentration that limits cross-selling and makes inventory brittle to single SKU issues.
- [2026-02-16] [finance] **High SKU density with 74 variants across 34 products**: 97% of products have multiple options, optimizing for customer choice and conversion rates across tazas, bolsas, and apparel.
- [2026-02-16] [finance] **Tiered pricing strategy by product type**: Ranges from €16.99 (posters) to €58.99 (t-shirts), suggesting margin optimization based on production costs and market positioning per category.
- [2026-02-16] [finance] **Uneven variant distribution**: Tazas dominate with 16 products but limited variants (1-2 sizes), while iPhone cases and t-shirts pack 6-8 variants each into single SKUs—different inventory complexity profiles.
- [2026-02-17] [cataloger] **Art/Decor dominates margin performance**: Canvas prints and tapestries achieve 56-62% margins vs. typical apparel/drinkware at 44-50%, representing a significant profitability tier gap.
- [2026-02-17] [cataloger] **Minimum margin floor is safely met**: All 40 products exceed the 40% threshold by at least 4 percentage points, with lowest being Beanie Print at 44%, indicating healthy pricing discipline across catalog.
- [2026-02-17] [cataloger] **Profit per unit doesn't correlate with margin %**: High-margin art decor items (€27-49/unit) compete with Sherpa Blanket & AOP Hoodie (€40-50/unit), suggesting product mix strategy should balance both metrics, not prioritize margin % alone.
- [2026-02-17] [designer] **Summarize key insights** from this margin analysis?
- [2026-02-17] [designer] **Extract durable learnings** from an agent's work session (as per my system role)?
- [2026-02-17] [designer] **Help prioritize** which products to design first based on this data?
- [2026-02-17] [designer] **Analyze** specific aspect ratios or design requirements?
- [2026-02-17] [designer] **Something else?**
- [2026-02-17] [cataloger] Current store has only 34 products across 5 categories (mugs, tote bags, posters, hoodies, phone cases)
- [2026-02-17] [cataloger] Identified 11+ product categories completely missing from the store (Canvas Prints, Tapestry, Blankets, Pillows, Candles, Mouse Pads, Pet Bandanas, Stickers, Keychains, Puzzles, Aprons)
- [2026-02-17] [cataloger] Provided margin analysis showing Canvas Prints (60-62% margin, €33-50 benefit/unit), Pet Bandanas (49-54% margin with maximum priority due to €40B EU pet economy), and Tapestry (56% margin, tied to festival culture trend)
- [2026-02-17] [cataloger] Identified T-shirts as incomplete in current inventory
- [2026-02-17] [cataloger] Pet Bandanas have maximum market priority in EU with €40B pet economy opportunity and 49-54% margins
- [2026-02-17] [cataloger] Canvas Prints (60-62% margins, €33-50/unit) identified as high-margin, low-competition category gap
- [2026-02-17] [cataloger] Current store misses 11+ product categories from EU catalog including Tapestry, Blankets, Candles, Keychains—all with 45-60% margins
- [2026-02-17] [researcher] **Pet accessories is a €40B+ EU market with 8% annual growth but zero current SKUs** - major gap given high margins (~54%) and low competitive saturation
- [2026-02-17] [researcher] **Canvas prints offer exceptional 60%+ margins with consistent demand yet store has zero inventory** - likely overlooked despite being proven POD category
- [2026-02-17] [researcher] **Keychains + Mouse pads are impulse-buy items with 54-55% margins driving Q1 2026 trend, completely absent from current product mix**
- [2026-02-17] [cataloger] Single design file can populate Canvas, Poster, and Tapestry simultaneously—major reusability opportunity vs per-product designs
- [2026-02-17] [cataloger] Art/Decor maintains 55-62% margins (€15-50/unit) vs apparel 48-51%, revealing distinct segment economics
- [2026-02-17] [cataloger] Only 4 aspect ratios needed to cover entire high-margin product catalog—design efficiency constraint identified
- [2026-02-17] [qa_inspector] Pricing strategy shows 82% compliance with EU catalog targets; 6 products deviate, indicating potential regional pricing policy drift or intentional margin optimization
- [2026-02-17] [qa_inspector] Portfolio maintains healthy 58% average margin across all 34 products with 100% positive margins, suggesting robust pricing hygiene despite identified outliers
- [2026-02-17] [qa_inspector] Quality audit methodology successfully compared live catalog against EU reference standards, revealing structured data integrity issues across design/product specifications
- [2026-02-17] [finance] A **completed analysis output** (from a finance agent analyzing product margins)
- [2026-02-17] [finance] Already formatted and delivered to an end user
- [2026-02-17] [finance] **Option A:** If you want me to **extract insights from this analysis itself** (e.g., "Canvas products have remarkably high margins"), I can do that, but it's analyzing the content, not the work session.
- [2026-02-17] [finance] **Option B:** If you want me to **review an agent's working session**, please share the full conversation transcript or logs showing the agent's exploration process.
- [2026-02-17] [finance] **Option C:** If you just want this analysis organized differently, let me know the format you prefer.
- [2026-02-17] [cataloger] **57 active products**
- [2026-02-17] [cataloger] **27 products with healthy margins (≥45%)**
- [2026-02-17] [cataloger] **15 products in the warning zone (40-44%)**
- [2026-02-17] [cataloger] **15 products below target (<40%)**
- [2026-02-17] [cataloger] **No data quality issues** (all products have cost_cents, images, product_details, and translations)
- [2026-02-17] [cataloger] **26% of catalog has below-target margins (<40%)** — 15 products need pricing review or cost optimization
- [2026-02-17] [cataloger] **26% in warning zone (40-44%)** — vulnerable to margin compression; small cost increases could push below threshold
- [2026-02-17] [cataloger] **Data completeness is excellent** — zero missing critical fields across 57 products suggests strong data governance
- [2026-02-22] [researcher] Agent execution results/outputs
- [2026-02-22] [researcher] Any findings or discoveries made
- [2026-02-22] [researcher] Data analyzed or patterns detected
- [2026-02-22] [researcher] Configuration/architectural insights discovered


## Week Learnings
Analizando el resumen semanal contra MEMORY.md existente para extraer learnings nuevos...
- [2026-02-22] [Soul] Decision Framework change pending review: Multiple memory entries from finance, cataloger, and QA agents (2026-02-17) show margin analysis is 
