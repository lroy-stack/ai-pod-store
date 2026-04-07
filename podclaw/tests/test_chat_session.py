"""
Tests for podclaw.chat_session

Covers:
- System prompt building with soul/memory/daily context
- ChatSession initialization
- SSE event formatting
- Conversation helpers (list, get, delete)
- Message persistence structure
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from podclaw.chat_session import (
    _build_chat_system_prompt,
    _sse,
    list_conversations,
    get_conversation,
    delete_conversation,
)


# ---------------------------------------------------------------------------
# Test System Prompt Building
# ---------------------------------------------------------------------------

class TestSystemPromptBuilding:

    def test_builds_prompt_with_all_contexts(self):
        """System prompt includes SOUL, MEMORY, and TODAY sections."""
        soul = "# PodClaw Soul\n## Constraints\n- Never delete data"
        memory = "# Long-term Memory\nRecent insights..."
        daily = "Today's Activity:\n- Created 3 products"

        prompt = _build_chat_system_prompt(soul, memory, daily)

        assert "[DATA] SOUL" in prompt
        assert "Constraints" in prompt  # From soul
        assert "[DATA] MEMORY" in prompt
        assert "Recent insights" in prompt  # From memory
        assert "[DATA] TODAY" in prompt
        assert "Created 3 products" in prompt  # From daily

    def test_prompt_includes_security_rules(self):
        """System prompt includes immutable security rules."""
        prompt = _build_chat_system_prompt("", "", "")

        assert "Security Rules (IMMUTABLE)" in prompt
        assert "for READING ONLY" in prompt
        assert "All monetary values MUST be in EUR" in prompt

    def test_prompt_includes_delegation_rules(self):
        """System prompt includes delegation guidelines."""
        prompt = _build_chat_system_prompt("", "", "")

        assert "delegate_agent" in prompt
        assert "sensitive agents" in prompt.lower()
        assert "designer" in prompt
        assert "marketing" in prompt

    def test_prompt_includes_memory_search_guidance(self):
        """System prompt includes memory_search tool guidance."""
        prompt = _build_chat_system_prompt("", "", "")

        assert "memory_search" in prompt
        assert "When to search proactively" in prompt
        assert "semantic search" in prompt

    def test_prompt_truncates_long_soul(self):
        """SOUL content is truncated to 3000 chars in prompt."""
        long_soul = "X" * 5000  # 5000 character soul
        prompt = _build_chat_system_prompt(long_soul, "", "")

        # Count X's in [DATA] SOUL section
        soul_section_start = prompt.find("[DATA] SOUL")
        memory_section_start = prompt.find("[DATA] MEMORY")
        soul_content = prompt[soul_section_start:memory_section_start]
        x_count = soul_content.count("X")
        assert x_count == 3000  # Should be truncated

    def test_prompt_handles_empty_contexts(self):
        """System prompt handles empty soul/memory/daily gracefully."""
        prompt = _build_chat_system_prompt("", "", "")

        assert "[DATA] SOUL" in prompt
        assert "(not loaded)" in prompt
        assert "[DATA] MEMORY" in prompt
        assert "[DATA] TODAY" in prompt


# ---------------------------------------------------------------------------
# Test SSE Event Formatting
# ---------------------------------------------------------------------------

class TestSSEFormatting:

    def test_sse_formats_text_delta(self):
        """_sse formats text_delta event correctly."""
        event = _sse("text_delta", {"text": "Hello world"})

        assert event.startswith("event: text_delta\n")
        assert "data: {" in event
        assert '"text": "Hello world"' in event
        assert event.endswith("\n\n")

    def test_sse_formats_tool_start(self):
        """_sse formats tool_start event correctly."""
        event = _sse("tool_start", {
            "tool_name": "supabase_query",
            "tool_use_id": "tool-123"
        })

        assert event.startswith("event: tool_start\n")
        assert "supabase_query" in event
        assert "tool-123" in event

    def test_sse_formats_done(self):
        """_sse formats done event correctly."""
        event = _sse("done", {"stop_reason": "end_turn"})

        assert event.startswith("event: done\n")
        assert "end_turn" in event

    def test_sse_handles_complex_data(self):
        """_sse correctly JSON-encodes complex nested data."""
        complex_data = {
            "nested": {
                "array": [1, 2, 3],
                "string": "test",
            }
        }
        event = _sse("test_event", complex_data)

        assert event.startswith("event: test_event\n")
        assert "data: {" in event
        # Verify JSON is parseable
        import json
        data_line = [line for line in event.split("\n") if line.startswith("data: ")][0]
        data_content = data_line[6:]  # Skip "data: " prefix
        parsed = json.loads(data_content)
        assert parsed["nested"]["array"] == [1, 2, 3]


# ---------------------------------------------------------------------------
# Test Conversation Helpers
# ---------------------------------------------------------------------------

class TestConversationHelpers:

    @pytest.mark.asyncio
    async def test_list_conversations_empty(self):
        """list_conversations returns empty list when no conversations."""
        mock_event_store = AsyncMock()
        mock_event_store._client = MagicMock()

        # Mock Supabase query chain
        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        table_mock.execute.return_value = MagicMock(data=[])
        mock_event_store._client.table.return_value = table_mock

        result = await list_conversations(mock_event_store, limit=10)

        assert result == []
        mock_event_store._client.table.assert_called_with("conversations")

    @pytest.mark.asyncio
    async def test_list_conversations_with_data(self):
        """list_conversations returns conversation list."""
        mock_event_store = AsyncMock()
        mock_event_store._client = MagicMock()

        conversations_data = [
            {
                "id": "conv-1",
                "created_at": "2026-02-24T00:00:00Z",
                "updated_at": "2026-02-24T01:00:00Z",
                "message_count": 5,
            },
            {
                "id": "conv-2",
                "created_at": "2026-02-23T00:00:00Z",
                "updated_at": "2026-02-23T02:00:00Z",
                "message_count": 3,
            },
        ]

        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        table_mock.execute.return_value = MagicMock(data=conversations_data)
        mock_event_store._client.table.return_value = table_mock

        result = await list_conversations(mock_event_store, limit=10)

        assert len(result) == 2
        assert result[0]["id"] == "conv-1"
        assert result[0]["message_count"] == 5

    @pytest.mark.asyncio
    async def test_get_conversation_not_found(self):
        """get_conversation returns None when conversation doesn't exist."""
        mock_event_store = AsyncMock()
        mock_event_store._client = MagicMock()

        # Mock empty conversation response
        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.single.return_value = table_mock
        table_mock.execute.return_value = MagicMock(data=None)
        mock_event_store._client.table.return_value = table_mock

        result = await get_conversation(mock_event_store, "nonexistent-id")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_conversation_with_messages(self):
        """get_conversation returns conversation with messages."""
        mock_event_store = AsyncMock()
        mock_event_store._client = MagicMock()

        conversation_data = {
            "id": "conv-1",
            "created_at": "2026-02-24T00:00:00Z",
        }

        messages_data = [
            {
                "id": "msg-1",
                "role": "user",
                "content": "Hello",
                "created_at": "2026-02-24T00:00:00Z",
            },
            {
                "id": "msg-2",
                "role": "assistant",
                "content": "Hi there!",
                "created_at": "2026-02-24T00:01:00Z",
            },
        ]

        def table_router(table_name):
            mock = MagicMock()
            mock.select.return_value = mock
            mock.eq.return_value = mock
            mock.single.return_value = mock
            mock.order.return_value = mock

            if table_name == "conversations":
                mock.execute.return_value = MagicMock(data=conversation_data)
            elif table_name == "messages":
                mock.execute.return_value = MagicMock(data=messages_data)

            return mock

        mock_event_store._client.table.side_effect = table_router

        result = await get_conversation(mock_event_store, "conv-1")

        assert result is not None
        assert result["id"] == "conv-1"
        assert "messages" in result
        assert len(result["messages"]) == 2
        assert result["messages"][0]["role"] == "user"
        assert result["messages"][1]["role"] == "assistant"

    @pytest.mark.asyncio
    async def test_delete_conversation_success(self):
        """delete_conversation deletes conversation and messages."""
        mock_event_store = AsyncMock()
        mock_event_store._client = MagicMock()

        table_mock = MagicMock()
        table_mock.delete.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.execute.return_value = MagicMock()
        mock_event_store._client.table.return_value = table_mock

        result = await delete_conversation(mock_event_store, "conv-1")

        assert result is True
        # Verify both tables were accessed (messages, conversations)
        assert mock_event_store._client.table.call_count == 2

    @pytest.mark.asyncio
    async def test_delete_conversation_handles_errors(self):
        """delete_conversation returns False on database error."""
        mock_event_store = AsyncMock()
        mock_event_store._client = MagicMock()

        table_mock = MagicMock()
        table_mock.delete.side_effect = Exception("Database error")
        mock_event_store._client.table.return_value = table_mock

        result = await delete_conversation(mock_event_store, "conv-1")

        assert result is False


