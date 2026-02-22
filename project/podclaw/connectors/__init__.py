"""
PodClaw — MCP Connectors
==========================

SDK in-process connectors (type: sdk, not stdio).
Each connector registers tools directly with the Agent SDK.

Connectors:
  supabase  → query, insert, update, rpc, vector_search
  stripe    → list_charges, get_balance, get_revenue, create_refund
  printify  → list_products, create_product, update_product, get_blueprints
  fal       → generate_image, get_status
  gemini    → embed_text, embed_batch
  resend    → send_email, send_template
  crawl4ai  → crawl_url, crawl_site, capture_screenshot, extract_article
  telegram  → send_message, broadcast
  whatsapp  → send_message
"""
