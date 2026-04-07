# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw v2 — Configuration Constants
======================================

7 autonomous agents, Printful-only, event-driven.
No Printify. No cron schedules. No Telegram/WhatsApp as agent tools.

Environment variables override defaults.
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
MODEL_RESEARCH = os.environ.get("PODCLAW_RESEARCH_MODEL", "claude-haiku-4-5-20251001")
MODEL_COMPLEX = os.environ.get("PODCLAW_COMPLEX_MODEL", "claude-sonnet-4-5-20250929")

# ---------------------------------------------------------------------------
# Agent Roster — 7 agents (down from 10)
# ---------------------------------------------------------------------------
AGENT_NAMES: list[str] = [
    "researcher",
    "designer",
    "cataloger",
    "qa_inspector",
    "marketing",
    "customer_support",
    "finance",
]

AGENT_MODELS: dict[str, str] = {
    "researcher":       MODEL_RESEARCH,  # Haiku — read-heavy, summarization
    "designer":         MODEL_COMPLEX,   # Sonnet — creative + technical
    "cataloger":        MODEL_COMPLEX,   # Sonnet — complex API orchestration
    "qa_inspector":     MODEL_COMPLEX,   # Sonnet — judgment on quality (upgraded from Haiku)
    "marketing":        MODEL_COMPLEX,   # Sonnet — content generation (absorbed newsletter + brand_manager)
    "customer_support":  MODEL_COMPLEX,   # Sonnet — empathy + precision (renamed from customer_manager)
    "finance":          MODEL_RESEARCH,  # Haiku — data extraction + calculation (downgraded from Sonnet)
}

# ---------------------------------------------------------------------------
# Orchestrator Configuration
# ---------------------------------------------------------------------------
ORCHESTRATOR_MODEL = os.environ.get("PODCLAW_ORCHESTRATOR_MODEL", MODEL_COMPLEX)
ORCHESTRATOR_SESSION_BUDGET_USD = float(os.environ.get("PODCLAW_ORCHESTRATOR_SESSION_BUDGET", "5.00"))
ORCHESTRATOR_DAILY_BUDGET_EUR = float(os.environ.get("PODCLAW_ORCHESTRATOR_DAILY_BUDGET", "5.00"))
ORCHESTRATOR_MAX_TURNS = int(os.environ.get("PODCLAW_ORCHESTRATOR_MAX_TURNS", "200"))
ORCHESTRATOR_IDLE_TIMEOUT_SECONDS = int(os.environ.get("PODCLAW_ORCHESTRATOR_IDLE_TIMEOUT", "1800"))
ORCHESTRATOR_BUILTINS: list[str] = ["Read", "Write", "Edit"]
ORCHESTRATOR_ALL_CONNECTORS: list[str] = [
    "supabase", "stripe", "printful", "fal",
    "gemini", "resend", "crawl4ai", "svg_renderer",
    "memory_search",
]

# ---------------------------------------------------------------------------
# Identity Files (loaded into orchestrator system prompt)
# ---------------------------------------------------------------------------
IDENTITY_FILES: dict[str, str] = {
    "soul": "podclaw/SOUL.md",
    "ceo": "podclaw/CEO.md",
    "heartbeat": "podclaw/HEARTBEAT.md",
    "memory": "podclaw/memory/MEMORY.md",
}

# System prompt token budgets (reference — from MEMORY_IDENTITY_DEFINITION.md Section 3)
PROMPT_TOKEN_BUDGETS: dict[str, int] = {
    "orchestrator": 3350,  # SOUL + CEO + HEARTBEAT + MEMORY + daily log + manifests
    "sub_agent": 3350,     # ROLE + task skill + reference + context injection
    "heartbeat": 750,      # HEARTBEAT + daily tail + event queue + health
}

# Daily log tail lines for orchestrator prompt
DAILY_LOG_TAIL_LINES = 50

