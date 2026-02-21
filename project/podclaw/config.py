"""
PodClaw — Configuration Constants
===================================

All tunables for the 9 sub-agents, budgets, rate limits, and models.
Environment variables override defaults.
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
MODEL_RESEARCH = os.environ.get("PODCLAW_RESEARCH_MODEL", "claude-haiku-4-5-20251001")
MODEL_COMPLEX = os.environ.get("PODCLAW_COMPLEX_MODEL", "claude-sonnet-4-5-20250929")

AGENT_MODELS: dict[str, str] = {
    "researcher": MODEL_RESEARCH,
    "marketing": MODEL_COMPLEX,
    "designer": MODEL_COMPLEX,
    "newsletter": MODEL_COMPLEX,
    "cataloger": MODEL_COMPLEX,
    "customer_manager": MODEL_COMPLEX,
    "seo_manager": MODEL_RESEARCH,
    "finance": MODEL_COMPLEX,
    "qa_inspector": MODEL_RESEARCH,
}

# ---------------------------------------------------------------------------
# Daily Budget (EUR) per agent
# ---------------------------------------------------------------------------
DEFAULT_DAILY_BUDGET = float(os.environ.get("PODCLAW_DAILY_BUDGET", "5.0"))

AGENT_DAILY_BUDGETS: dict[str, float] = {
    "researcher": 1.50,        # Haiku, 2-3 sessions/day
    "marketing": 2.00,         # Sonnet, content generation
    "designer": 3.00,          # Sonnet, fal.ai adds extra cost
    "newsletter": 1.50,        # Sonnet, email generation
    "cataloger": 15.00,        # Sonnet, heavy batch creation (up to 5 sessions)
    "customer_manager": 2.00,  # Sonnet, support + refunds
    "seo_manager": 1.00,       # Haiku, SEO audit
    "finance": 2.50,           # Sonnet, financial analysis
    "qa_inspector": 0.15,      # Haiku, lightweight verification
}

# ---------------------------------------------------------------------------
# Rate Limits (per cycle / invocation)
# ---------------------------------------------------------------------------
RATE_LIMITS: dict[str, dict[str, int]] = {
    "researcher": {"web_search": 20, "read_url": 15, "expand_query": 5, "jina_rerank": 10, "deduplicate_strings": 5, "parallel_search_web": 3},
    "marketing": {"resend_send": 30, "web_search": 10, "read_url": 5, "search_images": 5, "telegram_send": 50, "telegram_send_photo": 20, "telegram_broadcast": 50, "whatsapp_send": 50},
    "designer": {
        "search_images": 30,           # FREE — primary source, highest limit
        "fal_remove_bg": 30,           # FREE with local rembg
        "gemini_check_image": 30,      # quality gate
        "printify_upload_image": 30, "supabase_upload_image": 30,
        "fal_generate": 10,            # PAID — secondary, reduced limit
        "gemini_generate_image": 2,    # EXPENSIVE — last resort, lowest limit
    },
    "newsletter": {"resend_send": 500},
    "cataloger": {
        "printify_create": 50, "printify_publish": 50, "printify_upload_image": 50,
        "printify_delete_product": 10, "printify_update": 50, "printify_get_blueprint_detail": 50,
        "printify_get_gpsr": 50,
        "printify_list_shops": 2, "printify_get_shop": 2,
        "printify_create_order": 5, "printify_send_to_production": 10, "printify_cancel_order": 5,
        "printify_list_uploads": 5, "printify_unpublish": 10,
        "printify_create_webhook": 3, "printify_delete_webhook": 3, "printify_list_webhooks": 3,
    },
    "customer_manager": {
        "resend_send": 100, "stripe_create_refund": 10,
        "telegram_send": 100, "telegram_send_photo": 20, "whatsapp_send": 100,
        "printify_cancel_order": 5, "printify_send_to_production": 5,
    },
    "seo_manager": {"web_search": 15, "read_url": 10, "jina_rerank": 5, "deduplicate_strings": 3, "capture_screenshot": 3},
    "finance": {"stripe_create_refund": 5},
    "qa_inspector": {
        "gemini_check_image": 20, "printify_list_products": 3, "printify_get_product": 10,
        "printify_list_shops": 1, "printify_get_shop": 1,
        "printify_list_webhooks": 2, "printify_list_uploads": 3,
    },
}

# ---------------------------------------------------------------------------
# High-Risk Thresholds (require human approval)
# ---------------------------------------------------------------------------
REFUND_APPROVAL_THRESHOLD = float(os.environ.get("PODCLAW_REFUND_THRESHOLD", "100.0"))
PRICE_CHANGE_MAX_PERCENT = float(os.environ.get("PODCLAW_PRICE_CHANGE_MAX", "20.0"))
BULK_DELETE_THRESHOLD = int(os.environ.get("PODCLAW_BULK_DELETE_THRESHOLD", "10"))

# ---------------------------------------------------------------------------
# Pricing Configuration
# ---------------------------------------------------------------------------
MINIMUM_MARKUP_MULTIPLIER = float(os.environ.get("PODCLAW_MINIMUM_MARKUP", "1.4"))
ABSOLUTE_MIN_PRICE_CENTS = 299  # EUR 2.99 safety net (when cost unknown)
CONSERVATIVE_INITIAL_PRICE = int(os.environ.get("PODCLAW_CONSERVATIVE_PRICE", "2999"))  # EUR 29.99
PRINTIFY_USD_TO_EUR_RATE = float(os.environ.get("PODCLAW_USD_EUR_RATE", "0.92"))
STRIPE_FEE_PERCENT = float(os.environ.get("PODCLAW_STRIPE_FEE_PERCENT", "2.9"))
STRIPE_FEE_FIXED_CENTS = int(os.environ.get("PODCLAW_STRIPE_FEE_FIXED", "30"))
TARGET_GROSS_MARGIN = float(os.environ.get("PODCLAW_TARGET_GROSS_MARGIN", "40.0"))
TARGET_NET_MARGIN = float(os.environ.get("PODCLAW_TARGET_NET_MARGIN", "30.0"))

# ---------------------------------------------------------------------------
# Max Actions per Cycle (per sub-agent invocation)
# ---------------------------------------------------------------------------
MAX_ACTIONS_PER_CYCLE = int(os.environ.get("PODCLAW_MAX_ACTIONS_PER_CYCLE", "50"))
MAX_TURNS_PER_AGENT = int(os.environ.get("PODCLAW_MAX_TURNS_PER_AGENT", "200"))

# ---------------------------------------------------------------------------
# Memory Retention
# ---------------------------------------------------------------------------
DAILY_LOG_RETENTION_DAYS = 14
WEEKLY_LOG_RETENTION_DAYS = 90

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HARNESS_ROOT = Path(__file__).parent.parent
DEFAULT_WORKSPACE = HARNESS_ROOT / "pod_workspace"

# ---------------------------------------------------------------------------
# rembg Sidecar (local background removal)
# ---------------------------------------------------------------------------
REMBG_URL = os.environ.get("REMBG_URL", "")  # e.g. "http://localhost:7000"

# ---------------------------------------------------------------------------
# CORS (bridge)
# ---------------------------------------------------------------------------
CORS_ORIGINS = os.environ.get(
    "PODCLAW_CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://localhost:5555"
)

# ---------------------------------------------------------------------------
# FastAPI Bridge
# ---------------------------------------------------------------------------
BRIDGE_HOST = os.environ.get("PODCLAW_BRIDGE_HOST", "0.0.0.0")
BRIDGE_PORT = int(os.environ.get("PODCLAW_BRIDGE_PORT", "8000"))

# ---------------------------------------------------------------------------
# Bridge Authentication
# ---------------------------------------------------------------------------
BRIDGE_AUTH_TOKEN = os.environ.get("PODCLAW_BRIDGE_AUTH_TOKEN", "")
BRIDGE_AUTH_ENABLED = os.environ.get("PODCLAW_BRIDGE_AUTH_ENABLED", "true").lower() == "true"
BRIDGE_RATE_LIMIT_MAX = int(os.environ.get("PODCLAW_BRIDGE_RATE_LIMIT_MAX", "10"))
BRIDGE_RATE_LIMIT_WINDOW = int(os.environ.get("PODCLAW_BRIDGE_RATE_LIMIT_WINDOW", "60"))

# ---------------------------------------------------------------------------
# Heartbeat Configuration
# ---------------------------------------------------------------------------
HEARTBEAT_INTERVAL_MINUTES = int(os.environ.get("PODCLAW_HEARTBEAT_INTERVAL", "30"))
HEARTBEAT_ACTIVE_HOURS_START = int(os.environ.get("PODCLAW_HEARTBEAT_ACTIVE_START", "5"))
HEARTBEAT_ACTIVE_HOURS_END = int(os.environ.get("PODCLAW_HEARTBEAT_ACTIVE_END", "23"))
HEARTBEAT_MODEL = os.environ.get("PODCLAW_HEARTBEAT_MODEL", MODEL_RESEARCH)  # Haiku
HEARTBEAT_MAX_TOKENS = int(os.environ.get("PODCLAW_HEARTBEAT_MAX_TOKENS", "1024"))
HEARTBEAT_DEDUP_HOURS = int(os.environ.get("PODCLAW_HEARTBEAT_DEDUP_HOURS", "24"))
HEARTBEAT_ENABLED = os.environ.get("PODCLAW_HEARTBEAT_ENABLED", "true").lower() == "true"

# ---------------------------------------------------------------------------
# Agentic Consolidation
# ---------------------------------------------------------------------------
CONSOLIDATION_MODEL = os.environ.get("PODCLAW_CONSOLIDATION_MODEL", MODEL_COMPLEX)  # Sonnet
CONSOLIDATION_MAX_TOKENS = int(os.environ.get("PODCLAW_CONSOLIDATION_MAX_TOKENS", "2048"))

# ---------------------------------------------------------------------------
# Soul Evolution
# ---------------------------------------------------------------------------
SOUL_EVOLUTION_ENABLED = os.environ.get("PODCLAW_SOUL_EVOLUTION_ENABLED", "true").lower() == "true"
SOUL_MAX_LINES = int(os.environ.get("PODCLAW_SOUL_MAX_LINES", "200"))
SOUL_AUTO_APPROVE = os.environ.get("PODCLAW_SOUL_AUTO_APPROVE", "false").lower() == "true"

# ---------------------------------------------------------------------------
# Admin Notifications
# ---------------------------------------------------------------------------
ADMIN_TELEGRAM_CHAT_ID = os.environ.get("PODCLAW_ADMIN_TELEGRAM_CHAT_ID", "")

# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# ---------------------------------------------------------------------------
# External Service Keys
# ---------------------------------------------------------------------------
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
PRINTIFY_API_TOKEN = os.environ.get("PRINTIFY_API_TOKEN", "")
PRINTIFY_SHOP_ID = os.environ.get("PRINTIFY_SHOP_ID", "")
PRINTIFY_WEBHOOK_ALLOWED_HOSTS: list[str] = [
    h.strip()
    for h in os.environ.get(
        "PODCLAW_WEBHOOK_ALLOWED_HOSTS",
        "localhost,podai.com,www.podai.com,api.podai.com",
    ).split(",")
    if h.strip()
]
FAL_KEY = os.environ.get("FAL_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "noreply@podai.com")
JINA_API_KEY = os.environ.get("JINA_API_KEY", "")

# ---------------------------------------------------------------------------
# Telegram & WhatsApp
# ---------------------------------------------------------------------------
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
WHATSAPP_ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")

# ---------------------------------------------------------------------------
# Drip Sequences (Feature 377, 386)
# ---------------------------------------------------------------------------
DRIP_SEQUENCES: dict[str, list[dict]] = {
    "welcome": [
        {"step": 1, "delay_days": 1, "subject": "Welcome to POD AI!"},
        {"step": 2, "delay_days": 3, "subject": "Our best sellers just for you"},
        {"step": 3, "delay_days": 7, "subject": "Your first purchase awaits"},
    ],
    "post_purchase": [
        {"step": 1, "delay_days": 7, "subject": "How are you enjoying your order?"},
        {"step": 2, "delay_days": 14, "subject": "Share your experience"},
    ],
    "win_back": [
        {"step": 1, "delay_days": 7, "subject": "We miss you!"},
        {"step": 2, "delay_days": 21, "subject": "Exclusive offer inside"},
        {"step": 3, "delay_days": 42, "subject": "One last thing..."},
    ],
}

# ---------------------------------------------------------------------------
# CAN-SPAM Compliance (Feature 388)
# ---------------------------------------------------------------------------
STORE_PHYSICAL_ADDRESS = os.environ.get(
    "STORE_PHYSICAL_ADDRESS",
    "POD AI Store, Friedrichstraße 123, 10117 Berlin, Germany"
)
STORE_SENDER_NAME = os.environ.get("STORE_SENDER_NAME", "POD AI Store")

# ---------------------------------------------------------------------------
# Gemini Embeddings (Feature 384)
# ---------------------------------------------------------------------------
GEMINI_EMBEDDING_MODEL = "text-embedding-004"
GEMINI_EMBEDDING_DIMENSIONS = 768

# ---------------------------------------------------------------------------
# Gemini Image Generation (Designer fallback)
# ---------------------------------------------------------------------------
GEMINI_IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3-pro-image-preview")

# ---------------------------------------------------------------------------
# Per-Session Budget (USD) — SDK max_budget_usd enforcement
# ---------------------------------------------------------------------------
AGENT_BUDGETS: dict[str, float] = {
    "researcher": 0.60,        # Haiku, 10-15 tool calls
    "marketing": 1.00,         # Sonnet, content generation
    "designer": 1.50,          # Sonnet, fal.ai + product creation
    "newsletter": 0.80,        # Sonnet, email generation
    "cataloger": 6.00,         # Sonnet, heavy Printify exploration (batch creation)
    "customer_manager": 1.00,  # Sonnet, support + refunds
    "seo_manager": 0.50,       # Haiku, SEO audit
    "finance": 1.20,           # Sonnet, financial analysis
    "qa_inspector": 0.15,      # Haiku, lightweight design/product verification
}

# ---------------------------------------------------------------------------
# Allowed Built-in Tools per Agent (SDK allowed_tools)
# ---------------------------------------------------------------------------
AGENT_ALLOWED_BUILTINS: dict[str, list[str]] = {
    "researcher": ["Read", "Write", "Grep", "Glob", "WebSearch", "WebFetch"],
    "marketing": ["Read", "Write", "Grep", "Glob"],
    "designer": ["Read", "Write", "Glob"],
    "newsletter": ["Read", "Write", "Grep"],
    "cataloger": ["Read", "Write", "Grep", "Glob"],
    "customer_manager": ["Read", "Write", "Grep"],
    "seo_manager": ["Read", "Grep", "Glob", "WebSearch", "WebFetch"],
    "finance": ["Read", "Write", "Grep", "Glob"],
    "qa_inspector": ["Read", "Write", "Glob"],
}

# ---------------------------------------------------------------------------
# Output Schemas for Structured Reports (SDK output_format)
# ---------------------------------------------------------------------------
AGENT_OUTPUT_SCHEMAS: dict[str, dict] = {
    "finance": {
        "type": "object",
        "properties": {
            "daily_revenue_eur": {"type": "number"},
            "orders_count": {"type": "integer"},
            "anomalies": {"type": "array", "items": {"type": "string"}},
            "recommendations": {"type": "array", "items": {"type": "string"}},
        },
    },
    "researcher": {
        "type": "object",
        "properties": {
            "trends": {"type": "array", "items": {"type": "string"}},
            "opportunities": {"type": "array", "items": {"type": "string"}},
            "threats": {"type": "array", "items": {"type": "string"}},
        },
    },
}

# ---------------------------------------------------------------------------
# Tool-to-Agent Mapping
# ---------------------------------------------------------------------------
AGENT_TOOLS: dict[str, list[str]] = {
    "researcher": ["supabase", "jina"],
    "marketing": ["supabase", "jina", "resend", "telegram", "whatsapp"],
    "designer": ["supabase", "fal", "printify", "jina", "gemini"],
    "newsletter": ["supabase", "resend", "gemini"],
    "cataloger": ["supabase", "printify", "gemini"],
    "customer_manager": ["supabase", "resend", "stripe", "telegram", "whatsapp", "printify"],
    "seo_manager": ["supabase", "jina"],
    "finance": ["supabase", "stripe"],
    "qa_inspector": ["supabase", "gemini", "printify"],
}

# ---------------------------------------------------------------------------
# Context Files per Agent
# ---------------------------------------------------------------------------
AGENT_CONTEXT_FILES: dict[str, list[str]] = {
    "researcher": ["best_sellers.md", "customer_insights.md", "pricing_history.md"],
    "marketing": ["best_sellers.md", "customer_insights.md", "design_library.md", "marketing_calendar.md"],
    "designer": ["design_library.md", "best_sellers.md", "product_specs.md", "design_workflow.md"],
    "newsletter": ["customer_insights.md", "marketing_calendar.md", "newsletter_segments.md"],
    "cataloger": ["best_sellers.md", "pricing_history.md", "product_specs.md", "product_workflow.md", "design_library.md"],
    "customer_manager": ["customer_insights.md", "store_config.md"],
    "seo_manager": ["best_sellers.md"],
    "finance": ["pricing_history.md", "store_config.md"],
    "qa_inspector": ["design_library.md", "qa_report.md", "last_session_feedback.md"],
}

# ---------------------------------------------------------------------------
# Catalog Files per Agent (READ-ONLY reference — EU products & pricing)
# Catalog lives in podclaw/catalog/ and is admin-maintained (not agent-writable)
# ---------------------------------------------------------------------------
AGENT_CATALOG_FILES: dict[str, list[str]] = {
    "cataloger": [
        "INDEX.md", "PRICING-MODEL.md",
        "01-camisetas.md", "02-sudaderas-hoodies.md", "03-gorras-sombreros.md",
        "05-tazas-drinkware.md", "09-tote-bags-accesorios.md", "10-arte-decoracion.md",
    ],
    "designer": ["INDEX.md", "PRICING-MODEL.md"],
    "qa_inspector": ["INDEX.md", "PRICING-MODEL.md"],
    "finance": ["INDEX.md", "PRICING-MODEL.md"],
    "researcher": ["INDEX.md", "11-trending-unsaturated.md"],
    "marketing": ["INDEX.md"],
}

# ---------------------------------------------------------------------------
# Context File Rotation Limits (max lines before archiving old content)
# ---------------------------------------------------------------------------
CONTEXT_FILE_MAX_LINES: dict[str, int] = {
    "pricing_history.md": 200,
    "design_library.md": 150,
    "best_sellers.md": 150,
    "customer_insights.md": 100,
    "marketing_calendar.md": 100,
    "newsletter_segments.md": 80,
}
