"""
Embedding Service — Provider-agnostic embedding with caching.
================================================================

Abstracts embedding generation behind BaseEmbeddingProvider so MemoryStore
never depends on a specific model or API.  GeminiEmbeddingProvider is the
default (text-embedding-004, 768-dim, free tier).

Embedding cache lives in the same SQLite database as memory chunks —
keyed by SHA256(content) so identical text is never re-embedded.
"""

from __future__ import annotations

import abc
import hashlib
import sqlite3
import struct
from pathlib import Path
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

GEMINI_API = "https://generativelanguage.googleapis.com/v1beta"


# ---------------------------------------------------------------------------
# Serialisation helpers (float32 BLOB — 3 KB per 768-dim vs 6 KB JSON)
# ---------------------------------------------------------------------------

def pack_embedding(values: list[float]) -> bytes:
    """Serialize float list to compact float32 BLOB."""
    return struct.pack(f"{len(values)}f", *values)


def unpack_embedding(blob: bytes) -> list[float]:
    """Deserialize float32 BLOB to float list."""
    return list(struct.unpack(f"{len(blob) // 4}f", blob))


def hash_text(text: str) -> str:
    """SHA256 hex digest of text (OpenClaw internal.ts:146-148 pattern)."""
    return hashlib.sha256(text.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Abstract provider
# ---------------------------------------------------------------------------

class BaseEmbeddingProvider(abc.ABC):
    """Provider-agnostic interface for embedding generation."""

    @property
    @abc.abstractmethod
    def model_id(self) -> str:
        """Identifier string for cache keying (e.g. 'gemini-embedding-001')."""

    @property
    @abc.abstractmethod
    def dimensions(self) -> int:
        """Number of dimensions returned per embedding."""

    @abc.abstractmethod
    async def embed_document(self, text: str) -> list[float]:
        """Embed text intended for indexing/storage."""

    @abc.abstractmethod
    async def embed_query(self, text: str) -> list[float]:
        """Embed text intended for search queries."""

    @abc.abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts for indexing. Order preserved."""


# ---------------------------------------------------------------------------
# Gemini implementation
# ---------------------------------------------------------------------------

class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """Google Gemini text-embedding-004 (768-dim, free tier)."""

    def __init__(self, api_key: str):
        self._key = api_key
        self._model_path = "models/gemini-embedding-001"

    @property
    def model_id(self) -> str:
        return "gemini-embedding-001"

    @property
    def dimensions(self) -> int:
        return 768

    async def embed_document(self, text: str) -> list[float]:
        return await self._embed(text, task_type="RETRIEVAL_DOCUMENT")

    async def embed_query(self, text: str) -> list[float]:
        return await self._embed(text, task_type="RETRIEVAL_QUERY")

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        url = f"{GEMINI_API}/{self._model_path}:batchEmbedContents?key={self._key}"
        requests = [
            {
                "model": self._model_path,
                "content": {"parts": [{"text": t}]},
                "taskType": "RETRIEVAL_DOCUMENT",
            }
            for t in texts
        ]
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json={"requests": requests})
            resp.raise_for_status()
            data = resp.json()
            embeddings = data.get("embeddings", [])
            return [e.get("values", []) for e in embeddings]

    async def _embed(self, text: str, task_type: str) -> list[float]:
        if not text.strip():
            return []
        url = f"{GEMINI_API}/{self._model_path}:embedContent?key={self._key}"
        body: dict[str, Any] = {
            "model": self._model_path,
            "content": {"parts": [{"text": text}]},
            "taskType": task_type,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()
            return data.get("embedding", {}).get("values", [])


# ---------------------------------------------------------------------------
# Cached wrapper (provider-agnostic)
# ---------------------------------------------------------------------------

class CachedEmbeddingService:
    """Wraps any BaseEmbeddingProvider with an SQLite embedding cache.

    Cache key is SHA256(content) — identical text is never re-embedded.
    """

    def __init__(self, provider: BaseEmbeddingProvider, db_path: Path):
        self._provider = provider
        self._db_path = db_path
        self._ensure_cache_table()

    @property
    def model_id(self) -> str:
        return self._provider.model_id

    @property
    def dimensions(self) -> int:
        return self._provider.dimensions

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self._db_path))

    def _ensure_cache_table(self) -> None:
        conn = self._conn()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS embedding_cache (
                    content_hash TEXT PRIMARY KEY,
                    embedding BLOB NOT NULL,
                    model TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            """)
        finally:
            conn.close()

    def _get_cached(self, content_hash: str) -> bytes | None:
        conn = self._conn()
        try:
            row = conn.execute(
                "SELECT embedding FROM embedding_cache WHERE content_hash = ? AND model = ?",
                (content_hash, self._provider.model_id),
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def _put_cache(self, content_hash: str, embedding_blob: bytes) -> None:
        conn = self._conn()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO embedding_cache (content_hash, embedding, model) "
                "VALUES (?, ?, ?)",
                (content_hash, embedding_blob, self._provider.model_id),
            )
            conn.commit()
        finally:
            conn.close()

    async def embed_document(self, text: str) -> list[float]:
        h = hash_text(text)
        cached = self._get_cached(h)
        if cached:
            return unpack_embedding(cached)
        values = await self._provider.embed_document(text)
        if values:
            self._put_cache(h, pack_embedding(values))
        return values

    async def embed_query(self, text: str) -> list[float]:
        # Queries are NOT cached (ephemeral)
        return await self._provider.embed_query(text)

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed batch — only calls API for uncached texts."""
        if not texts:
            return []
        hashes = [hash_text(t) for t in texts]
        results: list[list[float] | None] = [None] * len(texts)
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []

        for i, h in enumerate(hashes):
            cached = self._get_cached(h)
            if cached:
                results[i] = unpack_embedding(cached)
            else:
                uncached_indices.append(i)
                uncached_texts.append(texts[i])

        if uncached_texts:
            new_embeddings = await self._provider.embed_batch(uncached_texts)
            for j, idx in enumerate(uncached_indices):
                if j < len(new_embeddings) and new_embeddings[j]:
                    results[idx] = new_embeddings[j]
                    self._put_cache(hashes[idx], pack_embedding(new_embeddings[j]))
                else:
                    results[idx] = []

        return [r if r is not None else [] for r in results]