# ---------------------------------------------------------------------------
# Per-Session Budget — SDK max_budget_usd enforcement (HARD CAP)
# Values in USD as required by Claude Agent SDK.
# Separate from AGENT_DAILY_BUDGETS (EUR, soft cap via cost_guard_hook).
# ---------------------------------------------------------------------------
AGENT_BUDGETS_USD: dict[str, float] = {
    "researcher":       0.60,   # Haiku, 10-15 tool calls
    "designer":         1.50,   # Sonnet, fal.ai adds ~$0.03-0.10/image
    "cataloger":        5.00,   # Sonnet, heavy Printful API interaction (10-20 calls/product)
    "qa_inspector":     0.50,   # Sonnet, 5-10 checks per product
    "marketing":        1.00,   # Sonnet, content generation + optional image/video
    "customer_support":  0.80,   # Sonnet, 5-10 emails per session
    "finance":          0.40,   # Haiku, data extraction + calculation
}

# Backwards compat alias
AGENT_BUDGETS = AGENT_BUDGETS_USD

# ---------------------------------------------------------------------------
# Daily Budget (EUR) per agent — soft cap via cost_guard_hook + Redis
# ---------------------------------------------------------------------------
DEFAULT_DAILY_BUDGET = float(os.environ.get("PODCLAW_DAILY_BUDGET", "5.0"))
GLOBAL_DAILY_SPEND_LIMIT_EUR = float(os.environ.get("PODCLAW_GLOBAL_DAILY_SPEND_LIMIT", "30.0"))

AGENT_DAILY_BUDGETS: dict[str, float] = {
    "researcher":       1.50,   # 2-3 sessions/day
    "designer":         3.00,   # 2 sessions/day
    "cataloger":        12.00,  # Largest budget — most API-intensive
    "qa_inspector":     1.50,   # 2-3 sessions/day
    "marketing":        2.50,   # Absorbs newsletter (1.50) + brand_manager (1.50)
    "customer_support":  2.00,   # 2-3 sessions/day
    "finance":          1.00,   # 1-2 sessions/day
}
# Total: EUR 23.50 (under EUR 30 cap) — orchestrator has separate EUR 5.00

# ---------------------------------------------------------------------------
# Tool-to-Agent Mapping — Printful only, no Printify, no TG/WA agent tools
# ---------------------------------------------------------------------------
AGENT_TOOLS: dict[str, list[str]] = {
    "researcher":       ["supabase", "crawl4ai"],
    "designer":         ["supabase", "fal", "printful", "crawl4ai", "gemini", "svg_renderer", "rembg"],
    "cataloger":        ["supabase", "printful", "gemini"],
    "qa_inspector":     ["supabase", "printful", "gemini"],
    "marketing":        ["supabase", "crawl4ai", "resend", "gemini"],
    "customer_support":  ["supabase", "resend", "stripe"],
    "finance":          ["supabase", "stripe"],
}

# ---------------------------------------------------------------------------
# Allowed Built-in Tools per Agent (SDK allowed_tools)
# ---------------------------------------------------------------------------
AGENT_ALLOWED_BUILTINS: dict[str, list[str]] = {
    "researcher":       ["Read", "Write", "Grep", "Glob", "WebSearch", "WebFetch"],
    "designer":         ["Read", "Write", "Glob"],
    "cataloger":        ["Read", "Write", "Grep", "Glob"],
    "qa_inspector":     ["Read", "Write", "Glob"],
    "marketing":        ["Read", "Write", "Grep", "Glob"],
    "customer_support":  ["Read", "Write", "Grep"],
    "finance":          ["Read", "Write", "Grep", "Glob"],
}

# ---------------------------------------------------------------------------
# Rate Limits (per session / invocation) — Printful only
# ---------------------------------------------------------------------------
RATE_LIMITS: dict[str, dict[str, int]] = {
    "researcher": {
        "crawl_url": 15, "extract_article": 10, "crawl_batch": 2, "capture_screenshot": 5,
    },
    "designer": {
        "fal_remove_background": 30,
        "fal_upscale_image": 15,
        "fal_generate_image": 10,
        "gemini_check_image_quality": 30,
        "gemini_generate_image": 2,
        "svg_render": 20,
        "supabase_upload_image": 30,
        "printful_upload_file": 30,
        "crawl_url": 5, "capture_screenshot": 5,
    },
    "cataloger": {
        "printful_create_product": 50, "printful_update_product": 50,
        "printful_delete_product": 10,
        "printful_list_products": 10, "printful_get_product": 50,
        "printful_upload_file": 50, "printful_get_file": 50,
        "printful_create_mockup_task": 30, "printful_get_mockup_result": 50,
        "printful_create_order": 5, "printful_cancel_order": 5, "printful_get_order": 10,
        "printful_calculate_shipping": 10,
        "printful_get_catalog": 5, "printful_get_catalog_product": 50, "printful_get_printfiles": 50,
        "printful_list_webhooks": 3, "printful_setup_webhook": 3,
        "supabase_insert": 50,
    },
    "qa_inspector": {
        "gemini_check_image_quality": 20,
        "printful_get_product": 10, "printful_list_products": 3,
    },
    "marketing": {
        "resend_send_email": 30, "resend_send_batch": 500,
        "fal_generate_image": 5, "gemini_check_image_quality": 10,
        "crawl_url": 10, "extract_article": 5, "capture_screenshot": 3,
    },
    "customer_support": {
        "resend_send_email": 100,
        "stripe_create_refund": 10,
        "printful_get_order": 20,
    },
    "finance": {
        "stripe_list_charges": 20, "stripe_get_balance": 5,
        "supabase_query": 30,
    },
}

