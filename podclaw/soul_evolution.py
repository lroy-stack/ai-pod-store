"""
PodClaw — Soul Evolution
===========================

Controlled mutation of SOUL.md with guardrails.
Changes are proposed, logged, and optionally require admin approval.

Guardrails:
- "Constraints" and "Escalation Rules" sections are immutable
- Destructive keywords trigger mandatory admin review
- SOUL.md cannot exceed SOUL_MAX_LINES
- Every change is diffed and logged to soul_change_log table
- Soul review runs 1x/week (Sunday during consolidation)
"""

from __future__ import annotations

import asyncio
import difflib
import os
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

import structlog

from podclaw.config import SOUL_AUTO_APPROVE, SOUL_MAX_LINES

if TYPE_CHECKING:
    from podclaw.event_store import EventStore
    from podclaw.memory_manager import MemoryManager
    from podclaw.state_store import StateStore

logger = structlog.get_logger(__name__)

# Sections that can never be modified (normalized to lowercase for comparison)
IMMUTABLE_SECTIONS = frozenset({"constraints", "escalation rules"})

# Keywords in proposed content that require admin review
REVIEW_TRIGGERS = frozenset({
    "remove", "delete", "weaken", "reduce", "eliminate",
    "no longer", "stop", "ignore", "skip",
})


@dataclass
class SoulProposal:
    """A proposed change to a section of SOUL.md."""

    id: str
    section: str
    current_content: str
    proposed_content: str
    reasoning: str
    requires_review: bool
    created_at: datetime
    status: str = "pending"  # "pending" | "applied" | "rejected"


