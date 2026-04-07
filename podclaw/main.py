# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Main Entry Point
=============================

Starts the PodClaw autonomous store manager:
1. Loads configuration from .env
2. Initializes MCP connectors
3. Sets up hook chains
4. Creates the orchestrator
5. Starts the APScheduler daily cycle
6. Runs the FastAPI bridge for admin dashboard

Run: python3 -m podclaw.main
     python3 -m podclaw.main --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import signal
import sys
from pathlib import Path

import structlog
from dotenv import load_dotenv

logger = structlog.get_logger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PodClaw — Autonomous POD Store Manager")
    parser.add_argument(
        "--workspace", type=str, default=".",
        help="Path to the project root directory",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Initialize everything but don't start scheduler or server",
    )
    parser.add_argument(
        "--no-bridge", action="store_true",
        help="Skip starting the FastAPI bridge server",
    )
    return parser.parse_args()


def _load_env(workspace: Path) -> None:
    """Load environment variables from .env files.

    Priority (highest wins):
    1. podclaw/.env          — PodClaw-specific config (canonical source)
    2. frontend/.env.local   — fallback for shared secrets (legacy compat)
    """
    # PodClaw's own .env (canonical source)
    podclaw_env = Path(__file__).parent / ".env"
    if podclaw_env.exists():
        load_dotenv(podclaw_env)
    else:
        # Fallback: frontend/.env.local (legacy, for backward compat)
        frontend_env = workspace / "frontend" / ".env.local"
        if frontend_env.exists():
            load_dotenv(frontend_env)

    # Clear CLAUDECODE to prevent SDK anti-nesting block.
    # PodClaw is a standalone app that spawns Claude sessions — not a nested session.
    os.environ.pop("CLAUDECODE", None)


def _build_connectors() -> dict:
    """Initialize all 8 MCP connectors (Printful-only, no Printify)."""
    from podclaw.connectors.supabase_connector import SupabaseMCPConnector
    from podclaw.connectors.stripe_connector import StripeMCPConnector
    from podclaw.connectors.printful_connector import PrintfulMCPConnector
    from podclaw.connectors.svg_renderer_connector import SVGRendererConnector
    from podclaw.connectors.fal_connector import FalMCPConnector
    from podclaw.connectors.gemini_connector import GeminiMCPConnector
    from podclaw.connectors.resend_connector import ResendMCPConnector
    from podclaw.connectors.crawl4ai_connector import CrawlForAIMCPConnector
    from podclaw import config

    connectors = {
        "supabase": SupabaseMCPConnector(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY),
        "stripe": StripeMCPConnector(config.STRIPE_SECRET_KEY),
        "printful": PrintfulMCPConnector(config.PRINTFUL_API_TOKEN, config.PRINTFUL_STORE_ID),
        "svg_renderer": SVGRendererConnector(config.SVG_RENDERER_URL),
        "fal": FalMCPConnector(config.FAL_KEY),
        "gemini": GeminiMCPConnector(config.GEMINI_API_KEY),
        "resend": ResendMCPConnector(config.RESEND_API_KEY, config.RESEND_FROM_EMAIL),
        "crawl4ai": CrawlForAIMCPConnector(config.CRAWL4AI_URL),
    }

    # Cognitive memory search (FTS5 — local SQLite, no external service)
    try:
        from podclaw.memory_search import MemoryIndex
        from podclaw.connectors.memory_search_connector import MemorySearchConnector
        memory_dir = Path(os.environ.get("PODCLAW_MEMORY_DIR", "podclaw/memory"))
        memory_idx = MemoryIndex(db_path=memory_dir / "search_index.db")
        memory_idx.rebuild(memory_dir)
        connectors["memory_search"] = MemorySearchConnector(memory_idx)
        logger.info("memory_search_initialized", stats=memory_idx.get_stats())
    except Exception as e:
        logger.warning("memory_search_init_failed", error=str(e))

    logger.info("connectors_initialized", count=len(connectors))
    return connectors