# ---------------------------------------------------------------------------
# High-Risk Thresholds (require human approval)
# ---------------------------------------------------------------------------
REFUND_APPROVAL_THRESHOLD = float(os.environ.get("PODCLAW_REFUND_THRESHOLD", "25.0"))
DAILY_REFUND_LIMIT_EUR = float(os.environ.get("PODCLAW_DAILY_REFUND_LIMIT", "150.0"))
PRICE_CHANGE_MAX_PERCENT = float(os.environ.get("PODCLAW_PRICE_CHANGE_MAX", "20.0"))
BULK_DELETE_THRESHOLD = int(os.environ.get("PODCLAW_BULK_DELETE_THRESHOLD", "10"))

# ---------------------------------------------------------------------------
# Pricing Configuration
# ---------------------------------------------------------------------------
USD_TO_EUR_RATE = float(os.environ.get("PODCLAW_USD_TO_EUR_RATE", "0.92"))
PRINTIFY_USD_TO_EUR_RATE = USD_TO_EUR_RATE  # backward compat alias
MINIMUM_MARKUP_MULTIPLIER = float(os.environ.get("PODCLAW_MINIMUM_MARKUP", "1.4"))
ABSOLUTE_MIN_PRICE_CENTS = 299  # EUR 2.99 safety net (when cost unknown)
CONSERVATIVE_INITIAL_PRICE = int(os.environ.get("PODCLAW_CONSERVATIVE_PRICE", "2999"))  # EUR 29.99
STRIPE_FEE_PERCENT = float(os.environ.get("PODCLAW_STRIPE_FEE_PERCENT", "2.9"))
STRIPE_FEE_FIXED_CENTS = int(os.environ.get("PODCLAW_STRIPE_FEE_FIXED", "30"))
TARGET_GROSS_MARGIN = float(os.environ.get("PODCLAW_TARGET_GROSS_MARGIN", "40.0"))
TARGET_NET_MARGIN = float(os.environ.get("PODCLAW_TARGET_NET_MARGIN", "30.0"))

# ---------------------------------------------------------------------------
# Max Actions per Cycle (per sub-agent invocation)
# ---------------------------------------------------------------------------
MAX_ACTIONS_PER_CYCLE = int(os.environ.get("PODCLAW_MAX_ACTIONS_PER_CYCLE", "50"))
MAX_TURNS_PER_AGENT = int(os.environ.get("PODCLAW_MAX_TURNS_PER_AGENT", "200"))
MAX_SESSION_DURATION_SECONDS = int(os.environ.get("PODCLAW_MAX_SESSION_DURATION", "900"))

# ---------------------------------------------------------------------------
# Memory Retention
# ---------------------------------------------------------------------------
DAILY_LOG_RETENTION_DAYS = 14
WEEKLY_LOG_RETENTION_DAYS = 90

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).parent.parent

# ---------------------------------------------------------------------------
# rembg Sidecar (local background removal)
# ---------------------------------------------------------------------------
REMBG_URL = os.environ.get("REMBG_URL", "")

# ---------------------------------------------------------------------------
# Crawl4AI Service (web crawling with JS rendering)
# ---------------------------------------------------------------------------
CRAWL4AI_URL = os.environ.get("CRAWL4AI_URL", "http://crawl4ai:11235")

