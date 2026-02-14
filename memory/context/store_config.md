# Store Configuration

## Basic Info
- **Store Name**: Ushopia
- **Domain**: ushopia.com
- **Locales**: en (primary), es, de
- **Currency**: USD (primary), EUR displayed for de locale
- **Timezone**: UTC (operations), store shows user's local time

## Technology Stack
- **Frontend**: Next.js 16 on port 3000
- **Database**: Supabase (your-project.supabase.co)
- **Payments**: Stripe (test mode)
- **Fulfillment**: Printify (shop ID: 26473208)
- **Email**: Resend (from: noreply@ushopia.com)
- **Designs**: fal.ai FLUX.1
- **Embeddings**: Google Gemini (768 dims, free)

## Business Rules
- Free shipping on orders > $50
- 30-day return policy
- Refunds < $100: auto-approved
- Refunds > $100: require human approval
- Price changes limited to ±20% per cycle

## Product Categories
- T-Shirts & Apparel
- Mugs & Drinkware
- Wall Art & Posters
- Phone Cases
- Tote Bags
- Home Decor

## Support
- Primary: AI chat (conversational storefront)
- Email: support@ushopia.com (via Resend)
- Response time target: < 4 hours
