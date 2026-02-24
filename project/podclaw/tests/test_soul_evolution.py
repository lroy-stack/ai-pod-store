"""
Tests for podclaw.soul_evolution

Covers:
- SoulProposal dataclass
- Immutable section protection
- Review trigger detection
- Line limit enforcement
- Auto-approval logic
- Proposal apply/reject workflows
- Section extraction and replacement
- Diff generation
- Persistence and restoration
- Database logging
"""

import pytest
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from podclaw.soul_evolution import (
    SoulEvolution,
    SoulProposal,
    IMMUTABLE_SECTIONS,
    REVIEW_TRIGGERS,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def soul_file(tmp_path):
    """Create a temporary SOUL.md file with known content."""
    soul_path = tmp_path / "SOUL.md"
    content = """# PodClaw Soul

## Identity
I am an autonomous POD store manager.

## Constraints
- Never delete customer data
- Never bypass payment verification

## Escalation Rules
- Always escalate refunds >€100
- Require admin approval for bulk operations

## Goals
- Maximize sales while maintaining quality
- Keep costs below budget

## Evolution Log
"""
    soul_path.write_text(content)
    return soul_path


@pytest.fixture
def mock_event_store():
    """Mock EventStore."""
    store = AsyncMock()
    store._client = MagicMock()
    store.record = AsyncMock()

    # Mock Supabase insert chain
    table_mock = MagicMock()
    table_mock.insert.return_value = table_mock
    table_mock.update.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = MagicMock()
    store._client.table.return_value = table_mock

    return store


@pytest.fixture
def mock_memory_manager(soul_file):
    """Mock MemoryManager."""
    mm = MagicMock()
    mm.read_soul.return_value = soul_file.read_text()
    mm.append_memory = AsyncMock()
    return mm


@pytest.fixture
def mock_state_store():
    """Mock StateStore."""
    store = AsyncMock()
    store.get.return_value = []
    store.set.return_value = None
    return store


@pytest.fixture
def soul_evolution(soul_file, mock_event_store, mock_memory_manager, mock_state_store):
    """SoulEvolution instance with mocked dependencies."""
    return SoulEvolution(
        soul_path=soul_file,
        event_store=mock_event_store,
        memory_manager=mock_memory_manager,
        state_store=mock_state_store,
    )


# ---------------------------------------------------------------------------
# Test SoulProposal Dataclass
# ---------------------------------------------------------------------------

class TestSoulProposal:

    def test_proposal_initialization(self):
        """SoulProposal can be initialized with required fields."""
        proposal = SoulProposal(
            id="test-123",
            section="Goals",
            current_content="Old content",
            proposed_content="New content",
            reasoning="Testing",
            requires_review=True,
            created_at=datetime.now(timezone.utc),
        )

        assert proposal.id == "test-123"
        assert proposal.section == "Goals"
        assert proposal.status == "pending"  # default

    def test_proposal_status_default(self):
        """SoulProposal defaults to 'pending' status."""
        proposal = SoulProposal(
            id="test",
            section="Test",
            current_content="",
            proposed_content="",
            reasoning="",
            requires_review=False,
            created_at=datetime.now(timezone.utc),
        )
        assert proposal.status == "pending"


# ---------------------------------------------------------------------------
# Test Immutable Section Protection
# ---------------------------------------------------------------------------

class TestImmutableSections:

    @pytest.mark.asyncio
    async def test_rejects_constraints_section(self, soul_evolution):
        """Cannot modify Constraints section (exact case)."""
        with pytest.raises(ValueError, match="immutable"):
            await soul_evolution.propose_change(
                section="Constraints",
                proposed_content="New constraints",
                reasoning="Testing",
            )

    @pytest.mark.asyncio
    async def test_rejects_constraints_case_insensitive(self, soul_evolution):
        """Constraints section rejection is case-insensitive."""
        with pytest.raises(ValueError, match="immutable"):
            await soul_evolution.propose_change(
                section="CONSTRAINTS",  # uppercase
                proposed_content="New constraints",
                reasoning="Testing",
            )

    @pytest.mark.asyncio
    async def test_rejects_escalation_rules(self, soul_evolution):
        """Cannot modify Escalation Rules section."""
        with pytest.raises(ValueError, match="immutable"):
            await soul_evolution.propose_change(
                section="Escalation Rules",
                proposed_content="New rules",
                reasoning="Testing",
            )

    @pytest.mark.asyncio
    async def test_rejects_escalation_rules_extra_whitespace(self, soul_evolution):
        """Immutable check handles extra whitespace."""
        with pytest.raises(ValueError, match="immutable"):
            await soul_evolution.propose_change(
                section="  escalation rules  ",  # extra whitespace
                proposed_content="New rules",
                reasoning="Testing",
            )


# ---------------------------------------------------------------------------
# Test Review Triggers
# ---------------------------------------------------------------------------

class TestReviewTriggers:

    @pytest.mark.asyncio
    @patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", False)
    async def test_destructive_keyword_requires_review(self, soul_evolution):
        """Proposal with 'remove' keyword requires review."""
        proposal = await soul_evolution.propose_change(
            section="Goals",
            proposed_content="Remove the old goal and add new ones",
            reasoning="Updating goals",
        )

        assert proposal.requires_review is True
        assert proposal.status == "pending"
        assert len(soul_evolution._pending_proposals) == 1

    @pytest.mark.asyncio
    @patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", False)
    async def test_safe_content_no_review(self, soul_evolution):
        """Proposal without destructive keywords doesn't require review."""
        proposal = await soul_evolution.propose_change(
            section="Goals",
            proposed_content="Add a new goal to improve customer satisfaction",
            reasoning="Expanding goals",
        )

        assert proposal.requires_review is False
        # Still pending because SOUL_AUTO_APPROVE is False
        assert proposal.status == "pending"

    @pytest.mark.asyncio
    @patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", True)
    async def test_auto_approve_when_enabled_and_safe(self, soul_evolution, soul_file):
        """Safe proposals are auto-applied when SOUL_AUTO_APPROVE=True."""
        proposal = await soul_evolution.propose_change(
            section="Goals",
            proposed_content="Add a new goal to increase revenue",
            reasoning="Revenue focus",
        )

        assert proposal.status == "applied"
        assert len(soul_evolution._pending_proposals) == 0
        # Verify SOUL.md was updated
        updated_soul = soul_file.read_text()
        assert "increase revenue" in updated_soul

    @pytest.mark.asyncio
    @patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", True)
    async def test_no_auto_approve_for_review_required(self, soul_evolution):
        """Proposals requiring review are NOT auto-approved even if enabled."""
        proposal = await soul_evolution.propose_change(
            section="Goals",
            proposed_content="Delete the old sales target",
            reasoning="Removing target",
        )

        assert proposal.requires_review is True
        assert proposal.status == "pending"
        assert len(soul_evolution._pending_proposals) == 1


# ---------------------------------------------------------------------------
# Test Line Limit Enforcement
# ---------------------------------------------------------------------------

class TestLineLimitEnforcement:

    @pytest.mark.asyncio
    @patch("podclaw.soul_evolution.SOUL_MAX_LINES", 20)
    async def test_rejects_proposal_exceeding_limit(self, soul_evolution):
        """Proposal that would exceed SOUL_MAX_LINES is rejected."""
        # Create very long proposed content
        long_content = "\n".join(f"Line {i}" for i in range(100))

        with pytest.raises(ValueError, match="exceed.*lines"):
            await soul_evolution.propose_change(
                section="Goals",
                proposed_content=long_content,
                reasoning="Testing line limit",
            )


# ---------------------------------------------------------------------------
# Test Proposal Workflow
# ---------------------------------------------------------------------------

class TestProposalWorkflow:

    @pytest.mark.asyncio
    async def test_apply_proposal_success(self, soul_evolution, soul_file):
        """Applying a proposal updates SOUL.md and marks as applied."""
        # Create a pending proposal
        with patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", False):
            proposal = await soul_evolution.propose_change(
                section="Goals",
                proposed_content="New goal: Maximize customer retention",
                reasoning="Focus on retention",
            )

        proposal_id = proposal.id

        # Apply the proposal
        result = await soul_evolution.apply_proposal(proposal_id)

        assert result is True
        # Verify SOUL.md was updated
        updated_soul = soul_file.read_text()
        assert "Maximize customer retention" in updated_soul
        # Proposal should be removed from pending
        assert len(soul_evolution._pending_proposals) == 0

    @pytest.mark.asyncio
    async def test_apply_nonexistent_proposal(self, soul_evolution):
        """Applying non-existent proposal returns False."""
        result = await soul_evolution.apply_proposal("nonexistent-id")
        assert result is False

    @pytest.mark.asyncio
    async def test_reject_proposal_success(self, soul_evolution):
        """Rejecting a proposal marks it as rejected and removes from pending."""
        # Create a pending proposal
        with patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", False):
            proposal = await soul_evolution.propose_change(
                section="Goals",
                proposed_content="New goal",
                reasoning="Testing",
            )

        proposal_id = proposal.id

        # Reject the proposal
        result = await soul_evolution.reject_proposal(proposal_id, "Not aligned with strategy")

        assert result is True
        # Proposal should be removed from pending
        assert len(soul_evolution._pending_proposals) == 0

    @pytest.mark.asyncio
    async def test_reject_nonexistent_proposal(self, soul_evolution):
        """Rejecting non-existent proposal returns False."""
        result = await soul_evolution.reject_proposal("nonexistent-id")
        assert result is False


# ---------------------------------------------------------------------------
# Test Section Operations
# ---------------------------------------------------------------------------

class TestSectionOperations:

    def test_extract_section(self, soul_evolution):
        """_extract_section correctly extracts content from SOUL.md."""
        soul_text = """# Soul

## Identity
I am PodClaw.

## Goals
- Goal 1
- Goal 2

## Other
Something else
"""
        content = soul_evolution._extract_section(soul_text, "Goals")
        assert "- Goal 1" in content
        assert "- Goal 2" in content
        assert "Other" not in content

    def test_extract_section_case_insensitive(self, soul_evolution):
        """_extract_section is case-insensitive."""
        soul_text = """## Goals
Content here
"""
        content = soul_evolution._extract_section(soul_text, "GOALS")
        assert "Content here" in content

    def test_replace_section(self, soul_evolution):
        """_replace_section replaces content correctly."""
        soul_text = """# Soul

## Goals
Old goals

## Other
Other content
"""
        new_soul = soul_evolution._replace_section(soul_text, "Goals", "New goals")
        assert "New goals" in new_soul
        assert "Old goals" not in new_soul
        assert "Other content" in new_soul  # other sections preserved

    def test_replace_section_adds_if_missing(self, soul_evolution):
        """_replace_section adds section if it doesn't exist."""
        soul_text = """# Soul

## Identity
I am PodClaw
"""
        new_soul = soul_evolution._replace_section(soul_text, "Goals", "New goals")
        assert "## Goals" in new_soul
        assert "New goals" in new_soul

    def test_generate_diff(self, soul_evolution):
        """_generate_diff creates unified diff."""
        old_content = "Line 1\nLine 2\n"
        new_content = "Line 1\nLine 2 modified\nLine 3\n"

        diff = soul_evolution._generate_diff(old_content, new_content, "Test")

        assert "@@" in diff  # unified diff marker
        assert "+" in diff
        assert "-" in diff


# ---------------------------------------------------------------------------
# Test Persistence
# ---------------------------------------------------------------------------

class TestPersistence:

    @pytest.mark.asyncio
    async def test_restore_proposals(self, mock_state_store):
        """Proposals are restored from state store on startup."""
        stored_proposals = [
            {
                "id": "test-1",
                "section": "Goals",
                "current_content": "Old",
                "proposed_content": "New",
                "reasoning": "Update",
                "requires_review": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending",
            }
        ]
        mock_state_store.get.return_value = stored_proposals

        soul_evo = SoulEvolution(
            soul_path=Path("/tmp/soul.md"),
            event_store=MagicMock(),
            memory_manager=MagicMock(),
            state_store=mock_state_store,
        )

        await soul_evo.restore_proposals()

        assert len(soul_evo._pending_proposals) == 1
        assert soul_evo._pending_proposals[0].id == "test-1"

    @pytest.mark.asyncio
    async def test_persist_proposals_on_create(self, soul_evolution, mock_state_store):
        """Creating a proposal persists it to state store."""
        with patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", False):
            await soul_evolution.propose_change(
                section="Goals",
                proposed_content="New goal",
                reasoning="Testing persistence",
            )

        # State store set should have been called
        mock_state_store.set.assert_called()
        call_args = mock_state_store.set.call_args
        assert call_args[0][0] == "soul_proposals"
        assert len(call_args[0][1]) == 1


# ---------------------------------------------------------------------------
# Test Get Pending Proposals
# ---------------------------------------------------------------------------

class TestGetPendingProposals:

    @pytest.mark.asyncio
    async def test_get_pending_proposals_empty(self, soul_evolution):
        """get_pending_proposals returns empty list when no proposals."""
        result = soul_evolution.get_pending_proposals()
        assert result == []

    @pytest.mark.asyncio
    async def test_get_pending_proposals_with_data(self, soul_evolution):
        """get_pending_proposals returns list of proposal dicts."""
        with patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", False):
            await soul_evolution.propose_change(
                section="Goals",
                proposed_content="Goal A",
                reasoning="Reason A",
            )
            await soul_evolution.propose_change(
                section="Identity",
                proposed_content="Identity B",
                reasoning="Reason B",
            )

        proposals = soul_evolution.get_pending_proposals()

        assert len(proposals) == 2
        assert proposals[0]["section"] == "Goals"
        assert proposals[1]["section"] == "Identity"
        assert "id" in proposals[0]
        assert "requires_review" in proposals[0]


# ---------------------------------------------------------------------------
# Test Database Logging
# ---------------------------------------------------------------------------

class TestDatabaseLogging:

    @pytest.mark.asyncio
    async def test_logs_proposal_to_database(self, soul_evolution, mock_event_store):
        """Proposal creation logs to soul_change_log table."""
        with patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", False):
            await soul_evolution.propose_change(
                section="Goals",
                proposed_content="New goal",
                reasoning="Testing",
            )

        # Verify insert was called
        mock_event_store._client.table.assert_called_with("soul_change_log")
        table_mock = mock_event_store._client.table.return_value
        table_mock.insert.assert_called_once()

    @pytest.mark.asyncio
    async def test_updates_status_on_apply(self, soul_evolution, mock_event_store):
        """Applying a proposal updates soul_change_log status."""
        with patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", False):
            proposal = await soul_evolution.propose_change(
                section="Goals",
                proposed_content="New goal",
                reasoning="Testing",
            )

        # Reset mock calls from proposal creation
        mock_event_store._client.reset_mock()

        await soul_evolution.apply_proposal(proposal.id)

        # Verify update was called
        mock_event_store._client.table.assert_called_with("soul_change_log")
        table_mock = mock_event_store._client.table.return_value
        table_mock.update.assert_called_once()


# ---------------------------------------------------------------------------
# Test Memory Integration
# ---------------------------------------------------------------------------

class TestMemoryIntegration:

    @pytest.mark.asyncio
    async def test_appends_to_memory_on_proposal(self, soul_evolution, mock_memory_manager):
        """Proposal creation appends note to MEMORY.md."""
        with patch("podclaw.soul_evolution.SOUL_AUTO_APPROVE", False):
            await soul_evolution.propose_change(
                section="Goals",
                proposed_content="New goal",
                reasoning="Testing memory append",
            )

        # Verify memory append was called
        mock_memory_manager.append_memory.assert_called_once()
        call_args = mock_memory_manager.append_memory.call_args[0][0]
        assert "[Soul]" in call_args
        assert "Goals" in call_args