def _build_hooks(event_store, memory_manager, event_queue=None) -> dict[str, list]:
    """Build the hook chains for all sub-agents."""
    from podclaw.hooks.security_hook import security_hook
    from podclaw.hooks.cost_guard_hook import cost_guard_hook
    from podclaw.hooks.rate_limit_hook import rate_limit_hook
    from podclaw.hooks.event_log_hook import event_log_hook
    from podclaw.hooks.memory_hook import memory_hook
    from podclaw.hooks.metrics_hook import metrics_pre_hook, metrics_hook
    from podclaw.hooks.sync_hook import sync_hook
    from podclaw.hooks.transparency_hook import transparency_hook, transparency_catchup_hook
    from podclaw.hooks.quality_gate_hook import quality_gate_hook
    from podclaw.production_governor import production_governor_hook
    from podclaw import config

    return {
        "pre_tool_use": [
            security_hook,               # [0] deny — fail-closed
            cost_guard_hook,             # [1] deny — fail-open
            rate_limit_hook,             # [2] deny — fail-open
            production_governor_hook,    # [3] deny — fail-safe
            metrics_pre_hook,            # [4] observe
        ],
        "post_tool_use": [
            event_log_hook(event_store),
            memory_hook(memory_manager, event_queue=event_queue),
            transparency_hook(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, rembg_url=config.REMBG_URL, fal_key=config.FAL_KEY),
            sync_hook(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY,
                      event_queue=event_queue),
            quality_gate_hook(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, event_queue),
            transparency_catchup_hook(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY),
            metrics_hook,
        ],
        "stop": [],
    }


