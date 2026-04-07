# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Pipeline Engine (Phase 3)
=====================================

Multi-step agent pipelines with quality gates, CEO approval, and crash recovery.
Each pipeline step delegates to a specialist agent, passes output as context to the
next step, and optionally runs a quality gate (Haiku LLM) to validate the output.

Predefined pipelines in PIPELINE_REGISTRY — orchestrator dispatches by name.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import structlog

from podclaw.config import (
    PIPELINE_CEO_APPROVAL_TIMEOUT_HOURS,
    PIPELINE_REVIEW_MODEL,
    PIPELINE_STEP_TIMEOUT_DEFAULT,
)

if TYPE_CHECKING:
    from podclaw.approval.manager import ApprovalManager
    from podclaw.core import Orchestrator
    from podclaw.event_store import EventStore
    from podclaw.router.responder import Responder
    from podclaw.skill_registry import SkillRegistry

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class PipelineStep:
    """A single step in a multi-agent pipeline."""

    name: str
    agent: str
    prompt_template: str
    skill: str | None = None
    max_turns: int = 20
    timeout_seconds: int = PIPELINE_STEP_TIMEOUT_DEFAULT
    requires_review: bool = False
    acceptance_criteria: str | None = None
    on_failure: str = "retry"  # "retry" | "skip" | "escalate"
    max_retries: int = 1
    carry_context: bool = True


@dataclass
class Pipeline:
    """A complete multi-agent pipeline definition."""

    name: str
    description: str
    steps: list[PipelineStep]
    requires_ceo_approval_before: list[str] = field(default_factory=list)
    notify_ceo_after: list[str] = field(default_factory=list)


@dataclass
class StepResult:
    """Result of executing a single pipeline step."""

    step_name: str
    agent: str
    status: str  # "completed" | "failed" | "skipped"
    output: str = ""
    summary: str = ""
    duration_seconds: float = 0.0
    cost_usd: float = 0.0
    tool_calls: int = 0
    error: str | None = None
    review_passed: bool | None = None  # None if no review


@dataclass
class ReviewDecision:
    """Quality gate evaluation result."""

    passed: bool
    issues: list[str] = field(default_factory=list)
    feedback: str = ""


@dataclass
class PipelineContext:
    """Accumulates context across pipeline steps."""

    pipeline_name: str
    variables: dict[str, Any] = field(default_factory=dict)
    previous_results: list[StepResult] = field(default_factory=list)

    def to_pipeline_context_list(self) -> list[dict]:
        """Convert to the format expected by Orchestrator.run_agent(pipeline_context=)."""
        return [
            {"step": r.step_name, "result": r.summary or r.output[:500]}
            for r in self.previous_results
        ]


@dataclass
class PipelineResult:
    """Final result of a complete pipeline execution."""

    pipeline_name: str
    status: str  # "completed" | "failed" | "partial"
    step_results: list[StepResult] = field(default_factory=list)
    total_duration_seconds: float = 0.0
    total_cost_usd: float = 0.0


# ---------------------------------------------------------------------------
# Pipeline Engine
# ---------------------------------------------------------------------------


