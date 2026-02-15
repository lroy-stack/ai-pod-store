# PodClaw — MCP Connector Reference

PodClaw uses 11 MCP connectors exposing tools to sub-agents. Each connector is an in-process Python class converted to SDK MCP servers via `connector_adapter.py`.

## Connector Overview

| Connector | File | Agent(s) | Description |
|-----------|------|----------|-------------|
| supabase | `mcp/supabase_connector.py` | all | Database operations (PostgreSQL) |
| stripe | `mcp/stripe_connector.py` | finance, customer_manager | Payment processing |
| printify | `mcp/printify_connector.py` | cataloger, designer | POD fulfillment |
| fal | `mcp/fal_connector.py` | designer | AI image generation (FLUX.1) |
| gemini | `mcp/gemini_connector.py` | cataloger, newsletter | Text embeddings |
| resend | `mcp/resend_connector.py` | newsletter, marketing, customer_manager | Transactional email |
| jina | `mcp/jina_connector.py` | cataloger | Search reranking |
| web_search | `mcp/web_search_connector.py` | researcher, seo_manager | Web search |
| telegram | `mcp/telegram_connector.py` | marketing, customer_manager | Telegram messaging |
| whatsapp | `mcp/whatsapp_connector.py` | marketing, customer_manager | WhatsApp messaging |

## Tool Details

### supabase

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `supabase_query` | SELECT query with filters | — |
| `supabase_insert` | INSERT rows | — |
| `supabase_update` | UPDATE rows with filters | — |
| `supabase_delete` | DELETE rows with filters | — |
| `supabase_rpc` | Call stored procedure/function | — |

**Config**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

### stripe

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `stripe_get_balance` | Get current Stripe balance | — |
| `stripe_list_charges` | List recent charges | — |
| `stripe_list_refunds` | List recent refunds | — |
| `stripe_create_refund` | Create a refund | finance: 5, customer_manager: 10 |
| `stripe_get_charge` | Get charge details | — |

**Config**: `STRIPE_SECRET_KEY`
**Escalation**: Refunds > EUR 100 require admin approval

### printify

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `printify_list_products` | List products in shop | — |
| `printify_get_product` | Get product details | — |
| `printify_create_product` | Create new product | cataloger: 50 |
| `printify_update_product` | Update product details | — |
| `printify_publish_product` | Publish to sales channel | cataloger: 50 |
| `printify_delete_product` | Delete a product | cataloger: 10 |
| `printify_upload_image` | Upload image for product | designer: 30, cataloger: 50 |
| `printify_list_blueprints` | List available blueprints | — |
| `printify_sync_catalog` | Sync catalog with database | — |

**Config**: `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`
**Escalation**: Bulk deletes > 10 items require admin approval

### fal

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `fal_generate_image` | Generate image via FLUX.1 | designer: 30 |
| `fal_upscale` | Upscale an image | — |
| `fal_remove_bg` | Remove image background | — |

**Config**: `FAL_KEY`
**Cost note**: Image generation is expensive — designer has highest per-session budget ($0.80)

### gemini

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `gemini_embed_text` | Embed single text | — |
| `gemini_embed_batch` | Embed multiple texts | — |

**Config**: `GEMINI_API_KEY`
**Model**: `text-embedding-004` (768 dimensions)

### resend

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `resend_send_email` | Send transactional email | newsletter: 500, marketing: 30, customer_manager: 100 |
| `resend_create_campaign` | Create email campaign | — |
| `resend_get_stats` | Get email delivery stats | — |

**Config**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (default: noreply@podai.com)
**Compliance**: CAN-SPAM compliant with physical address footer

### jina

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `jina_rerank` | Rerank search results | — |

**Config**: `JINA_API_KEY`

### web_search

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `web_search_search` | Search the web | researcher: 20, seo_manager: 15, marketing: 10 |

**Config**: `JINA_API_KEY` (shares Jina key)

### telegram

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `telegram_send_message` | Send message to chat | marketing: 50, customer_manager: 100 |
| `telegram_broadcast` | Broadcast to subscribers | marketing: 50 |
| `telegram_get_updates` | Get recent messages | — |

**Config**: `TELEGRAM_BOT_TOKEN`

### whatsapp

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `whatsapp_send_message` | Send WhatsApp message | marketing: 50, customer_manager: 100 |
| `whatsapp_send_template` | Send template message | — |

**Config**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

## Adding a New Connector

1. Create `mcp/<name>_connector.py` implementing:
   ```python
   class MyConnector:
       def __init__(self, api_key: str):
           self.api_key = api_key

       def get_tools(self) -> dict[str, dict]:
           return {
               "my_tool": {
                   "description": "What the tool does",
                   "input_schema": {
                       "type": "object",
                       "properties": {...},
                       "required": [...]
                   },
                   "handler": self._handle_my_tool,
               }
           }

       async def _handle_my_tool(self, params: dict) -> dict:
           # Implementation
           return {"result": "..."}
   ```

2. Register in `main.py` → `_build_connectors()`:
   ```python
   from podclaw.mcp.my_connector import MyConnector
   connectors["my_name"] = MyConnector(config.MY_API_KEY)
   ```

3. Add to `config.py`:
   - API key: `MY_API_KEY = os.environ.get("MY_API_KEY", "")`
   - Agent mapping: add to `AGENT_TOOLS`
   - Rate limits: add to `RATE_LIMITS`

4. The `connector_adapter.py` automatically converts it to an SDK MCP server.

## SDK Tool Name Format

When tools are registered with the SDK, they follow the naming pattern:
```
mcp__{connector_name}__{tool_name}
```

For example:
- `mcp__stripe__stripe_create_refund`
- `mcp__supabase__supabase_query`
- `mcp__fal__fal_generate_image`

This naming is important when configuring `allowed_tools` in the SDK client.