class SoulEvolution:
    """
    Manages controlled evolution of SOUL.md.

    - Proposals are created via LLM review during weekly consolidation
    - Immutable sections are protected (hardcoded, not overrideable)
    - Destructive changes require admin approval
    - All changes are diffed and logged
    """

    def __init__(
        self,
        soul_path: Path,
        event_store: "EventStore",
        memory_manager: "MemoryManager",
        state_store: "StateStore | None" = None,
    ):
        self.soul_path = soul_path
        self.event_store = event_store
        self.memory = memory_manager
        self.state = state_store
        self._pending_proposals: list[SoulProposal] = []
        self._soul_lock = asyncio.Lock()

    async def restore_proposals(self) -> None:
        """Restore pending proposals from local SQLite state store."""
        if not self.state:
            return
        raw = await self.state.get("soul_proposals", [])
        for item in raw:
            try:
                self._pending_proposals.append(SoulProposal(
                    id=item["id"],
                    section=item["section"],
                    current_content=item.get("current_content", ""),
                    proposed_content=item.get("proposed_content", ""),
                    reasoning=item.get("reasoning", ""),
                    requires_review=item.get("requires_review", True),
                    created_at=datetime.fromisoformat(item["created_at"]),
                    status=item.get("status", "pending"),
                ))
            except (KeyError, ValueError) as e:
                logger.warning("soul_proposal_restore_skip", error=str(e))
        if self._pending_proposals:
            logger.info("soul_proposals_restored", count=len(self._pending_proposals))

    async def _persist_proposals(self) -> None:
        """Persist pending proposals to local SQLite state store."""
        if not self.state:
            return
        data = [
            {
                "id": p.id,
                "section": p.section,
                "current_content": p.current_content[:2000],
                "proposed_content": p.proposed_content[:2000],
                "reasoning": p.reasoning[:500],
                "requires_review": p.requires_review,
                "created_at": p.created_at.isoformat(),
                "status": p.status,
            }
            for p in self._pending_proposals
        ]
        await self.state.set("soul_proposals", data)

    async def propose_change(
        self,
        section: str,
        proposed_content: str,
        reasoning: str,
    ) -> SoulProposal:
        """
        Propose a change to a SOUL.md section.

        Returns the proposal (may be auto-applied if safe).
        Raises ValueError for immutable sections.
        """
        # 1. Reject immutable sections (case-insensitive, whitespace-normalized)
        # Check before acquiring lock — ValueError should propagate immediately
        if section.strip().lower() in IMMUTABLE_SECTIONS:
            raise ValueError(f"Section '{section}' is immutable and cannot be modified")

        # 2-10 under lock to prevent concurrent SOUL.md mutations
        async with self._soul_lock:
            # 2. Read current content for diff
            current_soul = self.memory.read_soul()
            current_content = self._extract_section(current_soul, section)

            # 3. Check review triggers
            proposed_lower = proposed_content.lower()
            requires_review = any(trigger in proposed_lower for trigger in REVIEW_TRIGGERS)

            # 4. Check line limit
            new_soul = self._replace_section(current_soul, section, proposed_content)
            if len(new_soul.splitlines()) > SOUL_MAX_LINES:
                raise ValueError(
                    f"Proposed change would exceed {SOUL_MAX_LINES} lines. "
                    f"Current: {len(current_soul.splitlines())}, "
                    f"Proposed: {len(new_soul.splitlines())}"
                )

            # 5. Create proposal
            proposal = SoulProposal(
                id=str(uuid.uuid4()),
                section=section,
                current_content=current_content,
                proposed_content=proposed_content,
                reasoning=reasoning,
                requires_review=requires_review,
                created_at=datetime.now(timezone.utc),
            )

            # 6. Generate diff
            diff = self._generate_diff(current_content, proposed_content, section)

            # 7. Log to database
            await self._log_to_db(proposal, diff)

            # 8. Auto-apply or store as pending
            if SOUL_AUTO_APPROVE and not requires_review:
                await self._apply(proposal, new_soul)
                proposal.status = "applied"
                logger.info("soul_change_auto_applied",
                            section=section, proposal_id=proposal.id)
            else:
                self._pending_proposals.append(proposal)
                await self._persist_proposals()
                logger.info("soul_change_pending_review",
                            section=section, proposal_id=proposal.id,
                            requires_review=requires_review)

            # 9. Record event
            await self.event_store.record(
                agent_name="soul_evolution",
                event_type="soul_proposal",
                payload={
                    "proposal_id": proposal.id,
                    "section": section,
                    "status": proposal.status,
                    "requires_review": requires_review,
                    "reasoning": reasoning[:200],
                },
            )

        # 10. Append change note to MEMORY.md (uses its own lock)
        status_label = "auto-applied" if proposal.status == "applied" else "pending review"
        await self.memory.append_memory(
            f"[Soul] {section} change {status_label}: {reasoning[:100]}"
        )

        return proposal

    async def apply_proposal(self, proposal_id: str) -> bool:
        """Apply a pending proposal by ID. Returns True if found and applied."""
        async with self._soul_lock:
            proposal = self._find_pending(proposal_id)
            if not proposal:
                return False

            current_soul = self.memory.read_soul()
            new_soul = self._replace_section(current_soul, proposal.section, proposal.proposed_content)
            await self._apply(proposal, new_soul)
            proposal.status = "applied"
            self._pending_proposals = [p for p in self._pending_proposals if p.id != proposal_id]
            await self._persist_proposals()

            # Update DB
            await self._update_db_status(proposal_id, "applied", reviewed_by="admin")

            await self.event_store.record(
                agent_name="soul_evolution",
                event_type="soul_applied",
                payload={"proposal_id": proposal_id, "section": proposal.section},
            )

        logger.info("soul_proposal_applied", proposal_id=proposal_id)
        return True

    async def reject_proposal(self, proposal_id: str, reason: str = "") -> bool:
        """Reject a pending proposal by ID. Returns True if found and rejected."""
        proposal = self._find_pending(proposal_id)
        if not proposal:
            return False

        proposal.status = "rejected"
        self._pending_proposals = [p for p in self._pending_proposals if p.id != proposal_id]
        await self._persist_proposals()

        await self._update_db_status(proposal_id, "rejected", reviewed_by="admin", reason=reason)

        await self.event_store.record(
            agent_name="soul_evolution",
            event_type="soul_rejected",
            payload={"proposal_id": proposal_id, "reason": reason},
        )

        logger.info("soul_proposal_rejected", proposal_id=proposal_id, reason=reason)
        return True

    def get_pending_proposals(self) -> list[dict[str, Any]]:
        """Return pending proposals as dicts for the bridge API."""
        return [
            {
                "id": p.id,
                "section": p.section,
                "current_content": p.current_content[:500],
                "proposed_content": p.proposed_content[:500],
                "reasoning": p.reasoning,
                "requires_review": p.requires_review,
                "created_at": p.created_at.isoformat(),
                "status": p.status,
            }
            for p in self._pending_proposals
        ]

    # -----------------------------------------------------------------------
    # Internal Helpers
    # -----------------------------------------------------------------------

    def _find_pending(self, proposal_id: str) -> SoulProposal | None:
        for p in self._pending_proposals:
            if p.id == proposal_id:
                return p
        return None

    def _extract_section(self, soul_text: str, section_name: str) -> str:
        """Extract content of a ## Section from SOUL.md (case-insensitive match)."""
        lines = soul_text.splitlines()
        header_normalized = f"## {section_name}".strip().lower()
        capturing = False
        content_lines: list[str] = []

        for line in lines:
            if line.strip().lower() == header_normalized:
                capturing = True
                continue
            elif capturing and line.startswith("## "):
                break
            elif capturing:
                content_lines.append(line)

        return "\n".join(content_lines).strip()

    def _replace_section(self, soul_text: str, section_name: str, new_content: str) -> str:
        """Replace the content of a ## Section in SOUL.md (case-insensitive match)."""
        lines = soul_text.splitlines()
        header_normalized = f"## {section_name}".strip().lower()
        result: list[str] = []
        skipping = False
        found = False

        for line in lines:
            if line.strip().lower() == header_normalized:
                found = True
                skipping = True
                result.append(line)  # preserve original casing of header
                result.append(new_content)
                result.append("")  # blank line after
                continue
            elif skipping and line.startswith("## "):
                skipping = False
            elif skipping:
                continue
            result.append(line)

        # If section not found, append it
        if not found:
            header = f"## {section_name}"
            result.append("")
            result.append(header)
            result.append(new_content)
            result.append("")

        return "\n".join(result)

    def _generate_diff(self, old: str, new: str, section: str) -> str:
        """Generate a unified diff string."""
        old_lines = old.splitlines(keepends=True)
        new_lines = new.splitlines(keepends=True)
        diff = difflib.unified_diff(
            old_lines, new_lines,
            fromfile=f"SOUL.md/{section} (current)",
            tofile=f"SOUL.md/{section} (proposed)",
        )
        return "".join(diff)

    async def _apply(self, proposal: SoulProposal, new_soul: str) -> None:
        """Write the updated SOUL.md and append to the Evolution Log (single write).

        Uses atomic write (temp file + os.replace) to prevent partial reads
        by concurrent readers (heartbeat, agent context loading).
        """
        # Merge Evolution Log entry into new_soul BEFORE writing — eliminates TOCTOU
        if "## Evolution Log" in new_soul:
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            log_entry = f"- [{now}] {proposal.section}: {proposal.reasoning[:120]}"
            new_soul = new_soul.rstrip() + "\n" + log_entry + "\n"

        # Atomic write: temp file + os.replace() (atomic on POSIX)
        tmp_fd, tmp_path = tempfile.mkstemp(
            dir=str(self.soul_path.parent),
            prefix=".SOUL.md.",
            suffix=".tmp",
        )
        try:
            with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                f.write(new_soul)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, str(self.soul_path))
        except BaseException:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    async def _log_to_db(self, proposal: SoulProposal, diff: str) -> None:
        """Log proposal to soul_change_log table."""
        if not self.event_store._client:
            return

        row = {
            "proposal_id": proposal.id,
            "section": proposal.section,
            "old_content": proposal.current_content[:5000],
            "new_content": proposal.proposed_content[:5000],
            "reasoning": proposal.reasoning[:2000],
            "diff": diff[:5000],
            "status": "pending",
        }

        try:
            await asyncio.to_thread(
                lambda: self.event_store._client.table("soul_change_log").insert(row).execute()
            )
        except Exception as e:
            logger.error("soul_change_log_write_failed", error=str(e))

    async def _update_db_status(
        self,
        proposal_id: str,
        status: str,
        reviewed_by: str = "",
        reason: str = "",
    ) -> None:
        """Update a soul_change_log row status."""
        if not self.event_store._client:
            return

        updates: dict[str, Any] = {
            "status": status,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }
        if reviewed_by:
            updates["reviewed_by"] = reviewed_by
        if reason:
            updates["review_reason"] = reason

        try:
            await asyncio.to_thread(
                lambda: (
                    self.event_store._client.table("soul_change_log")
                    .update(updates)
                    .eq("proposal_id", proposal_id)
                    .execute()
                )
            )
        except Exception as e:
            logger.error("soul_change_log_update_failed", error=str(e))