class PipelineEngine:
    """Executes multi-step agent pipelines with quality gates."""

    def __init__(
        self,
        orchestrator: "Orchestrator",
        skill_registry: "SkillRegistry",
        event_store: "EventStore",
        responder: "Responder | None" = None,
        approval_manager: "ApprovalManager | None" = None,
    ):
        self.orchestrator = orchestrator
        self.skill_registry = skill_registry
        self.event_store = event_store
        self.responder = responder
        self.approval_manager = approval_manager
        self._active_pipelines: dict[str, PipelineContext] = {}

    async def execute(
        self,
        pipeline: Pipeline,
        variables: dict[str, Any] | None = None,
        source: str = "ceo",
    ) -> PipelineResult:
        """Execute a complete pipeline, step by step.

        Returns PipelineResult with all step results.
        """
        run_id = str(uuid.uuid4())[:8]
        context = PipelineContext(
            pipeline_name=pipeline.name,
            variables=variables or {},
        )
        self._active_pipelines[run_id] = context

        start = time.monotonic()
        result = PipelineResult(pipeline_name=pipeline.name, status="completed")

        logger.info(
            "pipeline_start",
            pipeline=pipeline.name,
            run_id=run_id,
            steps=len(pipeline.steps),
            source=source,
        )

        try:
            for i, step in enumerate(pipeline.steps):
                # CEO approval gate (before step)
                if step.name in pipeline.requires_ceo_approval_before:
                    approved = await self._await_ceo_approval(
                        pipeline.name, step.name, context
                    )
                    if not approved:
                        logger.warning(
                            "pipeline_approval_denied",
                            pipeline=pipeline.name,
                            step=step.name,
                        )
                        result.status = "failed"
                        result.step_results.append(
                            StepResult(
                                step_name=step.name,
                                agent=step.agent,
                                status="skipped",
                                error="CEO approval denied or timed out",
                            )
                        )
                        break

                # Execute step
                step_result = await self._execute_step(step, context)
                result.step_results.append(step_result)
                result.total_cost_usd += step_result.cost_usd

                # Record to event store
                await self._record_step(run_id, pipeline.name, step_result)

                if step_result.status == "failed":
                    result.status = "failed"
                    break

                # Accumulate context for next steps
                if step.carry_context:
                    context.previous_results.append(step_result)

                # CEO notification (after step)
                if step.name in pipeline.notify_ceo_after:
                    await self._notify_ceo_progress(
                        pipeline.name, step, step_result, i, len(pipeline.steps)
                    )

        except Exception as e:
            logger.error("pipeline_error", pipeline=pipeline.name, error=str(e))
            result.status = "failed"
        finally:
            self._active_pipelines.pop(run_id, None)

        result.total_duration_seconds = time.monotonic() - start

        logger.info(
            "pipeline_complete",
            pipeline=pipeline.name,
            run_id=run_id,
            status=result.status,
            steps_completed=len(result.step_results),
            duration_s=f"{result.total_duration_seconds:.1f}",
            cost_usd=f"{result.total_cost_usd:.4f}",
        )

        return result

    async def _execute_step(
        self,
        step: PipelineStep,
        context: PipelineContext,
        attempt: int = 0,
    ) -> StepResult:
        """Execute a single pipeline step via orchestrator.run_agent()."""
        start = time.monotonic()

        # Format prompt with variables and previous results
        prompt = step.prompt_template.format_map(_SafeDict(context.variables))

        # Auto-discover skill if not specified
        skill = step.skill
        if not skill:
            matches = self.skill_registry.find_skills_for_pipeline_step(
                step.agent,
                prompt,
                " ".join(r.summary for r in context.previous_results),
            )
            if matches:
                skill = matches[0][0]

        logger.info(
            "pipeline_step_start",
            step=step.name,
            agent=step.agent,
            skill=skill,
            attempt=attempt,
        )

        try:
            raw_result = await asyncio.wait_for(
                self.orchestrator.run_agent(
                    agent_name=step.agent,
                    task=prompt,
                    pipeline_context=context.to_pipeline_context_list(),
                    skill_hint=skill,
                ),
                timeout=step.timeout_seconds,
            )
        except asyncio.TimeoutError:
            return await self._handle_step_failure(
                step, context, f"Timeout after {step.timeout_seconds}s", attempt
            )
        except Exception as e:
            return await self._handle_step_failure(
                step, context, str(e), attempt
            )

        # Extract result data
        output = raw_result.get("response", "")
        status = raw_result.get("status", "unknown")
        cost = raw_result.get("total_cost_usd", 0.0)
        tool_calls = raw_result.get("tool_calls", 0)
        duration = time.monotonic() - start

        if status == "error":
            return await self._handle_step_failure(
                step, context, raw_result.get("reason", "Agent error"), attempt
            )

        # Summarize for next steps (Haiku, ~$0.001)
        summary = await self._summarize_result(output) if output else ""

        step_result = StepResult(
            step_name=step.name,
            agent=step.agent,
            status="completed",
            output=output,
            summary=summary,
            duration_seconds=duration,
            cost_usd=cost,
            tool_calls=tool_calls,
        )

        # Quality gate
        if step.requires_review:
            review = await self._evaluate_step(step, step_result)
            step_result.review_passed = review.passed

            if not review.passed:
                logger.warning(
                    "pipeline_step_review_failed",
                    step=step.name,
                    issues=review.issues,
                )
                return await self._handle_step_failure(
                    step, context,
                    f"Quality gate failed: {'; '.join(review.issues)}",
                    attempt,
                )

        logger.info(
            "pipeline_step_complete",
            step=step.name,
            agent=step.agent,
            duration_s=f"{duration:.1f}",
            cost_usd=f"{cost:.4f}",
            tools=tool_calls,
        )

        return step_result

    async def _evaluate_step(
        self, step: PipelineStep, result: StepResult
    ) -> ReviewDecision:
        """Quality gate: evaluate step output against acceptance criteria."""
        from podclaw.llm_helper import quick_llm_call

        criteria = step.acceptance_criteria or "Output is coherent and addresses the task."
        prompt = (
            f"## Step: {step.name} (agent: {step.agent})\n\n"
            f"## Acceptance Criteria\n{criteria}\n\n"
            f"## Output (first 2000 chars)\n{result.output[:2000]}\n\n"
            "Evaluate the output against the criteria. Respond with JSON:\n"
            '{"passed": true/false, "issues": ["issue1", ...], "feedback": "brief note"}'
        )

        try:
            text = await quick_llm_call(
                system_prompt="You are a quality inspector. Evaluate agent output strictly.",
                user_prompt=prompt,
                model=PIPELINE_REVIEW_MODEL,
                max_budget=0.01,
            )
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            import json
            data = json.loads(text)
            return ReviewDecision(
                passed=bool(data.get("passed", True)),
                issues=data.get("issues", []),
                feedback=data.get("feedback", ""),
            )
        except Exception as e:
            logger.warning("pipeline_review_error", step=step.name, error=str(e))
            # Fail-open: if review errors, pass the step
            return ReviewDecision(passed=True, feedback=f"Review error: {e}")

    async def _handle_step_failure(
        self,
        step: PipelineStep,
        context: PipelineContext,
        error: str,
        attempt: int,
    ) -> StepResult:
        """Handle step failure according to on_failure policy."""
        logger.warning(
            "pipeline_step_failed",
            step=step.name,
            error=error[:200],
            attempt=attempt,
            policy=step.on_failure,
        )

        # Retry
        if step.on_failure == "retry" and attempt < step.max_retries:
            await asyncio.sleep(2 ** attempt * 3)  # 3s, 6s backoff
            return await self._execute_step(step, context, attempt + 1)

        # Skip
        if step.on_failure == "skip":
            return StepResult(
                step_name=step.name,
                agent=step.agent,
                status="skipped",
                error=error,
            )

        # Escalate (default) or exhausted retries
        if self.responder:
            try:
                from podclaw.gateway.models import Platform
                await self.responder.send_to_ceo(
                    Platform.TELEGRAM,
                    f"Pipeline '{context.pipeline_name}' failed at step '{step.name}':\n{error[:500]}",
                )
            except Exception:
                pass

        return StepResult(
            step_name=step.name,
            agent=step.agent,
            status="failed",
            error=error,
        )

    async def _summarize_result(self, output: str) -> str:
        """Summarize step output for pipeline context injection (~$0.001)."""
        if len(output) <= 500:
            return output

        from podclaw.llm_helper import quick_llm_call

        try:
            return await quick_llm_call(
                system_prompt="Summarize the following agent output in 2-3 sentences. Focus on key decisions and outcomes.",
                user_prompt=output[:4000],
                model=PIPELINE_REVIEW_MODEL,
                max_budget=0.005,
            )
        except Exception:
            # Fallback: truncate
            return output[:500]

    async def _await_ceo_approval(
        self,
        pipeline_name: str,
        step_name: str,
        context: PipelineContext,
    ) -> bool:
        """Wait for CEO approval before a pipeline step. Returns True if approved."""
        if not self.approval_manager:
            logger.warning("pipeline_no_approval_manager", step=step_name)
            return True  # No approval manager → auto-approve

        from podclaw.gateway.models import Platform

        preview = (
            f"Pipeline '{pipeline_name}' requests approval before step '{step_name}'.\n"
            f"Previous steps completed: {len(context.previous_results)}."
        )
        if context.previous_results:
            last = context.previous_results[-1]
            preview += f"\nLast step '{last.step_name}': {last.summary[:300]}"

        try:
            approval_id = await self.approval_manager.request_approval(
                resource_type="pipeline_step",
                resource_id=f"{pipeline_name}:{step_name}",
                platform=Platform.TELEGRAM,
                preview_text=preview,
            )
        except Exception as e:
            logger.error("pipeline_approval_request_failed", error=str(e))
            return False

        # Poll for approval (check every 30s, timeout after configured hours)
        timeout = PIPELINE_CEO_APPROVAL_TIMEOUT_HOURS * 3600
        elapsed = 0
        while elapsed < timeout:
            await asyncio.sleep(30)
            elapsed += 30

            try:
                record = await asyncio.to_thread(
                    lambda: self.approval_manager._db
                    .table("ceo_approvals")
                    .select("status")
                    .eq("id", approval_id)
                    .single()
                    .execute()
                )
                status = record.data.get("status") if record.data else "pending"
                if status == "approved":
                    return True
                if status == "rejected":
                    return False
            except Exception:
                pass  # Keep polling

        logger.warning("pipeline_approval_timeout", step=step_name)
        return False

    async def _notify_ceo_progress(
        self,
        pipeline_name: str,
        step: PipelineStep,
        result: StepResult,
        step_index: int,
        total_steps: int,
    ) -> None:
        """Send progress notification to CEO after a pipeline step."""
        if not self.responder:
            return

        from podclaw.gateway.models import Platform

        text = (
            f"Pipeline '{pipeline_name}' — step {step_index + 1}/{total_steps} complete.\n"
            f"Step: {step.name} ({step.agent})\n"
            f"Status: {result.status}\n"
            f"Duration: {result.duration_seconds:.0f}s | Cost: ${result.cost_usd:.3f}"
        )
        if result.summary:
            text += f"\n\nSummary:\n{result.summary[:500]}"

        try:
            await self.responder.send_to_ceo(Platform.TELEGRAM, text)
        except Exception as e:
            logger.warning("pipeline_notify_failed", error=str(e))

    async def _record_step(
        self, run_id: str, pipeline_name: str, step_result: StepResult
    ) -> None:
        """Record pipeline step to event store for crash recovery."""
        if not self.event_store._client:
            return

        try:
            await asyncio.to_thread(
                lambda: self.event_store._client.table("agent_events").insert({
                    "agent_name": step_result.agent,
                    "event_type": "pipeline_step",
                    "source": f"pipeline:{pipeline_name}:{run_id}",
                    "payload": {
                        "step": step_result.step_name,
                        "status": step_result.status,
                        "duration_s": step_result.duration_seconds,
                        "cost_usd": step_result.cost_usd,
                        "tool_calls": step_result.tool_calls,
                        "error": step_result.error,
                    },
                }).execute()
            )
        except Exception as e:
            logger.warning("pipeline_record_step_failed", error=str(e))

    def get_active_pipelines(self) -> dict[str, dict]:
        """Return status of active pipeline runs for bridge API."""
        return {
            run_id: {
                "pipeline": ctx.pipeline_name,
                "steps_completed": len(ctx.previous_results),
                "last_step": ctx.previous_results[-1].step_name if ctx.previous_results else None,
            }
            for run_id, ctx in self._active_pipelines.items()
        }