# ---------------------------------------------------------------------------
# SVG Rendering Sidecar
# ---------------------------------------------------------------------------
SVG_RENDERER_URL = os.environ.get("SVG_RENDERER_URL", "http://svg-renderer:3002")

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
BRIDGE_AUTH_ENABLED = os.environ.get("PODCLAW_BRIDGE_AUTH_ENABLED", "true").lower() != "false"
if BRIDGE_AUTH_ENABLED and not BRIDGE_AUTH_TOKEN:
    import sys
    print(
        "FATAL: PODCLAW_BRIDGE_AUTH_ENABLED=true but PODCLAW_BRIDGE_AUTH_TOKEN is empty. "
        "Set PODCLAW_BRIDGE_AUTH_TOKEN or disable auth with PODCLAW_BRIDGE_AUTH_ENABLED=false.",
        file=sys.stderr,
    )
    sys.exit(1)
BRIDGE_RATE_LIMIT_MAX = int(os.environ.get("PODCLAW_BRIDGE_RATE_LIMIT_MAX", "10"))
BRIDGE_RATE_LIMIT_WINDOW = int(os.environ.get("PODCLAW_BRIDGE_RATE_LIMIT_WINDOW", "60"))

# ---------------------------------------------------------------------------
# Pipeline Engine (Phase 3)
# ---------------------------------------------------------------------------
PIPELINE_REVIEW_MODEL = os.environ.get("PODCLAW_PIPELINE_REVIEW_MODEL", MODEL_RESEARCH)
PIPELINE_STEP_TIMEOUT_DEFAULT = int(os.environ.get("PODCLAW_PIPELINE_STEP_TIMEOUT", "600"))
PIPELINE_CEO_APPROVAL_TIMEOUT_HOURS = int(os.environ.get("PODCLAW_PIPELINE_APPROVAL_TIMEOUT", "4"))
HEARTBEAT_WRITEBACK_ENABLED = os.environ.get("PODCLAW_HEARTBEAT_WRITEBACK", "true").lower() == "true"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# ---------------------------------------------------------------------------
# Heartbeat Configuration
# ---------------------------------------------------------------------------
HEARTBEAT_INTERVAL_MINUTES = int(os.environ.get("PODCLAW_HEARTBEAT_INTERVAL", "30"))
HEARTBEAT_ACTIVE_HOURS_START = int(os.environ.get("PODCLAW_HEARTBEAT_ACTIVE_START", "5"))
HEARTBEAT_ACTIVE_HOURS_END = int(os.environ.get("PODCLAW_HEARTBEAT_ACTIVE_END", "23"))
HEARTBEAT_MODEL = os.environ.get("PODCLAW_HEARTBEAT_MODEL", MODEL_RESEARCH)
HEARTBEAT_MAX_TOKENS = int(os.environ.get("PODCLAW_HEARTBEAT_MAX_TOKENS", "1024"))
HEARTBEAT_DEDUP_HOURS = int(os.environ.get("PODCLAW_HEARTBEAT_DEDUP_HOURS", "24"))
HEARTBEAT_ENABLED = os.environ.get("PODCLAW_HEARTBEAT_ENABLED", "true").lower() == "true"

# ---------------------------------------------------------------------------
# Agentic Consolidation
# ---------------------------------------------------------------------------
CONSOLIDATION_MODEL = os.environ.get("PODCLAW_CONSOLIDATION_MODEL", MODEL_COMPLEX)
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
# External Service Keys — Printful only (no Printify)
# ---------------------------------------------------------------------------
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
PRINTFUL_API_TOKEN = os.environ.get("PRINTFUL_API_TOKEN", "")
PRINTFUL_STORE_ID = os.environ.get("PRINTFUL_STORE_ID", "")
PRINTFUL_WEBHOOK_SECRET = os.environ.get("PRINTFUL_WEBHOOK_SECRET", "")
_store_domain = os.environ.get("STORE_DOMAIN", "localhost")
BRAND_NAME = os.environ.get("BRAND_NAME", os.environ.get("NEXT_PUBLIC_SITE_NAME", "My Store"))
WEBHOOK_ALLOWED_HOSTS: list[str] = [
    h.strip()
    for h in os.environ.get(
        "PODCLAW_WEBHOOK_ALLOWED_HOSTS",
        f"localhost,{_store_domain},www.{_store_domain},api.{_store_domain}",
    ).split(",")
    if h.strip()
]
FAL_KEY = os.environ.get("FAL_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", f"{os.environ.get('STORE_SENDER_NAME', 'My Store')} <hello@{_store_domain}>")
RESEND_WEBHOOK_SECRET = os.environ.get("RESEND_WEBHOOK_SECRET", "")
EMAIL_WORKER_SECRET = os.environ.get("EMAIL_WORKER_SECRET", "")

