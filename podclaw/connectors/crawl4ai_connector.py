"""
PodClaw — Crawl4AI MCP Connector
=================================

Web crawling with JavaScript rendering via Crawl4AI service (v0.7+).
Uses the official built-in REST API on port 11235.

Real endpoints:
  POST /crawl          — Crawl one or more URLs (main endpoint)
  POST /screenshot     — Capture screenshot (alias, uses /crawl internally)
  GET  /monitor/health — Health check
"""

from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import urlparse

import httpx
import structlog

from podclaw.connectors._shared import validate_ssrf, _err

logger = structlog.get_logger(__name__)

# Retry configuration
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0  # seconds
MAX_RETRY_DELAY = 10.0  # seconds


class CrawlForAIMCPConnector:
    """In-process MCP connector for Crawl4AI web crawler (v0.7+ REST API)."""

    def __init__(self, base_url: str, max_retries: int = MAX_RETRIES, max_concurrent: int = 1):
        if not base_url:
            raise ValueError("CRAWL4AI_URL must be configured")

        self._base_url = base_url.rstrip("/")
        self._max_retries = max_retries
        self._semaphore = asyncio.Semaphore(max_concurrent)
        logger.info(
            "crawl4ai_connector_initialized",
            base_url=self._base_url,
            max_retries=max_retries,
            max_concurrent=max_concurrent,
        )

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        timeout: float = 60.0,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """HTTP request with exponential backoff and concurrency control."""
        async with self._semaphore:
            last_error = None
            retry_delay = INITIAL_RETRY_DELAY

            for attempt in range(self._max_retries):
                try:
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        if method.upper() == "GET":
                            resp = await client.get(url, **kwargs)
                        elif method.upper() == "POST":
                            resp = await client.post(url, **kwargs)
                        else:
                            raise ValueError(f"Unsupported HTTP method: {method}")

                        resp.raise_for_status()
                        return resp.json()

                except httpx.HTTPStatusError as e:
                    last_error = e
                    if 400 <= e.response.status_code < 500 and e.response.status_code != 429:
                        logger.error(
                            "crawl4ai_client_error",
                            status=e.response.status_code,
                            url=url,
                            attempt=attempt + 1,
                        )
                        raise

                    logger.warning(
                        "crawl4ai_http_error_retry",
                        status=e.response.status_code,
                        url=url,
                        attempt=attempt + 1,
                        max_retries=self._max_retries,
                    )

                except httpx.TimeoutException as e:
                    last_error = e
                    logger.warning(
                        "crawl4ai_timeout_retry",
                        url=url,
                        timeout=timeout,
                        attempt=attempt + 1,
                        max_retries=self._max_retries,
                    )

                except Exception as e:
                    last_error = e
                    logger.warning(
                        "crawl4ai_error_retry",
                        error=str(e),
                        url=url,
                        attempt=attempt + 1,
                        max_retries=self._max_retries,
                    )

                if attempt < self._max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)

            logger.error(
                "crawl4ai_all_retries_failed",
                url=url,
                max_retries=self._max_retries,
                last_error=str(last_error),
            )

            if last_error:
                raise last_error
            else:
                raise Exception("All retry attempts failed")

    # ------------------------------------------------------------------
    # Internal: call POST /crawl (the one real endpoint)
    # ------------------------------------------------------------------

    async def _post_crawl(
        self,
        urls: list[str],
        *,
        timeout: float = 60.0,
        screenshot: bool = False,
        wait_for: str | None = None,
        css_selector: str | None = None,
        word_count_threshold: int = 10,
        cache_mode: str = "bypass",
    ) -> dict[str, Any]:
        """
        Core method — POST /crawl with Crawl4AI v0.7+ payload format.

        Args:
            urls: List of URLs to crawl.
            screenshot: Capture screenshot per page.
            wait_for: CSS selector to wait for before extraction.
            css_selector: Extract only content matching this selector.
            word_count_threshold: Minimum words per block to keep.
            cache_mode: "bypass", "enabled", "disabled", "read_only", "write_only".

        Returns:
            Raw response dict from Crawl4AI server.
        """
        crawler_params: dict[str, Any] = {
            "cache_mode": cache_mode,
            "word_count_threshold": word_count_threshold,
        }
        if screenshot:
            crawler_params["screenshot"] = True
        if wait_for:
            crawler_params["wait_for"] = f"css:{wait_for}"
        if css_selector:
            crawler_params["css_selector"] = css_selector

        payload: dict[str, Any] = {
            "urls": urls[0] if len(urls) == 1 else urls,
            "browser_config": {
                "type": "BrowserConfig",
                "params": {
                    "headless": True,
                    "viewport_width": 1280,
                    "viewport_height": 720,
                },
            },
            "crawler_config": {
                "type": "CrawlerRunConfig",
                "params": crawler_params,
            },
        }

        return await self._request_with_retry(
            "POST",
            f"{self._base_url}/crawl",
            timeout=timeout,
            json=payload,
        )

    @staticmethod
    def _parse_result(result: dict[str, Any]) -> dict[str, Any]:
        """Normalize a single crawl result into our tool output format."""
        markdown_data = result.get("markdown", {})
        if isinstance(markdown_data, str):
            content = markdown_data
        else:
            content = (
                markdown_data.get("fit_markdown")
                or markdown_data.get("raw_markdown")
                or ""
            )

        links = result.get("links", {})
        internal = links.get("internal", []) if isinstance(links, dict) else []
        external = links.get("external", []) if isinstance(links, dict) else []

        media = result.get("media", {})
        images = media.get("images", []) if isinstance(media, dict) else []

        return {
            "url": result.get("url", ""),
            "title": (result.get("metadata", {}) or {}).get("title", ""),
            "content": content[:15000],  # Cap to avoid token explosion
            "links": {
                "internal": [l.get("href", "") for l in internal[:50]],
                "external": [l.get("href", "") for l in external[:50]],
            },
            "images": [
                {"src": img.get("src", ""), "alt": img.get("alt", "")}
                for img in images[:30]
            ],
            "metadata": result.get("metadata", {}),
            "success": result.get("success", False),
            "status_code": result.get("status_code", 0),
        }

    # ------------------------------------------------------------------
    # Tool definitions
    # ------------------------------------------------------------------

    def get_tools(self) -> dict[str, dict[str, Any]]:
        """Return tool definitions for Crawl4AI operations."""
        return {
            "crawl_url": {
                "description": "Crawl a single URL with JavaScript rendering and extract content as markdown",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The URL to crawl (must be a valid http/https URL)",
                        },
                        "wait_for": {
                            "type": "string",
                            "description": "CSS selector to wait for before extracting content",
                        },
                        "screenshot": {
                            "type": "boolean",
                            "description": "Whether to capture a screenshot (default: false)",
                        },
                        "extract_links": {
                            "type": "boolean",
                            "description": "Whether to extract all links from the page (default: true)",
                        },
                        "extract_metadata": {
                            "type": "boolean",
                            "description": "Whether to extract meta tags and structured data (default: true)",
                        },
                    },
                    "required": ["url"],
                },
                "handler": self._crawl_url,
            },
            "crawl_batch": {
                "description": "Crawl multiple URLs in parallel (max 10 URLs per batch)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "urls": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of URLs to crawl (max 10)",
                        },
                        "extract_links": {
                            "type": "boolean",
                            "description": "Whether to extract links from each page (default: false)",
                        },
                    },
                    "required": ["urls"],
                },
                "handler": self._crawl_batch,
            },
            "extract_article": {
                "description": "Extract article content from a URL (title, author, body as clean markdown)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The article URL to extract content from",
                        },
                    },
                    "required": ["url"],
                },
                "handler": self._extract_article,
            },
            "crawl_site": {
                "description": "Crawl a website starting from a URL, following internal links up to max_depth/max_pages",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The starting URL to crawl",
                        },
                        "max_depth": {
                            "type": "integer",
                            "description": "Maximum link-follow depth (1-3, default: 2)",
                            "minimum": 1,
                            "maximum": 3,
                        },
                        "max_pages": {
                            "type": "integer",
                            "description": "Maximum number of pages to crawl (1-20, default: 10)",
                            "minimum": 1,
                            "maximum": 20,
                        },
                    },
                    "required": ["url"],
                },
                "handler": self._crawl_site,
            },
            "capture_screenshot": {
                "description": "Capture a screenshot of a webpage as base64 PNG",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The URL to screenshot",
                        },
                        "full_page": {
                            "type": "boolean",
                            "description": "Capture full page scroll (default: false)",
                        },
                    },
                    "required": ["url"],
                },
                "handler": self._capture_screenshot,
            },
        }

    # ------------------------------------------------------------------
    # Tool handlers
    # ------------------------------------------------------------------

    async def _crawl_url(self, params: dict[str, Any]) -> dict[str, Any]:
        """Crawl a single URL via POST /crawl."""
        url = params["url"]
        try:
            validate_ssrf(url)
        except ValueError as e:
            return _err(str(e))

        try:
            data = await self._post_crawl(
                [url],
                screenshot=params.get("screenshot", False),
                wait_for=params.get("wait_for"),
            )

            results = data.get("results", [])
            if not results:
                return {"error": "No results returned", "url": url}

            parsed = self._parse_result(results[0])
            logger.info(
                "crawl_url_success",
                url=url,
                title=parsed.get("title", "")[:50],
                content_length=len(parsed.get("content", "")),
            )
            return parsed

        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}", "url": url}
        except httpx.TimeoutException:
            return {"error": "Request timeout after 60s", "url": url}
        except Exception as e:
            return {"error": f"Crawl failed: {str(e)}", "url": url}

    async def _crawl_batch(self, params: dict[str, Any]) -> dict[str, Any]:
        """Crawl multiple URLs via single POST /crawl with urls array."""
        urls = params["urls"][:10]
        if not urls:
            return {"error": "No URLs provided"}

        # Validate all URLs (SSRF protection)
        for u in urls:
            try:
                validate_ssrf(u)
            except ValueError as e:
                return _err(f"URL blocked: {u} — {e}")

        try:
            data = await self._post_crawl(urls, timeout=120.0)

            results = data.get("results", [])
            parsed = [self._parse_result(r) for r in results]
            success_count = sum(1 for r in parsed if r.get("success"))
            error_count = len(parsed) - success_count

            logger.info(
                "crawl_batch_complete",
                total=len(urls),
                success=success_count,
                errors=error_count,
            )

            return {
                "results": parsed,
                "success_count": success_count,
                "error_count": error_count,
                "total": len(urls),
            }

        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}"}
        except httpx.TimeoutException:
            return {"error": "Request timeout after 120s"}
        except Exception as e:
            return {"error": f"Batch crawl failed: {str(e)}"}

    async def _extract_article(self, params: dict[str, Any]) -> dict[str, Any]:
        """Extract article content via POST /crawl with content-focused params."""
        url = params["url"]
        try:
            validate_ssrf(url)
        except ValueError as e:
            return _err(str(e))

        try:
            # Use article-focused selectors
            data = await self._post_crawl(
                [url],
                css_selector="article, [role='article'], .post-content, .article-body, main",
                word_count_threshold=20,
            )

            results = data.get("results", [])
            if not results:
                return {"error": "No results returned", "url": url}

            result = results[0]
            metadata = result.get("metadata", {}) or {}

            markdown_data = result.get("markdown", {})
            if isinstance(markdown_data, str):
                content = markdown_data
            else:
                content = (
                    markdown_data.get("fit_markdown")
                    or markdown_data.get("raw_markdown")
                    or ""
                )

            article = {
                "url": url,
                "title": metadata.get("title", ""),
                "author": metadata.get("author", ""),
                "published_date": metadata.get("published_date", metadata.get("date", "")),
                "content": content[:15000],
                "excerpt": content[:500] if content else "",
                "success": result.get("success", False),
            }

            logger.info(
                "extract_article_success",
                url=url,
                title=article["title"][:50],
                author=article["author"],
            )
            return article

        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}", "url": url}
        except httpx.TimeoutException:
            return {"error": "Request timeout after 60s", "url": url}
        except Exception as e:
            return {"error": f"Article extraction failed: {str(e)}", "url": url}

    async def _crawl_site(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Crawl a website by following internal links.

        Implemented client-side: crawl start URL, extract internal links,
        crawl next level, repeat up to max_depth/max_pages.
        """
        start_url = params["url"]
        try:
            validate_ssrf(start_url)
        except ValueError as e:
            return _err(str(e))

        max_depth = min(max(params.get("max_depth", 2), 1), 3)
        max_pages = min(max(params.get("max_pages", 10), 1), 20)

        parsed_start = urlparse(start_url)
        base_domain = parsed_start.netloc

        visited: set[str] = set()
        pages: list[dict[str, Any]] = []
        current_urls = [start_url]

        try:
            for depth in range(max_depth):
                if not current_urls or len(pages) >= max_pages:
                    break

                # Crawl current level (batch)
                batch = [u for u in current_urls if u not in visited][:max_pages - len(pages)]
                if not batch:
                    break

                visited.update(batch)

                data = await self._post_crawl(
                    batch,
                    timeout=120.0,
                )

                results = data.get("results", [])
                next_urls: list[str] = []

                for result in results:
                    if not result.get("success"):
                        continue

                    parsed = self._parse_result(result)
                    pages.append({
                        "url": parsed["url"],
                        "title": parsed["title"],
                        "content": parsed["content"][:5000],  # Shorter for site crawl
                        "depth": depth,
                    })

                    # Collect internal links for next depth
                    for link in parsed.get("links", {}).get("internal", []):
                        if link and link not in visited:
                            link_parsed = urlparse(link)
                            if link_parsed.netloc == base_domain:
                                next_urls.append(link)

                current_urls = next_urls[:max_pages]

            logger.info(
                "crawl_site_success",
                url=start_url,
                total_pages=len(pages),
                max_depth=max_depth,
            )

            return {
                "pages": pages,
                "total_pages": len(pages),
                "max_depth_used": max_depth,
                "url": start_url,
            }

        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}", "url": start_url}
        except httpx.TimeoutException:
            return {"error": "Site crawl timeout", "url": start_url}
        except Exception as e:
            return {"error": f"Site crawl failed: {str(e)}", "url": start_url}

    async def _capture_screenshot(self, params: dict[str, Any]) -> dict[str, Any]:
        """Capture screenshot via POST /crawl with screenshot=True."""
        url = params["url"]
        try:
            validate_ssrf(url)
        except ValueError as e:
            return _err(str(e))

        try:
            data = await self._post_crawl(
                [url],
                screenshot=True,
                timeout=60.0,
            )

            results = data.get("results", [])
            if not results:
                return {"error": "No results returned", "url": url}

            result = results[0]
            screenshot_data = result.get("screenshot", "")

            logger.info(
                "capture_screenshot_success",
                url=url,
                has_data=bool(screenshot_data),
            )

            return {
                "url": url,
                "screenshot": screenshot_data,
                "format": "png",
                "encoding": "base64",
            }

        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}", "url": url}
        except httpx.TimeoutException:
            return {"error": "Screenshot timeout after 60s", "url": url}
        except Exception as e:
            return {"error": f"Screenshot failed: {str(e)}", "url": url}
