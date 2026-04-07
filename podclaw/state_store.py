"""
PodClaw — Local State Store
=============================
SQLite-backed key-value store for PodClaw's internal runtime state.
Lives LOCALLY in the Docker container (mounted volume), NOT in Supabase.

Supabase = store backend (products, orders, customers)
SQLite   = PodClaw's own brain state (sessions, proposals, tasks)

Follows OpenClaw's pattern: ~/.openclaw/memory/<agentId>.sqlite
Our equivalent: podclaw/data/podclaw_state.db
"""

from __future__ import annotations

import json
import sqlite3
import asyncio
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT ''
);
"""


class StateStore:
    """Local SQLite key-value store. Thread-safe via asyncio.to_thread."""

    def __init__(self, db_path: Path):
        self._db_path = db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(db_path))
        conn.executescript(_CREATE_TABLE)
        conn.close()
        logger.info("state_store_initialized", path=str(db_path))

    def _conn(self) -> sqlite3.Connection:
        """Create a new connection (sqlite3 connections are NOT thread-safe)."""
        return sqlite3.connect(str(self._db_path))

    async def get(self, key: str, default: Any = None) -> Any:
        def _read():
            conn = self._conn()
            try:
                row = conn.execute(
                    "SELECT value FROM state WHERE key = ?", (key,)
                ).fetchone()
                return json.loads(row[0]) if row else default
            finally:
                conn.close()
        try:
            return await asyncio.to_thread(_read)
        except Exception as e:
            logger.warning("state_get_failed", key=key, error=str(e))
            return default

    async def set(self, key: str, value: Any) -> None:
        def _write():
            conn = self._conn()
            try:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc).isoformat()
                conn.execute(
                    "INSERT INTO state (key, value, updated_at) VALUES (?, ?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                    (key, json.dumps(value, default=str), now),
                )
                conn.commit()
            finally:
                conn.close()
        try:
            await asyncio.to_thread(_write)
        except Exception as e:
            logger.warning("state_set_failed", key=key, error=str(e))

    async def delete(self, key: str) -> None:
        def _delete():
            conn = self._conn()
            try:
                conn.execute("DELETE FROM state WHERE key = ?", (key,))
                conn.commit()
            finally:
                conn.close()
        try:
            await asyncio.to_thread(_delete)
        except Exception as e:
            logger.warning("state_delete_failed", key=key, error=str(e))

    async def keys(self) -> list[str]:
        def _keys():
            conn = self._conn()
            try:
                return [r[0] for r in conn.execute("SELECT key FROM state").fetchall()]
            finally:
                conn.close()
        try:
            return await asyncio.to_thread(_keys)
        except Exception:
            return []