# ---------------------------------------------------------------------------
# Telegram & WhatsApp — CEO communication channels (NOT agent tools)
# ---------------------------------------------------------------------------
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
WHATSAPP_ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_APP_SECRET = os.environ.get("WHATSAPP_APP_SECRET", "")
WHATSAPP_WEBHOOK_VERIFY_TOKEN = os.environ.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")

# ---------------------------------------------------------------------------
# CEO Identity (event-driven gateway)
# ---------------------------------------------------------------------------
CEO_WHATSAPP_NUMBER = os.environ.get("CEO_WHATSAPP_NUMBER", "")
CEO_TELEGRAM_CHAT_ID = os.environ.get("CEO_TELEGRAM_CHAT_ID", "")

# ---------------------------------------------------------------------------
# Context Files per Agent
# ---------------------------------------------------------------------------
AGENT_CONTEXT_FILES: dict[str, list[str]] = {
    "researcher":       ["store_config.md", "seasonal_calendar.md", "best_sellers.md", "product_scorecard.md"],
    "designer":         ["store_config.md", "design_library.md", "best_sellers.md"],
    "cataloger":        ["store_config.md", "best_sellers.md", "pricing_history.md", "product_scorecard.md", "design_library.md"],
    "qa_inspector":     ["design_library.md", "qa_report.md", "product_scorecard.md"],
    "marketing":        ["best_sellers.md", "customer_insights.md", "marketing_calendar.md", "newsletter_segments.md", "store_config.md"],
    "customer_support":  ["customer_insights.md", "store_config.md"],
    "finance":          ["pricing_history.md", "store_config.md", "product_scorecard.md"],
}

# ---------------------------------------------------------------------------
# Catalog Files per Agent (READ-ONLY reference — EU products & pricing)
# ---------------------------------------------------------------------------
AGENT_CATALOG_FILES: dict[str, list[str]] = {
    "cataloger":        [
        "INDEX.md", "PRICING-MODEL.md",
        "01-camisetas.md", "02-sudaderas-hoodies.md", "03-gorras-sombreros.md",
        "05-tazas-drinkware.md", "09-tote-bags-accesorios.md", "10-arte-decoracion.md",
    ],
    "designer":         ["INDEX.md", "PRICING-MODEL.md"],
    "qa_inspector":     ["INDEX.md", "PRICING-MODEL.md"],
    "finance":          ["INDEX.md", "PRICING-MODEL.md"],
    "researcher":       ["INDEX.md", "11-trending-unsaturated.md"],
    "marketing":        ["INDEX.md"],
}

