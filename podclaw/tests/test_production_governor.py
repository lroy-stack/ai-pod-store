"""
Tests for podclaw.production_governor

Covers:
- MarketSignals and GovernorDecision dataclasses
- Signal fetching with mocked Supabase
- Decision computation logic (all rules)
- Production governor hook (PreToolUse enforcement)
- Persistence and caching
- Initialization and fail-safe modes
"""

import pytest
import asyncio
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from podclaw.production_governor import (
    MarketSignals,
    GovernorDecision,
    _fetch_signals,
    compute_daily_decision,
    persist_decision,
    production_governor_hook,
    init_governor,
    _signals_to_dict,
    _deny,
    COLD_START_DAYS,
    COLD_START_PRODUCT_LIMIT,
    INVESTIGATION_TRIGGER_DAYS,
    INVESTIGATION_TRIGGER_PRODUCTS,
    INVESTIGATION_CYCLE_DAYS,
    FAIL_SAFE_PRODUCT_LIMIT,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_supabase():
    """Mock Supabase client with chainable query builder."""
    client = MagicMock()

    def make_query_builder(data=None, count=None):
        qb = MagicMock()
        qb.select.return_value = qb
        qb.eq.return_value = qb
        qb.gte.return_value = qb
        qb.lte.return_value = qb
        qb.lt.return_value = qb
        qb.not_.is_.return_value = qb
        qb.order.return_value = qb
        qb.limit.return_value = qb

        result = MagicMock()
        result.data = data if data is not None else []
        result.count = count if count is not None else 0
        qb.execute.return_value = result

        return qb

    client.table.side_effect = lambda t: make_query_builder()
    return client


@pytest.fixture
def mock_state_store():
    """Mock StateStore."""
    store = AsyncMock()
    store.get.return_value = {}
    store.set.return_value = None
    return store


@pytest.fixture
def sample_signals():
    """Sample MarketSignals for testing."""
    return MarketSignals(
        V=500.0,
        I_avg=100.0,
        CTR_est=2.0,
        ATC_est=5.0,
        S_7d=10,
        R=20.0,
        C_pd=1.5,
        N_active=50,
        category_sales_7d={"apparel": 5, "accessories": 3},
        data_quality="real",
        monthly_cost=25.0,
        monthly_sales=15,
        days_since_first_product=30,
        total_products_ever=100,
    )


# ---------------------------------------------------------------------------
# Test Dataclasses
# ---------------------------------------------------------------------------

class TestDataClasses:

    def test_market_signals_defaults(self):
        """MarketSignals initializes with zero defaults."""
        signals = MarketSignals()
        assert signals.V == 0.0
        assert signals.S_7d == 0
        assert signals.data_quality == "proxy"
        assert signals.category_sales_7d == {}

    def test_governor_decision_defaults(self):
        """GovernorDecision initializes with cold_start defaults."""
        decision = GovernorDecision()
        assert decision.mode == "cold_start"
        assert decision.daily_product_limit == COLD_START_PRODUCT_LIMIT
        assert decision.daily_design_limit == COLD_START_PRODUCT_LIMIT + 1
        assert decision.modifiers_applied == []


# ---------------------------------------------------------------------------
# Test Signal Fetching
# ---------------------------------------------------------------------------

class TestSignalFetching:

    @pytest.mark.asyncio
    async def test_fetch_signals_no_client(self):
        """Signal fetching with None client returns zero signals."""
        signals = await _fetch_signals(None, date.today())
        assert signals.N_active == 0
        assert signals.S_7d == 0
        assert signals.data_quality == "proxy"

    @pytest.mark.asyncio
    async def test_fetch_signals_with_real_views(self, mock_supabase):
        """Signal fetching with views data sets data_quality=real."""
        # Mock products count
        products_qb = MagicMock()
        products_qb.select.return_value = products_qb
        products_qb.eq.return_value = products_qb
        result = MagicMock()
        result.count = 50
        products_qb.execute.return_value = result

        # Mock metrics with views
        metrics_qb = MagicMock()
        metrics_qb.select.return_value = metrics_qb
        metrics_qb.gte.return_value = metrics_qb
        metrics_qb.lte.return_value = metrics_qb
        metrics_result = MagicMock()
        metrics_result.data = [
            {"orders": 5, "views": 1000, "category": "apparel"},
            {"orders": 3, "views": 500, "category": "accessories"},
        ]
        metrics_qb.execute.return_value = metrics_result

        # Mock designs
        designs_qb = MagicMock()
        designs_qb.select.return_value = designs_qb
        designs_qb.not_.return_value = designs_qb
        designs_qb.is_.return_value = designs_qb
        designs_qb.gte.return_value = designs_qb
        designs_qb.lt.return_value = designs_qb
        designs_result = MagicMock()
        designs_result.count = 10
        designs_qb.execute.return_value = designs_result

        # Mock agent_daily_costs
        costs_qb = MagicMock()
        costs_qb.select.return_value = costs_qb
        costs_qb.eq.return_value = costs_qb
        costs_qb.gte.return_value = costs_qb
        costs_qb.lte.return_value = costs_qb
        costs_result = MagicMock()
        costs_result.data = [{"total_cost_eur": 5.0}]
        costs_qb.execute.return_value = costs_result

        # Set up table router
        tables = {
            "products": products_qb,
            "product_daily_metrics": metrics_qb,
            "designs": designs_qb,
            "agent_daily_costs": costs_qb,
        }
        mock_supabase.table.side_effect = lambda t: tables.get(t, MagicMock())

        signals = await _fetch_signals(mock_supabase, date.today())

        assert signals.data_quality == "real"
        assert signals.N_active == 50
        assert signals.S_7d == 8  # 5 + 3 orders
        assert signals.V > 0  # Should be 1500/7
        assert signals.category_sales_7d == {"apparel": 5, "accessories": 3}


# ---------------------------------------------------------------------------
# Test Decision Logic
# ---------------------------------------------------------------------------

class TestDecisionLogic:

    @pytest.mark.asyncio
    async def test_cold_start_mode(self, mock_supabase, mock_state_store):
        """Cold start mode when days < COLD_START_DAYS."""
        # Mock signals: 5 days old, 3 products total
        products_qb = MagicMock()
        products_qb.select.return_value = products_qb
        products_qb.eq.return_value = products_qb
        products_qb.execute.return_value = MagicMock(count=3)

        products_first_qb = MagicMock()
        products_first_qb.select.return_value = products_first_qb
        products_first_qb.order.return_value = products_first_qb
        products_first_qb.limit.return_value = products_first_qb
        five_days_ago = (date.today() - timedelta(days=5)).isoformat()
        products_first_qb.execute.return_value = MagicMock(data=[{"created_at": f"{five_days_ago}T00:00:00Z"}])

        mock_supabase.table.side_effect = lambda t: products_first_qb if t == "products" else MagicMock()

        decision = await compute_daily_decision(mock_supabase, mock_state_store)

        assert decision.mode == "cold_start"
        assert decision.daily_product_limit == COLD_START_PRODUCT_LIMIT
        assert "cold_start" in decision.modifiers_applied

    @pytest.mark.asyncio
    async def test_investigation_mode_trigger(self, mock_supabase, mock_state_store):
        """Investigation mode when 30+ days, 60+ products, 0 sales."""
        # Mock: 35 days old, 65 products, 0 sales
        products_qb = MagicMock()
        products_qb.select.return_value = products_qb
        products_qb.eq.return_value = products_qb
        products_qb.order.return_value = products_qb
        products_qb.limit.return_value = products_qb

        products_qb.execute.side_effect = [
            MagicMock(count=50),  # active count
            MagicMock(count=65),  # total count
            MagicMock(data=[{"created_at": f"{(date.today() - timedelta(days=35)).isoformat()}T00:00:00Z"}]),  # first product
        ]

        metrics_qb = MagicMock()
        metrics_qb.select.return_value = metrics_qb
        metrics_qb.gte.return_value = metrics_qb
        metrics_qb.lte.return_value = metrics_qb
        metrics_qb.execute.return_value = MagicMock(data=[])  # 0 sales

        mock_supabase.table.side_effect = lambda t: products_qb if t == "products" else metrics_qb if t == "product_daily_metrics" else MagicMock()

        decision = await compute_daily_decision(mock_supabase, mock_state_store)

        assert decision.mode == "investigation"
        assert decision.daily_product_limit == 1
        assert "investigation_active" in decision.modifiers_applied

    @pytest.mark.asyncio
    async def test_proxy_mode_sales_gating(self, mock_supabase, mock_state_store):
        """Proxy mode uses S_7d / 3 for base limit."""
        # Mock: 20 days old, 10 products, 9 sales (no views data)
        products_qb = MagicMock()
        products_qb.select.return_value = products_qb
        products_qb.eq.return_value = products_qb
        products_qb.order.return_value = products_qb
        products_qb.limit.return_value = products_qb
        products_qb.execute.side_effect = [
            MagicMock(count=10),
            MagicMock(count=10),
            MagicMock(data=[{"created_at": f"{(date.today() - timedelta(days=20)).isoformat()}T00:00:00Z"}]),
        ]

        metrics_qb = MagicMock()
        metrics_qb.select.return_value = metrics_qb
        metrics_qb.gte.return_value = metrics_qb
        metrics_qb.lte.return_value = metrics_qb
        metrics_qb.execute.return_value = MagicMock(data=[
            {"orders": 5, "views": 0, "category": "apparel"},
            {"orders": 4, "views": 0, "category": "accessories"},
        ])

        mock_supabase.table.side_effect = lambda t: products_qb if t == "products" else metrics_qb if t == "product_daily_metrics" else MagicMock()

        decision = await compute_daily_decision(mock_supabase, mock_state_store)

        assert decision.mode == "proxy"
        assert decision.data_quality == "proxy"
        # S_7d=9, floor(9/3)=3
        assert decision.daily_product_limit == 3


# ---------------------------------------------------------------------------
# Test Hook Enforcement
# ---------------------------------------------------------------------------

class TestHookEnforcement:

    @pytest.mark.asyncio
    async def test_hook_allows_untracked_tools(self):
        """Hook returns empty dict for non-production tools."""
        result = await production_governor_hook({"tool_name": "supabase_query"})
        assert result == {}

    @pytest.mark.asyncio
    async def test_hook_fail_safe_mode(self):
        """Hook in fail-safe mode (no cache) denies AI tools, allows 1 product."""
        # Clear cache
        from podclaw import production_governor
        production_governor._governor_cache = {}
        production_governor._production_counters = {}

        # AI tool should be denied
        result = await production_governor_hook({"tool_name": "fal_generate"})
        assert result.get("hookSpecificOutput", {}).get("permissionDecision") == "deny"
        assert "fail-safe" in result.get("hookSpecificOutput", {}).get("permissionDecisionReason", "")

        # First product should be allowed
        result = await production_governor_hook({"tool_name": "printify_create"})
        assert result == {}

        # Second product should be denied
        result = await production_governor_hook({"tool_name": "printify_create"})
        assert result.get("hookSpecificOutput", {}).get("permissionDecision") == "deny"
        assert f"fail-safe limit ({FAIL_SAFE_PRODUCT_LIMIT})" in result.get("hookSpecificOutput", {}).get("permissionDecisionReason", "")

    @pytest.mark.asyncio
    async def test_hook_enforces_product_limit(self):
        """Hook enforces daily product limit from cache."""
        from podclaw import production_governor

        # Set up cache with limit=2
        production_governor._governor_cache = {
            "mode": "normal",
            "daily_product_limit": 2,
            "daily_design_limit": 3,
            "data_quality": "real",
        }
        production_governor._production_counters = {"products_created": 0}

        # First product allowed
        result = await production_governor_hook({"tool_name": "printify_create"})
        assert result == {}

        # Second product allowed
        result = await production_governor_hook({"tool_name": "printify_create"})
        assert result == {}

        # Third product denied
        result = await production_governor_hook({"tool_name": "printify_create"})
        assert result.get("hookSpecificOutput", {}).get("permissionDecision") == "deny"
        assert "limit reached" in result.get("hookSpecificOutput", {}).get("permissionDecisionReason", "").lower()

    @pytest.mark.asyncio
    async def test_hook_enforces_freeze(self):
        """Hook denies AI tools during freeze period."""
        from podclaw import production_governor

        freeze_until = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        production_governor._governor_cache = {
            "mode": "frozen",
            "daily_product_limit": 0,
            "daily_design_limit": 1,
            "freeze_until": freeze_until,
        }
        production_governor._production_counters = {}

        result = await production_governor_hook({"tool_name": "fal_generate"})
        assert result.get("hookSpecificOutput", {}).get("permissionDecision") == "deny"
        assert "frozen" in result.get("hookSpecificOutput", {}).get("permissionDecisionReason", "").lower()


# ---------------------------------------------------------------------------
# Test Persistence
# ---------------------------------------------------------------------------

class TestPersistence:

    @pytest.mark.asyncio
    async def test_persist_decision_updates_cache(self, mock_state_store, tmp_path):
        """Persisting decision updates in-memory cache."""
        from podclaw import production_governor

        decision = GovernorDecision(
            date=date.today().isoformat(),
            mode="normal",
            daily_product_limit=5,
            daily_design_limit=6,
        )

        await persist_decision(decision, mock_state_store, tmp_path)

        # Check cache was updated
        assert production_governor._governor_cache["mode"] == "normal"
        assert production_governor._governor_cache["daily_product_limit"] == 5

        # Check StateStore was called
        mock_state_store.set.assert_called()
        calls = [call[0] for call in mock_state_store.set.call_args_list]
        assert any("governor_decision" in str(c) for c in calls)

    @pytest.mark.asyncio
    async def test_persist_decision_writes_report(self, mock_state_store, tmp_path):
        """Persisting decision writes governor_report.md."""
        decision = GovernorDecision(
            date=date.today().isoformat(),
            mode="proxy",
            daily_product_limit=3,
            daily_design_limit=4,
            modifiers_applied=["proxy_base=3"],
            explanation="Proxy mode test",
            signals_snapshot={"V": 100.0, "S_7d": 9},
        )

        await persist_decision(decision, mock_state_store, tmp_path)

        report_path = tmp_path / "governor_report.md"
        assert report_path.exists()

        content = report_path.read_text()
        assert "# Production Governor Report" in content
        assert "Mode**: proxy" in content
        assert "Daily Product Limit**: 3" in content
        assert "Proxy mode test" in content


# ---------------------------------------------------------------------------
# Test Initialization
# ---------------------------------------------------------------------------

class TestInitialization:

    @pytest.mark.asyncio
    async def test_init_governor_restores_today_decision(self, mock_state_store):
        """init_governor restores cache if stored decision is for today."""
        from podclaw import production_governor

        today_decision = {
            "date": date.today().isoformat(),
            "mode": "normal",
            "daily_product_limit": 5,
        }
        mock_state_store.get.return_value = today_decision

        await init_governor(mock_state_store)

        assert production_governor._governor_cache["mode"] == "normal"
        assert production_governor._governor_cache["daily_product_limit"] == 5

    @pytest.mark.asyncio
    async def test_init_governor_ignores_old_decision(self, mock_state_store):
        """init_governor does NOT restore if stored decision is old."""
        from podclaw import production_governor

        yesterday_decision = {
            "date": (date.today() - timedelta(days=1)).isoformat(),
            "mode": "normal",
            "daily_product_limit": 5,
        }
        mock_state_store.get.return_value = yesterday_decision

        # Clear cache
        production_governor._governor_cache = {}

        await init_governor(mock_state_store)

        # Cache should remain empty
        assert production_governor._governor_cache == {}


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

class TestHelpers:

    def test_signals_to_dict(self, sample_signals):
        """_signals_to_dict converts MarketSignals to JSON-serializable dict."""
        result = _signals_to_dict(sample_signals)

        assert result["V"] == 500.0
        assert result["S_7d"] == 10
        assert result["data_quality"] == "real"
        assert result["category_sales_7d"] == {"apparel": 5, "accessories": 3}

    def test_deny_helper(self):
        """_deny helper builds correct deny response."""
        result = _deny("Test reason")

        assert result["hookSpecificOutput"]["hookEventName"] == "PreToolUse"
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"
        assert result["hookSpecificOutput"]["permissionDecisionReason"] == "Test reason"
