#!/usr/bin/env python3
"""Supabase client connector for analytics scripts.

Loads credentials from the frontend .env.local or fallback .env,
then provides helper functions for querying Supabase tables.
"""

import os
from pathlib import Path
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import create_client, Client


def _load_env() -> None:
    """Load environment variables from .env files."""
    script_dir = Path(__file__).resolve().parent
    # Primary: frontend/.env.local
    frontend_env = script_dir.parent.parent / "frontend" / ".env.local"
    if frontend_env.exists():
        load_dotenv(frontend_env)
        return
    # Fallback: scripts/../.env
    fallback_env = script_dir.parent.parent / ".env"
    if fallback_env.exists():
        load_dotenv(fallback_env)
        return


_load_env()

_SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
_SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

if not _SUPABASE_URL or not _SUPABASE_KEY:
    raise EnvironmentError(
        "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY. "
        "Ensure the frontend/.env.local (or ../.env) file contains these variables."
    )

supabase: Client = create_client(_SUPABASE_URL, _SUPABASE_KEY)


def query_table(
    table: str,
    select: str = "*",
    filters: dict | None = None,
    order: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    """Generic query helper.

    Args:
        table: Table name.
        select: Column selection string (default '*').
        filters: Dict of {column: value} equality filters.
        order: Column name to order by (descending).
        limit: Max rows to return.

    Returns:
        List of row dicts.
    """
    query = supabase.table(table).select(select)
    if filters:
        for col, val in filters.items():
            query = query.eq(col, val)
    if order:
        query = query.order(order, desc=True)
    if limit:
        query = query.limit(limit)
    response = query.execute()
    return response.data or []


def get_orders(days: int = 90) -> list[dict]:
    """Fetch recent orders with their order_items.

    Args:
        days: Look-back window in days (default 90).

    Returns:
        List of order dicts with nested order_items.
    """
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    response = (
        supabase.table("orders")
        .select("*, order_items(*)")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


def get_products() -> list[dict]:
    """Fetch all active products."""
    response = (
        supabase.table("products")
        .select("*")
        .eq("status", "active")
        .execute()
    )
    return response.data or []


def get_customers() -> list[dict]:
    """Fetch all users with role='customer'."""
    response = (
        supabase.table("users")
        .select("*")
        .eq("role", "customer")
        .execute()
    )
    return response.data or []


def rpc(fn_name: str, params: dict | None = None) -> any:
    """Call a Supabase RPC function.

    Args:
        fn_name: Remote function name.
        params: Parameters dict to pass.

    Returns:
        RPC response data.
    """
    response = supabase.rpc(fn_name, params or {}).execute()
    return response.data