# ---------------------------------------------------------------------------
# Helper: safe string formatting that ignores missing keys
# ---------------------------------------------------------------------------


class _SafeDict(dict):
    """Dict subclass that returns {key} for missing keys in format_map."""

    def __missing__(self, key: str) -> str:
        return f"{{{key}}}"


# ---------------------------------------------------------------------------
# Predefined Pipeline Templates
# ---------------------------------------------------------------------------

PRODUCT_CREATION = Pipeline(
    name="product_creation",
    description="End-to-end product creation: research → design → catalog → QA → marketing",
    steps=[
        PipelineStep(
            name="research",
            agent="researcher",
            prompt_template=(
                "Research trends and opportunities for: {product_type}. "
                "Identify target audience, trending styles, competitor pricing, and keywords."
            ),
            requires_review=False,
        ),
        PipelineStep(
            name="design",
            agent="designer",
            prompt_template=(
                "Create a design for: {product_type}. "
                "Use the research insights from previous steps. "
                "Generate high-quality print-ready artwork following store brand guidelines."
            ),
            requires_review=True,
            acceptance_criteria="Design file exists, meets DPI requirements, follows brand guidelines.",
        ),
        PipelineStep(
            name="catalog",
            agent="cataloger",
            prompt_template=(
                "Create a Printful product listing for: {product_type}. "
                "Use the approved design. Set pricing with >=35% margin. "
                "Add GPSR compliance data. Sync to Supabase."
            ),
            requires_review=True,
            acceptance_criteria="Product created in Printful, synced to Supabase, GPSR data present, price set.",
        ),
        PipelineStep(
            name="quality_check",
            agent="qa_inspector",
            prompt_template=(
                "Inspect the newly created product for: {product_type}. "
                "Verify design quality, mockup accuracy, GPSR compliance, and pricing."
            ),
            requires_review=False,
        ),
        PipelineStep(
            name="launch",
            agent="marketing",
            prompt_template=(
                "Prepare marketing for the new product: {product_type}. "
                "Create social media copy and consider email to relevant segments."
            ),
            requires_review=False,
        ),
    ],
    requires_ceo_approval_before=["launch"],
    notify_ceo_after=["design", "quality_check"],
)

