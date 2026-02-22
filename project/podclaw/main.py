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

Run: python3 -m podclaw.main --workspace ./pod_workspace
     python3 -m podclaw.main --workspace ./pod_workspace --dry-run
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
        "--workspace", type=str, default="./pod_workspace",
        help="Path to the pod_workspace directory",
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
    """Load environment variables from .env files."""
    # Try harness config first
    harness_env = workspace.parent / "config" / ".env.required"
    if harness_env.exists():
        load_dotenv(harness_env)

    # Then frontend .env.local (has all the real keys)
    frontend_env = workspace / "project" / "frontend" / ".env.local"
    if frontend_env.exists():
        load_dotenv(frontend_env, override=True)


def _build_connectors() -> dict:
    """Initialize all MCP connectors."""
    from podclaw.connectors.supabase_connector import SupabaseMCPConnector
    from podclaw.connectors.stripe_connector import StripeMCPConnector
    from podclaw.connectors.printify_connector import PrintifyMCPConnector
    from podclaw.connectors.fal_connector import FalMCPConnector
    from podclaw.connectors.gemini_connector import GeminiMCPConnector
    from podclaw.connectors.resend_connector import ResendMCPConnector
    from podclaw.connectors.jina_connector import JinaMCPConnector
    from podclaw.connectors.telegram_connector import TelegramMCPConnector
    from podclaw.connectors.whatsapp_connector import WhatsAppMCPConnector
    from podclaw import config

    connectors = {
        "supabase": SupabaseMCPConnector(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY),
        "stripe": StripeMCPConnector(config.STRIPE_SECRET_KEY),
        "printify": PrintifyMCPConnector(config.PRINTIFY_API_TOKEN, config.PRINTIFY_SHOP_ID),
        "fal": FalMCPConnector(config.FAL_KEY),
        "gemini": GeminiMCPConnector(config.GEMINI_API_KEY),
        "resend": ResendMCPConnector(config.RESEND_API_KEY, config.RESEND_FROM_EMAIL),
        "jina": JinaMCPConnector(config.JINA_API_KEY),
        "telegram": TelegramMCPConnector(config.TELEGRAM_BOT_TOKEN),
        "whatsapp": WhatsAppMCPConnector(config.WHATSAPP_PHONE_NUMBER_ID, config.WHATSAPP_ACCESS_TOKEN),
    }

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
                      printify_token=config.PRINTIFY_API_TOKEN, shop_id=config.PRINTIFY_SHOP_ID,
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

    connectors = _build_connectors()
    hooks = _build_hooks(event_store, memory_manager, event_queue=event_queue)

    skills_dir = Path(__file__).parent / "skills"

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
        state_store=state_store,
    )

    scheduler = PodClawScheduler(orchestrator, workspace_root=workspace)
    orchestrator.scheduler = scheduler  # Back-reference for deferred retries

    # Soul evolution (controlled SOUL.md mutation)
    soul_evolution = SoulEvolution(
        memory_manager.soul_path, event_store, memory_manager,
        state_store=state_store,
    )
    scheduler.set_soul_evolution(soul_evolution)

    # Heartbeat runner
    heartbeat_runner = HeartbeatRunner(
        orchestrator=orchestrator,
        event_store=event_store,
        memory_manager=memory_manager,
        event_queue=event_queue,
        workspace=workspace,
        interval_minutes=_cfg.HEARTBEAT_INTERVAL_MINUTES,
        active_hours=(_cfg.HEARTBEAT_ACTIVE_HOURS_START, _cfg.HEARTBEAT_ACTIVE_HOURS_END),
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
    scheduler.start()

    # Start heartbeat
    if _cfg.HEARTBEAT_ENABLED:
        heartbeat_runner.start()

    # Start FastAPI bridge
    if not args.no_bridge:
        from podclaw.bridge.api import create_app
        import uvicorn
        from podclaw.config import BRIDGE_HOST, BRIDGE_PORT

        app = create_app(
            orchestrator, scheduler, event_store, memory_manager,
            heartbeat=heartbeat_runner,
            event_queue=event_queue,
            soul_evolution=soul_evolution,
            state_store=state_store,
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
                    _shutdown(scheduler, orchestrator, server, heartbeat_runner)
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
        heartbeat_runner.stop()
        scheduler.stop()
        orchestrator.stop()


async def _shutdown(scheduler, orchestrator, server, heartbeat=None) -> None:
    """Graceful shutdown — allow active sessions up to 30s to complete."""
    logger.info("shutdown_initiated")
    if heartbeat:
        heartbeat.stop()
    scheduler.stop()
    orchestrator.stop()

    # Wait for active sessions to finish (max 30s)
    for i in range(30):
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


def _configure_structlog(json_output: bool = False) -> None:
    """Configure structlog with console or JSON output."""
    import logging

    if json_output:
        processors = [
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        processors = [
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
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