async def _run(args: argparse.Namespace) -> None:
    """Main async entry point."""
    workspace = Path(args.workspace).resolve()

    if not workspace.exists():
        logger.error("workspace_not_found", path=str(workspace))
        sys.exit(1)

    _load_env(workspace)

    # Import after env is loaded
    from podclaw.event_store import EventStore
    from podclaw.memory_manager import MemoryManager
    from podclaw.client_factory import ClientFactory
    from podclaw.core import Orchestrator
    from podclaw.skill_registry import SkillRegistry
    from podclaw.scheduler import PodClawScheduler
    from podclaw.event_queue import SystemEventQueue
    from podclaw.soul_evolution import SoulEvolution
    from podclaw.heartbeat import HeartbeatRunner
    from podclaw.state_store import StateStore

    # Initialize local state store (SQLite — PodClaw brain state)
    data_dir = Path(__file__).parent / "data"
    state_store = StateStore(data_dir / "podclaw_state.db")

    # Initialize components
    memory_manager = MemoryManager(workspace)

    # Initialize Supabase client for EventStore
    supabase_client = None
    from podclaw import config as _cfg
    if _cfg.SUPABASE_URL and _cfg.SUPABASE_SERVICE_KEY:
        try:
            from supabase import create_client
            supabase_client = create_client(_cfg.SUPABASE_URL, _cfg.SUPABASE_SERVICE_KEY)
            logger.info("supabase_client_initialized")
        except Exception as e:
            logger.warning("supabase_client_failed", error=str(e))

    event_store = EventStore(supabase_client=supabase_client)

    # Initialize hooks with Supabase persistence
    if supabase_client:
        from podclaw.hooks.cost_guard_hook import init_cost_guard
        from podclaw.hooks.rate_limit_hook import init_rate_limit
        from podclaw.hooks.security_hook import init_security
        from podclaw.production_governor import init_governor
        init_cost_guard(supabase_client)
        init_rate_limit(supabase_client)
        init_security(supabase_client)
        await init_governor(state_store)

    # System event queue (inter-agent communication, Supabase-backed)
    event_queue = SystemEventQueue(supabase_client=supabase_client)

    # Initialize local memory store (SQLite cognitive memory + Gemini embeddings)
    memory_store = None
    try:
        from podclaw.services.embedding_service import (
            GeminiEmbeddingProvider,
            CachedEmbeddingService,
        )
        from podclaw.memory.store import MemoryStore

        memory_db_path = Path(__file__).parent / "memory" / "memory.db"
        gemini_provider = GeminiEmbeddingProvider(api_key=_cfg.GEMINI_API_KEY)
        embedding_service = CachedEmbeddingService(provider=gemini_provider, db_path=memory_db_path)
        memory_store = MemoryStore(db_path=memory_db_path, embedding_service=embedding_service, state_store=state_store)
        logger.info("memory_store_initialized")
    except Exception as e:
        logger.warning("memory_store_init_failed", error=str(e))

    connectors = _build_connectors()
    hooks = _build_hooks(event_store, memory_manager, event_queue=event_queue)

    skills_dir = Path(__file__).parent / "skills"
    skill_registry = SkillRegistry(skills_dir)

    client_factory = ClientFactory(
        memory_manager=memory_manager,
        mcp_connectors=connectors,
        hooks=hooks,
        skills_dir=skills_dir,
        event_store=event_store,
    )

    orchestrator = Orchestrator(
        client_factory=client_factory,
        event_store=event_store,
        memory_manager=memory_manager,
        skill_registry=skill_registry,
        state_store=state_store,
    )

    # Delegation subsystem (async sub-agent execution from chat)
    from podclaw.delegation import DelegationRegistry, DelegationWorker
    delegation_registry = DelegationRegistry(state_store)
    delegation_worker = DelegationWorker(
        registry=delegation_registry,
        orchestrator=orchestrator,
        event_store=event_store,
        memory_manager=memory_manager,
    )

    scheduler = PodClawScheduler(orchestrator, workspace_root=workspace)
    orchestrator.scheduler = scheduler  # Back-reference for deferred retries

    # Soul evolution (controlled SOUL.md mutation)
    soul_evolution = SoulEvolution(
        memory_manager.soul_path, event_store, memory_manager,
        state_store=state_store,
    )
    scheduler.set_soul_evolution(soul_evolution)
    if memory_store:
        scheduler.set_memory_store(memory_store)

    # Pipeline engine (Phase 3)
    from podclaw.pipeline_engine import PipelineEngine
    pipeline_engine = PipelineEngine(
        orchestrator=orchestrator,
        skill_registry=orchestrator.skills,
        event_store=event_store,
    )
    logger.info("pipeline_engine_initialized")

    # Heartbeat runner
    heartbeat_runner = HeartbeatRunner(
        orchestrator=orchestrator,
        event_store=event_store,
        memory_manager=memory_manager,
        event_queue=event_queue,
        workspace=workspace,
        interval_minutes=_cfg.HEARTBEAT_INTERVAL_MINUTES,
        active_hours=(_cfg.HEARTBEAT_ACTIVE_HOURS_START, _cfg.HEARTBEAT_ACTIVE_HOURS_END),
        pipeline_engine=pipeline_engine,
    )

    if args.dry_run:
        logger.info("dry_run_mode", workspace=str(workspace))
        status = orchestrator.get_status()
        jobs = scheduler.get_jobs()
        logger.info("status", **status)
        logger.info("scheduled_jobs", count=len(jobs))
        for job in jobs:
            logger.info("job", **job)
        print(f"\n✓ PodClaw initialized successfully")
        print(f"  Workspace: {workspace}")
        print(f"  Agents: {status['agent_count']}")
        print(f"  Scheduled jobs: {len(jobs)}")
        print(f"  SOUL.md: {'found' if memory_manager.soul_path.exists() else 'missing'}")
        print(f"  Heartbeat: {'enabled' if _cfg.HEARTBEAT_ENABLED else 'disabled'}")
        print(f"  Soul Evolution: {'enabled' if _cfg.SOUL_EVOLUTION_ENABLED else 'disabled'}")
        return

    # Restore soul proposals from local state
    asyncio.create_task(soul_evolution.restore_proposals())

    # Start orchestrator
    orchestrator.start()
    delegation_worker.start()
    scheduler.start()

    # Start heartbeat
    if _cfg.HEARTBEAT_ENABLED:
        heartbeat_runner.start()

    # Index memory files in background (controlled by ENABLE_MEMORY_INDEX_ON_BOOT)
    if memory_store and _cfg.ENABLE_MEMORY_INDEX_ON_BOOT:
        async def _index_memory():
            try:
                result = await memory_store.sync_files(memory_manager)
                logger.info("memory_indexed", **result)
            except Exception as e:
                logger.warning("memory_index_failed", error=str(e))

        asyncio.create_task(_index_memory())
    elif memory_store:
        logger.info("memory_index_skipped", reason="ENABLE_MEMORY_INDEX_ON_BOOT=false")

    # Start FastAPI bridge
    if not args.no_bridge:
        from podclaw.bridge.api import create_app
        import uvicorn
        from podclaw.config import BRIDGE_HOST, BRIDGE_PORT

        # Initialize event-driven gateway (CEO → classify → dispatch → respond)
        _event_dispatcher = None
        try:
            from podclaw.router.classifier import EventClassifier
            from podclaw.router.dispatcher import EventDispatcher
            from podclaw.router.responder import Responder

            from podclaw.connectors.telegram_connector import TelegramMCPConnector
            from podclaw.connectors.whatsapp_connector import WhatsAppMCPConnector

            _tg = TelegramMCPConnector(_cfg.TELEGRAM_BOT_TOKEN) if _cfg.TELEGRAM_BOT_TOKEN else None
            _wa = WhatsAppMCPConnector(_cfg.WHATSAPP_PHONE_NUMBER_ID, _cfg.WHATSAPP_ACCESS_TOKEN) if _cfg.WHATSAPP_PHONE_NUMBER_ID else None

            _classifier = EventClassifier()
            _responder = Responder(_wa, _tg)

            # Approval manager (Sprint 2)
            _approval_manager = None
            if supabase_client:
                from podclaw.approval.manager import ApprovalManager
                _approval_manager = ApprovalManager(supabase_client, _responder, orchestrator)
                logger.info("approval_manager_initialized")

                # Register approval timeout cron (every 4h)
                from podclaw.approval.timeout import ApprovalTimeoutChecker
                from apscheduler.triggers.interval import IntervalTrigger as _IT
                _timeout_checker = ApprovalTimeoutChecker(supabase_client, _responder)
                scheduler.scheduler.add_job(
                    _timeout_checker.check,
                    _IT(hours=4),
                    id="approval_timeout_check",
                    name="Approval Timeout Check",
                )

            # Wire responder + approval into pipeline engine
            pipeline_engine.responder = _responder
            if _approval_manager:
                pipeline_engine.approval_manager = _approval_manager

            _event_dispatcher = EventDispatcher(
                orchestrator, _classifier, _responder,
                approval_manager=_approval_manager,
                pipeline_engine=pipeline_engine,
            )
            logger.info("event_dispatcher_initialized")
        except Exception as e:
            logger.warning("event_dispatcher_init_failed", error=str(e))

        app = create_app(
            orchestrator, scheduler, event_store, memory_manager,
            heartbeat=heartbeat_runner,
            event_queue=event_queue,
            soul_evolution=soul_evolution,
            state_store=state_store,
            connectors=connectors,
            delegation_registry=delegation_registry,
            event_dispatcher=_event_dispatcher,
        )

        config = uvicorn.Config(
            app, host=BRIDGE_HOST, port=BRIDGE_PORT,
            log_level="info", access_log=False,
        )
        server = uvicorn.Server(config)

        # Handle shutdown signals
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(
                sig,
                lambda: asyncio.create_task(
                    _shutdown(scheduler, orchestrator, server, heartbeat_runner,
                              delegation_worker=delegation_worker)
                ),
            )

        # SIGHUP: hot-reload config (env vars, budgets, rate limits)
        def _handle_sighup():
            import importlib
            from podclaw import config as _cfg_mod
            try:
                _load_env(workspace)
                importlib.reload(_cfg_mod)
                logger.info("config_reloaded_sighup")
            except Exception as e:
                logger.error("config_reload_failed", error=str(e))

        try:
            loop.add_signal_handler(signal.SIGHUP, _handle_sighup)
        except (ValueError, OSError):
            pass  # SIGHUP not available on Windows

        logger.info("podclaw_started",
                     bridge=f"http://{BRIDGE_HOST}:{BRIDGE_PORT}",
                     heartbeat=_cfg.HEARTBEAT_ENABLED)
        await server.serve()
    else:
        # No bridge — just run scheduler
        logger.info("podclaw_started_no_bridge")
        stop_event = asyncio.Event()

        loop = asyncio.get_event_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, stop_event.set)

        await stop_event.wait()
        delegation_worker.stop()
        heartbeat_runner.stop()
        scheduler.stop()
        orchestrator.stop()