# ---------------------------------------------------------------------------
# Output Schemas for Structured Reports (SDK output_format)
# ---------------------------------------------------------------------------
AGENT_OUTPUT_SCHEMAS: dict[str, dict] = {
    "finance": {
        "type": "object",
        "properties": {
            "period": {"type": "string"},
            "revenue": {"type": "object", "properties": {
                "gross_eur": {"type": "number"},
                "net_eur": {"type": "number"},
                "orders_count": {"type": "integer"},
                "average_order_value_eur": {"type": "number"},
            }},
            "margins": {"type": "object", "properties": {
                "gross_margin_percent": {"type": "number"},
                "net_margin_percent": {"type": "number"},
            }},
            "anomalies": {"type": "array", "items": {"type": "object", "properties": {
                "type": {"type": "string"},
                "description": {"type": "string"},
                "severity": {"type": "string"},
            }}},
            "recommendations": {"type": "array", "items": {"type": "string"}},
        },
    },
    "researcher": {
        "type": "object",
        "properties": {
            "task_summary": {"type": "string"},
            "trends": {"type": "array", "items": {"type": "object", "properties": {
                "topic": {"type": "string"},
                "relevance_score": {"type": "number"},
                "summary": {"type": "string"},
            }}},
            "opportunities": {"type": "array", "items": {"type": "string"}},
            "threats": {"type": "array", "items": {"type": "string"}},
            "recommended_actions": {"type": "array", "items": {"type": "string"}},
        },
    },
    "qa_inspector": {
        "type": "object",
        "properties": {
            "task_summary": {"type": "string"},
            "verdict": {"type": "string"},
            "checks": {"type": "array", "items": {"type": "object", "properties": {
                "check": {"type": "string"},
                "status": {"type": "string"},
                "details": {"type": "string"},
            }}},
            "design_quality_score": {"type": "number"},
            "issues": {"type": "array", "items": {"type": "string"}},
            "warnings": {"type": "array", "items": {"type": "string"}},
            "recommendation": {"type": "string"},
        },
    },
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

# ---------------------------------------------------------------------------
# Drip Sequences
# ---------------------------------------------------------------------------
DRIP_SEQUENCES: dict[str, list[dict]] = {
    "welcome": [
        {"step": 1, "delay_days": 1, "subject": f"Welcome to {os.environ.get('STORE_SENDER_NAME', 'My POD Store')}!"},
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
# CAN-SPAM Compliance
# ---------------------------------------------------------------------------
STORE_PHYSICAL_ADDRESS = os.environ.get(
    "STORE_PHYSICAL_ADDRESS",
    "Your Company Address"
)
STORE_SENDER_NAME = os.environ.get("STORE_SENDER_NAME", "My Store")

# ---------------------------------------------------------------------------
# Gemini Embeddings
# ---------------------------------------------------------------------------
GEMINI_EMBEDDING_MODEL = "text-embedding-004"
GEMINI_EMBEDDING_DIMENSIONS = 768

# ---------------------------------------------------------------------------
# Gemini Image Generation (Designer fallback)
# ---------------------------------------------------------------------------
GEMINI_IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3-pro-image-preview")

# ---------------------------------------------------------------------------
# Memory Index (local SQLite cognitive memory)
# ---------------------------------------------------------------------------
ENABLE_MEMORY_INDEX_ON_BOOT = os.environ.get("ENABLE_MEMORY_INDEX_ON_BOOT", "true").lower() in ("true", "1", "yes")

# ---------------------------------------------------------------------------
# Pre-Compaction Memory Flush (chat sessions)
# ---------------------------------------------------------------------------
COMPACT_MAX_MESSAGES = int(os.environ.get("PODCLAW_COMPACT_MAX_MESSAGES", "40"))
COMPACT_MAX_TOKENS = int(os.environ.get("PODCLAW_COMPACT_MAX_TOKENS", "80000"))
COMPACT_MIN_MESSAGES = 10
COMPACT_COOLDOWN_MINUTES = 10
COMPACT_MAX_MEMORIES = 10

# ---------------------------------------------------------------------------
# Memory Importance Scoring
# ---------------------------------------------------------------------------
MEMORY_TYPE_WEIGHTS: dict[str, float] = {
    "preference": 0.3,
    "constraint": 0.35,
    "decision": 0.25,
    "business_rule": 0.4,
    "insight": 0.2,
    "general": 0.1,
}
MEMORY_IMPORTANCE_THRESHOLD = float(os.environ.get("PODCLAW_MEMORY_IMPORTANCE_THRESHOLD", "0.65"))
MAX_CONVERSATION_MEMORY_CHUNKS = int(os.environ.get("PODCLAW_MAX_CONV_MEMORY_CHUNKS", "1000"))
MEMORY_DECAY_DAYS = int(os.environ.get("PODCLAW_MEMORY_DECAY_DAYS", "30"))
MEMORY_DECAY_AMOUNT = float(os.environ.get("PODCLAW_MEMORY_DECAY_AMOUNT", "0.1"))
MEMORY_PRUNE_THRESHOLD = float(os.environ.get("PODCLAW_MEMORY_PRUNE_THRESHOLD", "0.3"))
MEMORY_ACCESS_BOOST = float(os.environ.get("PODCLAW_MEMORY_ACCESS_BOOST", "0.02"))
VALID_MEMORY_TYPES = set(MEMORY_TYPE_WEIGHTS.keys())
