# PodClaw — MCP Connector Reference

PodClaw uses 9 MCP connectors exposing tools to sub-agents. Each connector is an in-process Python class converted to SDK MCP servers via `connector_adapter.py`.

## Connector Overview

| Connector | File | Agent(s) | Description |
|-----------|------|----------|-------------|
| supabase | `connectors/supabase_connector.py` | all | Database operations (PostgreSQL) |
| stripe | `connectors/stripe_connector.py` | finance, customer_manager | Payment processing |
| printify | `connectors/printify_connector.py` | cataloger, designer | POD fulfillment |
| fal | `connectors/fal_connector.py` | designer | AI image generation (FLUX.1) |
| gemini | `connectors/gemini_connector.py` | cataloger, newsletter | Text embeddings |
| resend | `connectors/resend_connector.py` | newsletter, marketing, customer_manager | Transactional email |
| crawl4ai | `connectors/crawl4ai_connector.py` | researcher, marketing, seo_manager | Web crawling with JavaScript rendering, screenshots |
| telegram | `connectors/telegram_connector.py` | marketing, customer_manager | Telegram messaging |
| whatsapp | `connectors/whatsapp_connector.py` | marketing, customer_manager | WhatsApp messaging |

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

### crawl4ai

| Tool | Description | Rate Limit |
|------|-------------|------------|
| `crawl_url` | Crawl a single URL with JavaScript rendering and extract content | researcher: 15, seo_manager: 10, marketing: 5 |
| `crawl_batch` | Crawl multiple URLs in parallel (max 10 per batch) | researcher: 5 |
| `extract_article` | Extract article content using heuristics | researcher: 15, seo_manager: 10, marketing: 5 |
| `crawl_site` | Recursively crawl a website (respects robots.txt) | researcher: 3, seo_manager: 2 |
| `capture_screenshot` | Capture webpage screenshot as base64 PNG | seo_manager: 5 |

**Config**: `CRAWL4AI_URL` (default: `http://crawl4ai:11235`)
**Cost note**: Crawl4AI is self-hosted with no API costs (free)

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

## RAG Decision Framework

PodClaw uses three main strategies for retrieving and generating content based on data characteristics. Choose the right approach based on data structure, size, and update frequency.

### 1. SQL Direct Queries (Structured Data)

**When to use:**
- Data is highly structured and relational (products, prices, inventory, orders, customers)
- Need exact, real-time data with ACID guarantees
- Data size < 100K rows per table (typical for most ecommerce catalogs)
- Query patterns are predictable (filtering, sorting, aggregation)

**Examples:**
- "List all products in the t-shirt category with price < EUR 30"
- "Get the top 10 customers by total order value this month"
- "Find all pending orders for user ID 123"
- "Calculate average product rating by category"

**How:**
Use the `supabase_query` tool with SQL filters:
```python
result = await supabase_query(
    table="products",
    select="id,name,price,category",
    filters={"category": "eq.t-shirts", "price": "lt.30"},
    order_by="price.asc",
    limit=20
)
```

**Advantages:**
- Fastest retrieval (milliseconds)
- No preprocessing or embedding costs
- Always up-to-date (no stale cache)
- Supports complex joins and aggregations

**Limitations:**
- Requires schema knowledge
- Not suitable for unstructured text search
- Limited to exact and range matches (no semantic similarity)

---

### 2. CAG (Context-Augmented Generation) with Static Content

**When to use:**
- Content is static or semi-static (FAQ, policies, product guides, brand voice)
- Total content size < 200K tokens (~800 pages)
- Content rarely changes (weekly/monthly updates)
- Need deterministic, fast retrieval without vector search overhead

**Examples:**
- "Answer customer question using our FAQ knowledge base"
- "Generate product description following brand voice guidelines"
- "Explain our return policy for EU customers"
- "Write email using our tone-of-voice document"