CATALOG_SYNC = Pipeline(
    name="catalog_sync",
    description="Sync Printful product updates to Supabase and verify",
    steps=[
        PipelineStep(
            name="sync",
            agent="cataloger",
            prompt_template=(
                "Sync product changes from Printful to Supabase. "
                "Focus on: {sync_scope}. Update prices, variants, and images."
            ),
            timeout_seconds=300,
        ),
        PipelineStep(
            name="verify",
            agent="qa_inspector",
            prompt_template=(
                "Verify the catalog sync completed correctly. "
                "Check that Supabase products match Printful state."
            ),
            requires_review=False,
        ),
    ],
    notify_ceo_after=["verify"],
)

CUSTOMER_SUPPORT_PIPELINE = Pipeline(
    name="customer_support",
    description="Handle customer inquiry: classify and resolve",
    steps=[
        PipelineStep(
            name="classify_and_resolve",
            agent="customer_support",
            prompt_template=(
                "Handle this customer inquiry: {inquiry}. "
                "Classify the issue, check order status if relevant, and draft a response."
            ),
            on_failure="escalate",
        ),
    ],
    notify_ceo_after=["classify_and_resolve"],
)

FINANCIAL_REPORT = Pipeline(
    name="financial_report",
    description="Generate financial analysis and report",
    steps=[
        PipelineStep(
            name="collect",
            agent="finance",
            prompt_template=(
                "Collect financial data for period: {period}. "
                "Query Stripe for charges, refunds, and balance. "
                "Query Supabase for order data."
            ),
        ),
        PipelineStep(
            name="analyze",
            agent="finance",
            prompt_template=(
                "Analyze the collected financial data. "
                "Calculate margins, identify anomalies, and generate recommendations."
            ),
            requires_review=False,
        ),
    ],
    notify_ceo_after=["analyze"],
)


# ---------------------------------------------------------------------------
# Pipeline Registry — lookup by name
# ---------------------------------------------------------------------------

PIPELINE_REGISTRY: dict[str, Pipeline] = {
    p.name: p
    for p in [
        PRODUCT_CREATION,
        CATALOG_SYNC,
        CUSTOMER_SUPPORT_PIPELINE,
        FINANCIAL_REPORT,
    ]
}