async def _shutdown(scheduler, orchestrator, server, heartbeat=None, delegation_worker=None) -> None:
    """Graceful shutdown — drain CEO queues + active sessions before stopping."""
    logger.info("shutdown_initiated")
    if delegation_worker:
        delegation_worker.stop()
    if heartbeat:
        heartbeat.stop()
    scheduler.stop()

    # Wait for CEO queues to drain (max 15s)
    if orchestrator._ceo_queues:
        ceo_keys = list(orchestrator._ceo_queues.keys())
        logger.info("draining_ceo_queues", platforms=ceo_keys)
        for i in range(15):
            all_empty = all(q.empty() for q in orchestrator._ceo_queues.values())
            if all_empty:
                break
            await asyncio.sleep(1)

    # Cancel CEO workers
    for key, worker in orchestrator._ceo_workers.items():
        if not worker.done():
            worker.cancel()

    orchestrator.stop()

    # Wait for active sub-agent sessions (max 15s)
    for i in range(15):
        if not orchestrator._active_sessions:
            break
        if i == 0:
            logger.info(
                "waiting_for_active_sessions",
                agents=list(orchestrator._active_sessions.keys()),
            )
        await asyncio.sleep(1)

    server.should_exit = True
    logger.info("shutdown_complete")


def _scrub_pii(logger, method, event_dict: dict) -> dict:
    """
    Structlog processor that strips PII fields from log output.

    PII fields that must never appear in logs:
      - email, user_email, customer_email
      - name, user_name, customer_name, full_name
      - address, shipping_address, billing_address
      - phone, phone_number, mobile

    Replaces values with [REDACTED] marker.
    """
    PII_FIELDS = frozenset({
        "email", "user_email", "customer_email", "sender_email",
        "name", "user_name", "customer_name", "full_name", "display_name",
        "address", "shipping_address", "billing_address", "street_address",
        "phone", "phone_number", "mobile", "telephone",
    })

    for key in list(event_dict.keys()):
        if key.lower() in PII_FIELDS:
            event_dict[key] = "[REDACTED]"
        elif isinstance(event_dict.get(key), dict):
            # Recursively scrub nested dicts (e.g., metadata)
            for nested_key in list(event_dict[key].keys()):
                if nested_key.lower() in PII_FIELDS:
                    event_dict[key][nested_key] = "[REDACTED]"

    return event_dict


def _configure_structlog(json_output: bool = False) -> None:
    """Configure structlog with console or JSON output and PII scrubbing."""
    import logging

    # PII scrubbing processor is always applied (first in chain)
    shared_processors = [
        _scrub_pii,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
    ]

    if json_output:
        processors = shared_processors + [
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    )


def main() -> None:
    """Sync entry point."""
    args = _parse_args()
    json_logs = os.environ.get("PODCLAW_JSON_LOGS", "false").lower() == "true"
    _configure_structlog(json_output=json_logs)
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