**How:**
Load static content into the agent's system prompt or context window:
```python
# In agent initialization
faq_content = load_static_content("context/faq.md")
brand_voice = load_static_content("context/brand_voice.md")

system_prompt = f"""
You are PodClaw, an AI assistant for our print-on-demand store.

{faq_content}

{brand_voice}

Use the FAQ to answer customer questions. Follow the brand voice for all responses.
"""
```

**Advantages:**
- No embedding or indexing required (zero cost)
- Deterministic retrieval (always includes the same content)
- No latency from vector search
- Works well with Claude's 200K context window

**Limitations:**
- Limited to ~200K tokens (API limit)
- All content is passed on every request (higher input token cost)
- Not suitable for frequently changing content
- No ranking by relevance (all content is equal weight)

---

### 3. RAG (Retrieval-Augmented Generation) with Dynamic Datasets

**When to use:**
- Dataset is large and dynamic (> 500 documents or > 200K tokens)
- Content changes frequently (daily updates)
- Need semantic search across unstructured text (blog posts, reviews, manuals)
- Only a small subset of content is relevant per query

**Examples:**
- "Find similar products to this one based on customer reviews"
- "Search blog posts about sustainable fashion trends"
- "Answer question using our 1,000+ product manuals"
- "Find relevant customer testimonials for marketing campaign"

**How:**
Use embedding + vector search pipeline:
1. **Index content** (one-time or periodic):
   ```python
   # Use crawl4ai to fetch content
   result = await crawl_url(url="https://example.com/blog")

   # Chunk content (400-512 tokens per chunk)
   chunks = chunk_text(result["content"], max_tokens=512, overlap=50)

   # Generate embeddings via Gemini
   embeddings = await gemini_embed_batch(texts=chunks)

   # Store in Supabase with pgvector
   for chunk, embedding in zip(chunks, embeddings):
       await supabase_insert(
           table="rag_documents",
           data={
               "content": chunk,
               "embedding": embedding,
               "source_url": url,
               "indexed_at": "now()"
           }
       )
   ```

2. **Query at runtime**:
   ```python
   # Embed user query
   query_embedding = await gemini_embed_text(text=user_query)

   # Vector similarity search (pgvector)
   results = await supabase_rpc(
       function="search_documents",
       params={
           "query_embedding": query_embedding,
           "match_threshold": 0.75,
           "match_count": 5
       }
   )

   # Pass top results to LLM as context
   context = "\n\n".join([r["content"] for r in results])
   answer = generate_answer(query=user_query, context=context)
   ```

**Advantages:**
- Scales to millions of documents
- Semantic search finds conceptually similar content
- Only retrieves relevant chunks (saves tokens)
- Supports frequent updates via reindexing

**Limitations:**
- Requires preprocessing (chunking + embedding)
- Embedding costs (Gemini free tier: 1,500 requests/day)
- Potential for stale data between reindex cycles
- More complex pipeline (crawl → chunk → embed → index → query)

---

### Decision Tree

```
Is the data structured and relational?
├─ YES → Use SQL direct queries
└─ NO → Is the content size < 200K tokens?
    ├─ YES → Use CAG (context injection)
    └─ NO → Use RAG (embedding + vector search)
```

### Real-World Example: Product Recommendations

**Scenario**: Customer asks "Show me eco-friendly t-shirts under EUR 25"

**Approach**:
1. **SQL** for filtering structured product catalog:
   ```sql
   SELECT * FROM products
   WHERE category = 't-shirts'
     AND tags @> '["eco-friendly"]'
     AND price < 25
   ORDER BY rating DESC
   LIMIT 10
   ```

2. **CAG** for response tone using brand voice (static):
   - Load brand_voice.md into system prompt
   - LLM generates response with brand personality

3. **RAG** (optional) for enrichment:
   - Vector search reviews mentioning "eco-friendly" + "comfortable"
   - Include top 3 customer testimonials in response

This hybrid approach gives the best results: **SQL for precision, CAG for consistency, RAG for enrichment**.

---

## Adding a New Connector

1. Create `connectors/<name>_connector.py` implementing:
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
   from podclaw.connectors.my_connector import MyConnector
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
