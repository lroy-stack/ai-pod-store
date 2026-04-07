"""
PodClaw — Pipeline Engine Tests (Phase 6.1)
=============================================

Tests for PipelineEngine, PIPELINE_REGISTRY, dataclasses, step execution,
quality gates, failure handling, CEO approval, and notifications.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from podclaw.pipeline_engine import (
    PIPELINE_REGISTRY,
    Pipeline,
    PipelineContext,
    PipelineEngine,
    PipelineResult,
    PipelineStep,
    ReviewDecision,
    StepResult,
    _SafeDict,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_orchestrator():
    """Mock Orchestrator with run_agent returning success."""
    orch = MagicMock()
    orch.run_agent = AsyncMock(return_value={
        "status": "completed",
        "response": "Task completed successfully.",
        "total_cost_usd": 0.05,
        "tool_calls": 3,
    })
    return orch


@pytest.fixture()
def mock_skill_registry():
    """Mock SkillRegistry."""
    sr = MagicMock()
    sr.find_skills_for_pipeline_step = MagicMock(return_value=[])
    return sr


@pytest.fixture()
def mock_event_store():
    """Mock EventStore without Supabase."""
    es = MagicMock()
    es._client = None
    return es


@pytest.fixture()
def mock_responder():
    """Mock Responder with send_to_ceo."""
    resp = MagicMock()
    resp.send_to_ceo = AsyncMock()
    return resp


@pytest.fixture()
def engine(mock_orchestrator, mock_skill_registry, mock_event_store, mock_responder):
    """PipelineEngine with all mocked dependencies."""
    return PipelineEngine(
        orchestrator=mock_orchestrator,
        skill_registry=mock_skill_registry,
        event_store=mock_event_store,
        responder=mock_responder,
    )


@pytest.fixture()
def simple_pipeline():
    """Two-step pipeline for testing."""
    return Pipeline(
        name="test_pipeline",
        description="Test pipeline",
        steps=[
            PipelineStep(
                name="step_one",
                agent="researcher",
                prompt_template="Research {topic}",
            ),
            PipelineStep(
                name="step_two",
                agent="designer",
                prompt_template="Design based on research",
            ),
        ],
    )


# ---------------------------------------------------------------------------
# Registry Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_pipeline_registry_has_4_pipelines():
    assert len(PIPELINE_REGISTRY) == 4
    assert set(PIPELINE_REGISTRY.keys()) == {
        "product_creation",
        "catalog_sync",
        "customer_support",
        "financial_report",
    }


@pytest.mark.unit
def test_pipeline_registry_product_creation_has_5_steps():
    pc = PIPELINE_REGISTRY["product_creation"]
    assert len(pc.steps) == 5
    agents = [s.agent for s in pc.steps]
    assert agents == ["researcher", "designer", "cataloger", "qa_inspector", "marketing"]


# ---------------------------------------------------------------------------
# Dataclass Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_pipeline_step_defaults():
    step = PipelineStep(name="test", agent="researcher", prompt_template="Do {thing}")
    assert step.skill is None
    assert step.on_failure == "retry"
    assert step.max_retries == 1
    assert step.carry_context is True
    assert step.requires_review is False


@pytest.mark.unit
def test_pipeline_context_accumulates():
    ctx = PipelineContext(pipeline_name="test")
    assert ctx.previous_results == []

    result = StepResult(step_name="s1", agent="researcher", status="completed", summary="Found data")
    ctx.previous_results.append(result)
    assert len(ctx.previous_results) == 1
    assert ctx.previous_results[0].summary == "Found data"


@pytest.mark.unit
def test_pipeline_context_to_list():
    ctx = PipelineContext(pipeline_name="test")
    ctx.previous_results.append(
        StepResult(step_name="s1", agent="researcher", status="completed", output="raw data", summary="Found trends")
    )
    ctx.previous_results.append(
        StepResult(step_name="s2", agent="designer", status="completed", output="design done", summary="Created logo")
    )

    result = ctx.to_pipeline_context_list()
    assert len(result) == 2
    assert result[0] == {"step": "s1", "result": "Found trends"}
    assert result[1] == {"step": "s2", "result": "Created logo"}


@pytest.mark.unit
def test_pipeline_result_defaults():
    pr = PipelineResult(pipeline_name="test", status="completed")
    assert pr.step_results == []
    assert pr.total_duration_seconds == 0.0
    assert pr.total_cost_usd == 0.0


@pytest.mark.unit
def test_safe_dict_missing_key():
    d = _SafeDict({"topic": "hats"})
    assert d["topic"] == "hats"
    result = "Research {topic} in {market}".format_map(d)
    assert result == "Research hats in {market}"


@pytest.mark.unit
def test_prompt_template_formatting():
    d = _SafeDict({"product_type": "t-shirt", "style": "minimalist"})
    template = "Create a {product_type} with {style} design for {audience}"
    result = template.format_map(d)
    assert "t-shirt" in result
    assert "minimalist" in result
    assert "{audience}" in result  # Missing key preserved


# ---------------------------------------------------------------------------
# Execution Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.unit
async def test_execute_simple_pipeline(engine, simple_pipeline, mock_orchestrator):
    """Two-step pipeline executes both steps in order."""
    with patch("podclaw.pipeline_engine.PipelineEngine._summarize_result", new_callable=AsyncMock, return_value="Summary"):
        result = await engine.execute(simple_pipeline, variables={"topic": "hats"})

    assert result.status == "completed"
    assert len(result.step_results) == 2
    assert result.step_results[0].step_name == "step_one"
    assert result.step_results[1].step_name == "step_two"
    assert mock_orchestrator.run_agent.call_count == 2

    # Verify first call used correct prompt with variable substitution
    first_call = mock_orchestrator.run_agent.call_args_list[0]
    assert first_call.kwargs["agent_name"] == "researcher"
    assert "hats" in first_call.kwargs["task"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_execute_accumulates_cost(engine, simple_pipeline):
    """Pipeline result accumulates cost from all steps."""
    with patch("podclaw.pipeline_engine.PipelineEngine._summarize_result", new_callable=AsyncMock, return_value="S"):
        result = await engine.execute(simple_pipeline)

    assert result.total_cost_usd == pytest.approx(0.10, abs=0.01)  # 2 steps x 0.05


@pytest.mark.asyncio
@pytest.mark.unit
async def test_execute_with_step_failure_skip(engine, mock_orchestrator):
    """Step with on_failure='skip' allows pipeline to continue."""
    pipeline = Pipeline(
        name="skip_test",
        description="Test skip",
        steps=[
            PipelineStep(
                name="failing_step",
                agent="researcher",
                prompt_template="Do something",
                on_failure="skip",
                max_retries=0,
            ),
            PipelineStep(
                name="next_step",
                agent="designer",
                prompt_template="Continue",
            ),
        ],
    )

    # First call fails, second succeeds
    mock_orchestrator.run_agent = AsyncMock(side_effect=[
        {"status": "error", "reason": "Something broke"},
        {"status": "completed", "response": "OK", "total_cost_usd": 0.01, "tool_calls": 1},
    ])

    with patch("podclaw.pipeline_engine.PipelineEngine._summarize_result", new_callable=AsyncMock, return_value="S"):
        result = await engine.execute(pipeline)

    assert result.status == "completed"
    assert len(result.step_results) == 2
    assert result.step_results[0].status == "skipped"
    assert result.step_results[1].status == "completed"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_execute_with_step_failure_escalate(engine, mock_orchestrator):
    """Step with on_failure='escalate' stops the pipeline."""
    pipeline = Pipeline(
        name="escalate_test",
        description="Test escalate",
        steps=[
            PipelineStep(
                name="failing_step",
                agent="researcher",
                prompt_template="Do something",
                on_failure="escalate",
                max_retries=0,
            ),
            PipelineStep(
                name="never_runs",
                agent="designer",
                prompt_template="Should not run",
            ),
        ],
    )

    mock_orchestrator.run_agent = AsyncMock(return_value={"status": "error", "reason": "Broken"})
    result = await engine.execute(pipeline)

    assert result.status == "failed"
    assert len(result.step_results) == 1
    assert result.step_results[0].status == "failed"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_execute_with_quality_gate_pass(engine, mock_orchestrator):
    """Step with requires_review=True passes when quality gate approves."""
    pipeline = Pipeline(
        name="review_test",
        description="Test review",
        steps=[
            PipelineStep(
                name="reviewed_step",
                agent="designer",
                prompt_template="Design something",
                requires_review=True,
                acceptance_criteria="Design must exist.",
            ),
        ],
    )

    with patch("podclaw.pipeline_engine.PipelineEngine._summarize_result", new_callable=AsyncMock, return_value="S"):
        with patch("podclaw.pipeline_engine.PipelineEngine._evaluate_step", new_callable=AsyncMock) as mock_eval:
            mock_eval.return_value = ReviewDecision(passed=True, feedback="Looks good")
            result = await engine.execute(pipeline)

    assert result.status == "completed"
    assert result.step_results[0].review_passed is True


@pytest.mark.asyncio
@pytest.mark.unit
async def test_execute_with_quality_gate_fail_retry(engine, mock_orchestrator):
    """Step fails quality gate, retries, then passes."""
    pipeline = Pipeline(
        name="retry_review_test",
        description="Test retry on review fail",
        steps=[
            PipelineStep(
                name="reviewed_step",
                agent="designer",
                prompt_template="Design something",
                requires_review=True,
                on_failure="retry",
                max_retries=1,
            ),
        ],
    )

    call_count = 0

    async def mock_evaluate(step, result):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return ReviewDecision(passed=False, issues=["Missing logo"])
        return ReviewDecision(passed=True)

    with patch("podclaw.pipeline_engine.PipelineEngine._summarize_result", new_callable=AsyncMock, return_value="S"):
        with patch.object(engine, "_evaluate_step", side_effect=mock_evaluate):
            result = await engine.execute(pipeline)

    assert result.status == "completed"
    # orchestrator.run_agent called twice (initial + retry)
    assert mock_orchestrator.run_agent.call_count == 2


@pytest.mark.asyncio
@pytest.mark.unit
async def test_ceo_notification(engine, simple_pipeline, mock_responder):
    """Steps in notify_ceo_after trigger CEO notification."""
    simple_pipeline.notify_ceo_after = ["step_one"]

    with patch("podclaw.pipeline_engine.PipelineEngine._summarize_result", new_callable=AsyncMock, return_value="S"):
        await engine.execute(simple_pipeline)

    mock_responder.send_to_ceo.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_pipeline_result_totals(engine, simple_pipeline):
    """Pipeline result has correct total duration and cost."""
    with patch("podclaw.pipeline_engine.PipelineEngine._summarize_result", new_callable=AsyncMock, return_value="S"):
        result = await engine.execute(simple_pipeline)

    assert result.total_duration_seconds > 0
    assert result.total_cost_usd > 0
    assert len(result.step_results) == 2
