"""
PodClaw — Configuration Constants
===================================

All tunables for the 8 sub-agents, budgets, rate limits, and models.
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
}

# ---------------------------------------------------------------------------
# Daily Budget (USD) per agent
# ---------------------------------------------------------------------------
DEFAULT_DAILY_BUDGET = float(os.environ.get("PODCLAW_DAILY_BUDGET", "5.0"))

AGENT_DAILY_BUDGETS: dict[str, float] = {
    "researcher": 0.50,
    "marketing": 1.00,
    "designer": 1.00,
    "newsletter": 0.80,
    "cataloger": 0.80,
    "customer_manager": 0.60,
    "seo_manager": 0.30,
    "finance": 0.50,
}

# ---------------------------------------------------------------------------
# Rate Limits (per cycle / invocation)
# ---------------------------------------------------------------------------
RATE_LIMITS: dict[str, dict[str, int]] = {
    "researcher": {"web_search": 20},
    "marketing": {"resend_send": 30, "web_search": 10, "telegram_send": 50, "telegram_broadcast": 50, "whatsapp_send": 50},
    "designer": {"fal_generate": 30, "printify_upload_image": 30},
    "newsletter": {"resend_send": 500},
    "cataloger": {"printify_create": 50, "printify_publish": 50, "printify_upload_image": 50, "printify_delete_product": 10},
    "customer_manager": {"resend_send": 100, "stripe_create_refund": 10, "telegram_send": 100, "whatsapp_send": 100},
    "seo_manager": {"web_search": 15},
    "finance": {"stripe_create_refund": 5},
}

# ---------------------------------------------------------------------------
# High-Risk Thresholds (require human approval)
# ---------------------------------------------------------------------------
REFUND_APPROVAL_THRESHOLD = float(os.environ.get("PODCLAW_REFUND_THRESHOLD", "100.0"))
PRICE_CHANGE_MAX_PERCENT = float(os.environ.get("PODCLAW_PRICE_CHANGE_MAX", "20.0"))
BULK_DELETE_THRESHOLD = int(os.environ.get("PODCLAW_BULK_DELETE_THRESHOLD", "10"))

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
# Tool-to-Agent Mapping
# ---------------------------------------------------------------------------
AGENT_TOOLS: dict[str, list[str]] = {
    "researcher": ["supabase", "web_search"],
    "marketing": ["supabase", "web_search", "resend", "telegram", "whatsapp"],
    "designer": ["supabase", "fal", "printify"],
    "newsletter": ["supabase", "resend", "gemini"],
    "cataloger": ["supabase", "printify", "gemini"],
    "customer_manager": ["supabase", "resend", "stripe", "telegram", "whatsapp"],
    "seo_manager": ["supabase", "web_search"],
    "finance": ["supabase", "stripe"],
}

# ---------------------------------------------------------------------------
# Context Files per Agent
# ---------------------------------------------------------------------------
AGENT_CONTEXT_FILES: dict[str, list[str]] = {
    "researcher": ["best_sellers.md", "customer_insights.md"],
    "marketing": ["best_sellers.md", "customer_insights.md", "design_library.md", "marketing_calendar.md"],
    "designer": ["design_library.md", "best_sellers.md"],
    "newsletter": ["customer_insights.md", "marketing_calendar.md", "newsletter_segments.md"],
    "cataloger": ["best_sellers.md", "pricing_history.md"],
    "customer_manager": ["customer_insights.md", "store_config.md"],
    "seo_manager": ["best_sellers.md"],
    "finance": ["pricing_history.md", "store_config.md"],
}
