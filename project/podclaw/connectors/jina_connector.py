"""
PodClaw — Jina Unified MCP Connector
=======================================

Consolidated connector for all Jina AI services:
- Web search (svip.jina.ai POST)
- URL reading (r.jina.ai POST)
- Image search (svip.jina.ai POST type=images)
- Query expansion (svip.jina.ai POST)
- Reranking (api.jina.ai/v1/rerank)
- Deduplication via embeddings (api.jina.ai/v1/embeddings)
- Parallel web search (asyncio.gather)
- Screenshot capture (r.jina.ai POST X-Return-Format)

Error handling and token guardrail patterns ported from official Jina MCP.
"""

from __future__ import annotations

import asyncio
import math
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

SEARCH_URL = "https://svip.jina.ai/"
READ_URL = "https://r.jina.ai/"
API_URL = "https://api.jina.ai/v1"
MAX_RESPONSE_CHARS = 100_000  # ~25k tokens


class JinaMCPConnector:
    """Unified in-process MCP connector for all Jina AI services."""

    def __init__(self, api_key: str):
        self._key = api_key

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self._key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if extra:
            h.update(extra)
        return h

    def _handle_error(self, status: int, context: str) -> dict[str, Any]:
        if status == 401:
            return {"error": f"{context}: Authentication failed — check JINA_API_KEY"}
        if status == 402:
            return {"error": f"{context}: API key out of quota — top up at jina.ai"}
        if status == 429:
            return {"error": f"{context}: Rate limit exceeded — wait or upgrade key"}
        return {"error": f"{context}: HTTP {status}"}

    def _truncate(self, text: str) -> str:
        if len(text) > MAX_RESPONSE_CHARS:
            return text[:MAX_RESPONSE_CHARS] + "\n\n[truncated — exceeded 100k chars]"
        return text

    # ──────────────────────────────────────────────────────────────────
    # Tool Registry
    # ──────────────────────────────────────────────────────────────────

    def get_tools(self) -> dict[str, dict[str, Any]]:
        return {
            "web_search": {
                "description": (
                    "Search the web for information. Returns results with titles, "
                    "URLs, and descriptions. Supports time filtering, country, and language."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "num": {
                            "type": "integer",
                            "description": "Number of results (1-30, default 10)",
                        },
                        "tbs": {
                            "type": "string",
                            "description": "Time filter: qdr:h (hour), qdr:d (day), qdr:w (week), qdr:m (month), qdr:y (year)",
                        },
                        "gl": {
                            "type": "string",
                            "description": "Country code for localized results (e.g., 'de', 'es', 'us')",
                        },
                        "hl": {
                            "type": "string",
                            "description": "Language code (e.g., 'en', 'de', 'es')",
                        },
                        "site": {
                            "type": "string",
                            "description": "Limit results to a specific site (e.g., 'etsy.com')",
                        },
                    },
                    "required": ["query"],
                },
                "handler": self._web_search,
            },
            "read_url": {
                "description": (
                    "Extract and convert web page content to clean markdown. "
                    "Reads articles, docs, blog posts. Response truncated at ~25k tokens."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "Full URL to read"},
                        "with_links": {
                            "type": "boolean",
                            "description": "Extract all hyperlinks (default false)",
                        },
                        "with_images": {
                            "type": "boolean",
                            "description": "Extract all images (default false)",
                        },
                    },
                    "required": ["url"],
                },
                "handler": self._read_url,
            },
            "search_images": {
                "description": (
                    "FREE image search — your PRIMARY source for product designs. "
                    "Search for TRANSPARENT PNG images first — they don't need background removal. "
                    "Append 'transparent png' to queries and use sites like: "
                    "site:pngimg.com OR site:cleanpng.com OR site:stickpng.com OR site:pngwing.com OR site:freepik.com "
                    "For photos that need bg removal, use: site:unsplash.com OR site:pexels.com OR site:pixabay.com "
                    "Cost: $0."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Image search query"},
                        "gl": {
                            "type": "string",
                            "description": "Country code (e.g., 'de')",
                        },
                        "hl": {
                            "type": "string",
                            "description": "Language code (e.g., 'en')",
                        },
                    },
                    "required": ["query"],
                },
                "handler": self._search_images,
            },
            "expand_query": {
                "description": (
                    "Expand a search query into related queries using Jina's "
                    "query expansion. Returns alternative search terms."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Query to expand"},
                        "num": {
                            "type": "integer",
                            "description": "Number of expanded queries (default 5)",
                        },
                    },
                    "required": ["query"],
                },
                "handler": self._expand_query,
            },
            "jina_rerank": {
                "description": "Rerank search results using Jina Reranker v2",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The search query"},
                        "documents": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Documents to rerank",
                        },
                        "top_n": {
                            "type": "integer",
                            "description": "Number of top results to return",
                        },
                    },
                    "required": ["query", "documents"],
                },
                "handler": self._rerank,
            },
            "deduplicate_strings": {
                "description": (
                    "Remove near-duplicate strings using embedding similarity. "
                    "Uses greedy submodular selection for diversity."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "strings": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of strings to deduplicate",
                        },
                        "threshold": {
                            "type": "number",
                            "description": "Similarity threshold 0-1 (default 0.8). Higher = stricter dedup.",
                        },
                    },
                    "required": ["strings"],
                },
                "handler": self._deduplicate_strings,
            },
            "parallel_search_web": {
                "description": (
                    "Execute multiple web searches in parallel (max 5). "
                    "Returns results for each query. Faster than sequential searches."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "queries": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of search queries (max 5)",
                        },
                        "num": {
                            "type": "integer",
                            "description": "Results per query (default 5)",
                        },
                        "gl": {"type": "string", "description": "Country code"},
                    },
                    "required": ["queries"],
                },
                "handler": self._parallel_search,
            },
            "capture_screenshot": {
                "description": (
                    "Capture a screenshot of a web page. Returns the screenshot "
                    "URL. Useful for visual SEO audits and competitor analysis."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "URL to capture"},
                        "full_page": {
                            "type": "boolean",
                            "description": "Capture full page (default false = first screen only)",
                        },
                    },
                    "required": ["url"],
                },
                "handler": self._capture_screenshot,
            },
        }

    # ──────────────────────────────────────────────────────────────────
    # Tool Handlers
    # ──────────────────────────────────────────────────────────────────

    async def _web_search(self, params: dict[str, Any]) -> dict[str, Any]:
        query = params["query"]
        site = params.get("site")
        if site:
            query = f"site:{site} {query}"

        if not self._key:
            return {"query": query, "results": [], "error": "JINA_API_KEY not configured"}

        body: dict[str, Any] = {
            "q": query,
            "num": min(params.get("num", 10), 30),
        }
        for key in ("tbs", "gl", "hl"):
            if params.get(key):
                body[key] = params[key]

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    SEARCH_URL, headers=self._headers(), json=body, timeout=30,
                )
                if resp.status_code != 200:
                    return self._handle_error(resp.status_code, f"web_search '{query}'")

                data = resp.json()
                results = data.get("data", data.get("results", []))
                logger.info("web_search_ok", query=query, result_count=len(results))

                return {
                    "query": query,
                    "results": [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("url", ""),
                            "description": r.get("description", r.get("content", ""))[:500],
                        }
                        for r in results
                    ],
                }
        except Exception as e:
            logger.error("web_search_error", query=query, error=str(e))
            return {"query": query, "results": [], "error": str(e)}

    async def _read_url(self, params: dict[str, Any]) -> dict[str, Any]:
        url = params["url"]
        if not self._key:
            return {"url": url, "error": "JINA_API_KEY not configured"}

        extra_headers: dict[str, str] = {}
        if params.get("with_links"):
            extra_headers["X-With-Links-Summary"] = "all"
        if params.get("with_images"):
            extra_headers["X-With-Images-Summary"] = "true"
        else:
            extra_headers["X-Retain-Images"] = "none"

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    READ_URL,
                    headers=self._headers(extra_headers),
                    json={"url": url},
                    timeout=60,
                )
                if resp.status_code != 200:
                    return self._handle_error(resp.status_code, f"read_url '{url}'")

                data = resp.json()
                content_data = data.get("data", {})
                content = content_data.get("content", "")
                content = self._truncate(content)

                logger.info("read_url_ok", url=url, content_len=len(content))
                return {
                    "url": url,
                    "title": content_data.get("title", ""),
                    "content": content,
                    "links": content_data.get("links", []) if params.get("with_links") else [],
                    "images": content_data.get("images", []) if params.get("with_images") else [],
                }
        except Exception as e:
            logger.error("read_url_error", url=url, error=str(e))
            return {"url": url, "error": str(e)}

    async def _search_images(self, params: dict[str, Any]) -> dict[str, Any]:
        query = params["query"]
        if not self._key:
            return {"query": query, "images": [], "error": "JINA_API_KEY not configured"}

        body: dict[str, Any] = {"q": query, "type": "images"}
        for key in ("gl", "hl"):
            if params.get(key):
                body[key] = params[key]

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    SEARCH_URL, headers=self._headers(), json=body, timeout=30,
                )
                if resp.status_code != 200:
                    return self._handle_error(resp.status_code, f"search_images '{query}'")

                data = resp.json()
                images = data.get("data", data.get("results", []))
                logger.info("search_images_ok", query=query, count=len(images))

                return {
                    "query": query,
                    "images": [
                        {
                            "title": img.get("title", ""),
                            "url": img.get("url", ""),
                            "image_url": img.get("image", img.get("imageUrl", "")),
                            "source": img.get("source", ""),
                        }
                        for img in images[:20]
                    ],
                }
        except Exception as e:
            logger.error("search_images_error", query=query, error=str(e))
            return {"query": query, "images": [], "error": str(e)}

    async def _expand_query(self, params: dict[str, Any]) -> dict[str, Any]:
        query = params["query"]
        num = params.get("num", 5)
        if not self._key:
            return {"query": query, "expansions": [], "error": "JINA_API_KEY not configured"}

        body: dict[str, Any] = {"q": query, "num": num, "mode": "expansion"}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    SEARCH_URL, headers=self._headers(), json=body, timeout=30,
                )
                if resp.status_code != 200:
                    return self._handle_error(resp.status_code, f"expand_query '{query}'")

                data = resp.json()
                expansions = data.get("data", data.get("results", []))
                logger.info("expand_query_ok", query=query, count=len(expansions))

                return {"query": query, "expansions": expansions}
        except Exception as e:
            logger.error("expand_query_error", query=query, error=str(e))
            return {"query": query, "expansions": [], "error": str(e)}

    async def _rerank(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._key:
            return {"error": "JINA_API_KEY not configured"}

        body: dict[str, Any] = {
            "model": "jina-reranker-v2-base-multilingual",
            "query": params["query"],
            "documents": params["documents"],
        }
        if params.get("top_n"):
            body["top_n"] = params["top_n"]

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{API_URL}/rerank",
                    headers=self._headers(),
                    json=body,
                    timeout=30,
                )
                if resp.status_code != 200:
                    return self._handle_error(resp.status_code, "jina_rerank")
                return resp.json()
        except Exception as e:
            logger.error("rerank_error", error=str(e))
            return {"error": str(e)}

    async def _deduplicate_strings(self, params: dict[str, Any]) -> dict[str, Any]:
        strings = params["strings"]
        threshold = params.get("threshold", 0.8)

        if not self._key:
            return {"error": "JINA_API_KEY not configured"}
        if len(strings) < 2:
            return {"unique": strings, "removed": []}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{API_URL}/embeddings",
                    headers=self._headers(),
                    json={
                        "model": "jina-embeddings-v3",
                        "input": strings,
                        "task": "text-matching",
                    },
                    timeout=30,
                )
                if resp.status_code != 200:
                    return self._handle_error(resp.status_code, "deduplicate_strings")

                data = resp.json()
                embeddings = [d["embedding"] for d in data.get("data", [])]

                if len(embeddings) != len(strings):
                    return {"error": "Embedding count mismatch", "unique": strings, "removed": []}

                selected_indices = self._greedy_select(embeddings, threshold)
                unique = [strings[i] for i in selected_indices]
                removed = [s for i, s in enumerate(strings) if i not in selected_indices]

                logger.info("deduplicate_ok", total=len(strings), unique=len(unique))
                return {"unique": unique, "removed": removed}
        except Exception as e:
            logger.error("deduplicate_error", error=str(e))
            return {"error": str(e), "unique": strings, "removed": []}

    async def _parallel_search(self, params: dict[str, Any]) -> dict[str, Any]:
        queries = params["queries"][:5]  # max 5
        num = params.get("num", 5)
        gl = params.get("gl")

        if not self._key:
            return {"error": "JINA_API_KEY not configured", "results": []}

        async def _single(q: str) -> dict[str, Any]:
            p: dict[str, Any] = {"query": q, "num": num}
            if gl:
                p["gl"] = gl
            return await self._web_search(p)

        tasks = [_single(q) for q in queries]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        output = []
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                output.append({"query": queries[i], "results": [], "error": str(r)})
            else:
                output.append(r)

        logger.info("parallel_search_ok", queries=len(queries), successful=sum(1 for r in output if "error" not in r))
        return {"searches": output}

    async def _capture_screenshot(self, params: dict[str, Any]) -> dict[str, Any]:
        url = params["url"]
        full_page = params.get("full_page", False)

        if not self._key:
            return {"url": url, "error": "JINA_API_KEY not configured"}

        return_format = "pageshot" if full_page else "screenshot"
        extra = {"X-Return-Format": return_format}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    READ_URL,
                    headers=self._headers(extra),
                    json={"url": url},
                    timeout=60,
                )
                if resp.status_code != 200:
                    return self._handle_error(resp.status_code, f"capture_screenshot '{url}'")

                data = resp.json()
                content_data = data.get("data", {})
                screenshot_url = content_data.get("screenshotUrl") or content_data.get("pageshotUrl", "")

                logger.info("screenshot_ok", url=url, has_url=bool(screenshot_url))
                return {"url": url, "screenshot_url": screenshot_url}
        except Exception as e:
            logger.error("screenshot_error", url=url, error=str(e))
            return {"url": url, "error": str(e)}

    # ──────────────────────────────────────────────────────────────────
    # Utility: Greedy Submodular Selection for Deduplication
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    @staticmethod
    def _greedy_select(embeddings: list[list[float]], threshold: float) -> set[int]:
        """Greedy selection: pick items that are not too similar to already-selected."""
        n = len(embeddings)
        if n == 0:
            return set()

        selected = {0}  # always keep first
        for i in range(1, n):
            max_sim = max(
                JinaMCPConnector._cosine_similarity(embeddings[i], embeddings[j])
                for j in selected
            )
            if max_sim < threshold:
                selected.add(i)

        return selected
