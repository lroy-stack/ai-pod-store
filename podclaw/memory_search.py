# Copyright (c) 2026 L.LOWE <maintainer@example.com>
# SPDX-License-Identifier: MIT

"""
PodClaw — Cognitive Memory Index (FTS5)
==========================================

Full-text search over memory files using SQLite FTS5.
Indexes: MEMORY.md, daily logs, context files.

BM25 scoring via FTS5 `rank` column. Supports Spanish, German, English
via unicode61 tokenizer.

Future: hybrid search (FTS5 + vector similarity) using embedding_service.py.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class SearchResult:
    """A single search result from the memory index."""

    __slots__ = ("source", "excerpt", "score")

    def __init__(self, source: str, excerpt: str, score: float):
        self.source = source
        self.excerpt = excerpt
        self.score = score

    def to_dict(self) -> dict[str, Any]:
        return {"source": self.source, "excerpt": self.excerpt, "score": round(self.score, 4)}


class MemoryIndex:
    """FTS5-based full-text search over PodClaw memory files.

    Stores documents in a SQLite FTS5 virtual table with BM25 ranking.
    Thread-safe: each operation opens its own connection.
    """

    def __init__(self, db_path: Path):
        self._db_path = db_path
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self._db_path), timeout=10)

    def _ensure_schema(self) -> None:
        """Create FTS5 virtual table if it doesn't exist."""
        conn = self._connect()
        try:
            conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
                    source,
                    content,
                    tokenize='unicode61'
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS memory_meta (
                    source TEXT PRIMARY KEY,
                    indexed_at TEXT NOT NULL,
                    content_hash TEXT NOT NULL
                )
            """)
            conn.commit()
        finally:
            conn.close()

    def index_document(self, source: str, content: str) -> bool:
        """Index or re-index a document. Returns True if content changed."""
        import hashlib
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]

        conn = self._connect()
        try:
            # Check if content has changed
            row = conn.execute(
                "SELECT content_hash FROM memory_meta WHERE source = ?", (source,)
            ).fetchone()

            if row and row[0] == content_hash:
                return False  # No change

            # Delete old entry if exists
            conn.execute("DELETE FROM memory_fts WHERE source = ?", (source,))
            conn.execute("DELETE FROM memory_meta WHERE source = ?", (source,))

            # Split into chunks for better search granularity
            chunks = _split_into_chunks(content, max_chars=500)
            for i, chunk in enumerate(chunks):
                chunk_source = f"{source}#{i}" if len(chunks) > 1 else source
                conn.execute(
                    "INSERT INTO memory_fts (source, content) VALUES (?, ?)",
                    (chunk_source, chunk),
                )

            conn.execute(
                "INSERT INTO memory_meta (source, indexed_at, content_hash) VALUES (?, ?, ?)",
                (source, datetime.now(timezone.utc).isoformat(), content_hash),
            )
            conn.commit()
            return True
        finally:
            conn.close()

    def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        """Search indexed memory with BM25 ranking.

        Returns results sorted by relevance (highest score first).
        """
        if not query or not query.strip():
            return []

        # Escape FTS5 special characters
        safe_query = _sanitize_fts_query(query)
        if not safe_query:
            return []

        conn = self._connect()
        try:
            rows = conn.execute(
                """
                SELECT source, snippet(memory_fts, 1, '>>>', '<<<', '...', 60),
                       rank
                FROM memory_fts
                WHERE memory_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (safe_query, limit),
            ).fetchall()

            results = []
            seen_sources = set()
            for source, excerpt, score in rows:
                # Deduplicate chunks from same source
                base_source = source.split("#")[0]
                if base_source in seen_sources:
                    continue
                seen_sources.add(base_source)
                results.append(SearchResult(
                    source=base_source,
                    excerpt=excerpt,
                    score=abs(score),  # FTS5 rank is negative (lower = better)
                ))

            return results
        except sqlite3.OperationalError as e:
            logger.warning("memory_search_error", query=query[:50], error=str(e))
            return []
        finally:
            conn.close()

    def rebuild(self, memory_dir: Path) -> int:
        """Full reindex from memory files on disk.

        Indexes: MEMORY.md, daily logs (*.md in root), context files (context/*.md).
        Returns number of documents indexed.
        """
        count = 0

        # MEMORY.md
        memory_path = memory_dir / "MEMORY.md"
        if memory_path.is_file():
            content = memory_path.read_text(errors="replace")
            if content.strip():
                self.index_document("MEMORY.md", content)
                count += 1

        # Daily logs (YYYY-MM-DD.md)
        for f in sorted(memory_dir.glob("????-??-??.md")):
            content = f.read_text(errors="replace")
            if content.strip():
                self.index_document(f"daily/{f.name}", content)
                count += 1

        # Context files
        context_dir = memory_dir / "context"
        if context_dir.is_dir():
            for f in sorted(context_dir.glob("*.md")):
                content = f.read_text(errors="replace")
                if content.strip():
                    self.index_document(f"context/{f.name}", content)
                    count += 1

        # Weekly logs
        weekly_dir = memory_dir / "weekly"
        if weekly_dir.is_dir():
            for f in sorted(weekly_dir.glob("*.md")):
                content = f.read_text(errors="replace")
                if content.strip():
                    self.index_document(f"weekly/{f.name}", content)
                    count += 1

        logger.info("memory_index_rebuilt", documents=count)
        return count

    def get_stats(self) -> dict[str, Any]:
        """Return index statistics."""
        conn = self._connect()
        try:
            doc_count = conn.execute("SELECT COUNT(*) FROM memory_meta").fetchone()[0]
            chunk_count = conn.execute("SELECT COUNT(*) FROM memory_fts").fetchone()[0]
            return {"documents": doc_count, "chunks": chunk_count}
        finally:
            conn.close()


def _split_into_chunks(text: str, max_chars: int = 500) -> list[str]:
    """Split text into chunks at paragraph boundaries."""
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chars and current:
            chunks.append(current.strip())
            current = para
        else:
            current = f"{current}\n\n{para}" if current else para

    if current.strip():
        chunks.append(current.strip())

    return chunks or [text[:max_chars]]


def _sanitize_fts_query(query: str) -> str:
    """Sanitize a search query for FTS5 MATCH.

    Removes FTS5 operators and special chars, keeps only search terms.
    """
    # Remove FTS5 special operators
    import re
    # Strip quotes, parentheses, operators
    cleaned = re.sub(r'["\(\)\*\+\-\^]', " ", query)
    # Collapse whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return ""
    # Join terms with implicit AND (FTS5 default)
    return cleaned
