"""
PodClaw — MCP Connectors
==========================

8 in-process MCP connectors (SDK pattern, not stdio).
Each connector exposes get_tools() -> dict of tool handlers,
bridged to McpSdkServerConfig via connector_adapter.py.

Connectors (52 tools total):
  printful      → 18 tools: catalog, store products, files, mockups, orders, shipping, webhooks
  supabase      → 8 tools:  query, insert, update, delete, rpc, vector_search, upload_image, count
  fal           → 4 tools:  generate_image, get_generation_status, remove_background, upscale_image
  gemini        → 4 tools:  embed_text, embed_batch, generate_image, check_image_quality
  stripe        → 7 tools:  list_charges, get_balance, get_revenue_report, create_refund, list_disputes, get_invoice, list_payouts
  resend        → 4 tools:  send_email, send_batch, list_emails, get_delivery_stats
  crawl4ai      → 5 tools:  crawl_url, crawl_batch, extract_article, crawl_site, capture_screenshot
  svg_renderer  → 2 tools:  render_png, composite_layers

Eliminated (Phase 2):
  printify   → Printful only (binding decision)
  delegate   → Replaced by SDK AgentDefinition
  memory     → Replaced by hooks (Stop, PreCompact)

Not MCP connectors (kept as channel adapters):
  telegram   → CEO notification channel (podclaw/connectors/telegram_connector.py)
  whatsapp   → CEO notification channel (podclaw/connectors/whatsapp_connector.py)
"""