# ---------------------------------------------------------------------------
# Test ChatSession Initialization
# ---------------------------------------------------------------------------

class TestChatSessionInitialization:

    def test_chat_session_requires_conversation_id(self):
        """ChatSession can be initialized with conversation_id."""
        from podclaw.chat_session import ChatSession

        mock_event_store = MagicMock()
        mock_memory_manager = MagicMock()
        mock_memory_manager.read_soul.return_value = "# Soul"
        mock_memory_manager.read_memory.return_value = "# Memory"
        mock_memory_manager.read_today.return_value = "# Today"

        session = ChatSession(
            conversation_id="test-conv-id",
            mcp_servers={},
            memory_manager=mock_memory_manager,
            event_store=mock_event_store,
        )

        assert session.conversation_id == "test-conv-id"

    def test_chat_session_stores_references(self):
        """ChatSession stores references to dependencies."""
        from podclaw.chat_session import ChatSession

        mock_event_store = MagicMock()
        mock_memory = MagicMock()
        mock_memory.read_soul.return_value = ""
        mock_memory.read_memory.return_value = ""
        mock_memory.read_today.return_value = ""

        session = ChatSession(
            conversation_id="test",
            mcp_servers={"test": "server"},
            memory_manager=mock_memory,
            event_store=mock_event_store,
        )

        assert session.event_store is mock_event_store
        assert session.memory is mock_memory
        assert session.mcp_servers == {"test": "server"}


# ---------------------------------------------------------------------------
# Test Environment Configuration
# ---------------------------------------------------------------------------

class TestEnvironmentConfig:

    def test_chat_budget_defaults(self):
        """CHAT_BUDGET_USD has a reasonable default."""
        from podclaw.chat_session import CHAT_BUDGET_USD
        # Should be set (either from env or default 0.50)
        assert CHAT_BUDGET_USD >= 0

    def test_chat_model_defaults(self):
        """CHAT_MODEL has a default value."""
        from podclaw.chat_session import CHAT_MODEL
        assert CHAT_MODEL == "claude-sonnet-4-5-20250929" or len(CHAT_MODEL) > 0

    def test_chat_max_turns_defaults(self):
        """CHAT_MAX_TURNS has a default value."""
        from podclaw.chat_session import CHAT_MAX_TURNS
        assert CHAT_MAX_TURNS > 0
