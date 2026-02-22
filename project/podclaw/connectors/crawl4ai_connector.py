"""
PodClaw — Crawl4AI MCP Connector
=================================

Web crawling with JavaScript rendering via Crawl4AI service.
Used by researcher, seo_manager, and marketing agents for competitive analysis
and content research.
"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

# Retry configuration
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0  # seconds
MAX_RETRY_DELAY = 10.0  # seconds


class CrawlForAIMCPConnector:
    """In-process MCP connector for Crawl4AI web crawler."""

    def __init__(self, base_url: str, max_retries: int = MAX_RETRIES, max_concurrent: int = 1):
        """
        Initialize the Crawl4AI connector.

        Args:
            base_url: Base URL of the Crawl4AI service (e.g., "http://crawl4ai:11235")
            max_retries: Maximum number of retry attempts for failed requests
            max_concurrent: Maximum concurrent requests to prevent memory spikes (default: 1)
        """
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
        """
        Make an HTTP request with exponential backoff retry logic and concurrency control.

        Args:
            method: HTTP method (GET, POST, etc.)
            url: Full URL to request
            timeout: Request timeout in seconds
            **kwargs: Additional arguments to pass to the request

        Returns:
            Response JSON as dict

        Raises:
            httpx.HTTPStatusError: If all retries fail with HTTP error
            httpx.TimeoutException: If all retries timeout
            Exception: If all retries fail with other errors
        """
        # Use semaphore to limit concurrent requests
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
                    # Don't retry 4xx client errors (except 429 Too Many Requests)
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

                # Sleep before retry (except on last attempt)
                if attempt < self._max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    # Exponential backoff with jitter
                    retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)

            # All retries exhausted
            logger.error(
                "crawl4ai_all_retries_failed",
                url=url,
                max_retries=self._max_retries,
                last_error=str(last_error),
            )

            # Re-raise the last error
            if last_error:
                raise last_error
            else:
                raise Exception("All retry attempts failed")

    def get_tools(self) -> dict[str, dict[str, Any]]:
        """Return tool definitions for Crawl4AI operations."""
        return {
            "crawl_url": {
                "description": "Crawl a single URL with JavaScript rendering and extract content",
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
                "description": "Extract article content from a URL using content extraction heuristics",
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
                "description": "Recursively crawl a website up to max_depth and max_pages (respects robots.txt)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The starting URL to crawl",
                        },
                        "max_depth": {
                            "type": "integer",
                            "description": "Maximum depth to crawl (1-4, default: 2)",
                            "minimum": 1,
                            "maximum": 4,
                        },
                        "max_pages": {
                            "type": "integer",
                            "description": "Maximum number of pages to crawl (1-100, default: 20)",
                            "minimum": 1,
                            "maximum": 100,
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
                        "viewport": {
                            "type": "object",
                            "description": "Viewport size (default: 1280x720)",
                            "properties": {
                                "width": {"type": "integer"},
                                "height": {"type": "integer"},
                            },
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

    async def _crawl_url(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Crawl a single URL and return extracted content.

        Args:
            params: Contains url, wait_for, screenshot, extract_links, extract_metadata

        Returns:
            Dict containing: url, title, content, links, metadata, screenshot_url
        """
        url = params["url"]

        # Validate URL
        if not url.startswith(("http://", "https://")):
            return {"error": "Invalid URL: must start with http:// or https://"}

        payload = {
            "url": url,
            "wait_for": params.get("wait_for"),
            "screenshot": params.get("screenshot", False),
            "extract_links": params.get("extract_links", True),
            "extract_metadata": params.get("extract_metadata", True),
        }

        try:
            data = await self._request_with_retry(
                "POST",
                f"{self._base_url}/crawl",
                timeout=60.0,
                json=payload,
            )

            logger.info(
                "crawl_url_success",
                url=url,
                title=data.get("title", "")[:50],
                content_length=len(data.get("content", "")),
            )

            return data

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}"
            try:
                error_detail = e.response.text[:200]
                error_msg += f": {error_detail}"
            except:
                pass
            return {"error": error_msg, "url": url}

        except httpx.TimeoutException:
            return {"error": "Request timeout after 60s", "url": url}

        except Exception as e:
            return {"error": f"Crawl failed: {str(e)}", "url": url}

    async def _crawl_batch(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Crawl multiple URLs in parallel.

        Args:
            params: Contains urls (list of strings), extract_links

        Returns:
            Dict containing: results (list of crawl results), success_count, error_count
        """
        urls = params["urls"][:10]  # Limit to 10 URLs max

        if not urls:
            return {"error": "No URLs provided"}

        payload = {
            "urls": urls,
            "extract_links": params.get("extract_links", False),
        }

        try:
            data = await self._request_with_retry(
                "POST",
                f"{self._base_url}/crawl/batch",
                timeout=120.0,
                json=payload,
            )

            results = data.get("results", [])
            success_count = sum(1 for r in results if not r.get("error"))
            error_count = len(results) - success_count

            logger.info(
                "crawl_batch_complete",
                total=len(urls),
                success=success_count,
                errors=error_count,
            )

            return {
                "results": results,
                "success_count": success_count,
                "error_count": error_count,
                "total": len(urls),
            }

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}"
            try:
                error_msg += f": {e.response.text[:200]}"
            except:
                pass
            return {"error": error_msg}

        except httpx.TimeoutException:
            return {"error": "Request timeout after 120s"}

        except Exception as e:
            return {"error": f"Batch crawl failed: {str(e)}"}

    async def _extract_article(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Extract article content using content extraction heuristics.

        Args:
            params: Contains url

        Returns:
            Dict containing: url, title, author, published_date, content, excerpt
        """
        url = params["url"]

        if not url.startswith(("http://", "https://")):
            return {"error": "Invalid URL: must start with http:// or https://"}

        try:
            data = await self._request_with_retry(
                "POST",
                f"{self._base_url}/extract/article",
                timeout=60.0,
                json={"url": url},
            )

            logger.info(
                "extract_article_success",
                url=url,
                title=data.get("title", "")[:50],
                author=data.get("author", ""),
            )

            return data

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}"
            try:
                error_msg += f": {e.response.text[:200]}"
            except:
                pass
            return {"error": error_msg, "url": url}

        except httpx.TimeoutException:
            return {"error": "Request timeout after 60s", "url": url}

        except Exception as e:
            return {"error": f"Article extraction failed: {str(e)}", "url": url}

    async def _crawl_site(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Recursively crawl a website up to max_depth and max_pages.

        Args:
            params: Contains url, max_depth (1-4), max_pages (1-100)

        Returns:
            Dict containing: pages (list of {url, markdown}), total_pages, depth_reached
        """
        url = params["url"]

        if not url.startswith(("http://", "https://")):
            return {"error": "Invalid URL: must start with http:// or https://"}

        # Enforce limits
        max_depth = min(max(params.get("max_depth", 2), 1), 4)
        max_pages = min(max(params.get("max_pages", 20), 1), 100)

        payload = {
            "url": url,
            "max_depth": max_depth,
            "max_pages": max_pages,
        }

        try:
            # Site crawls can take longer
            data = await self._request_with_retry(
                "POST",
                f"{self._base_url}/crawl/site",
                timeout=300.0,  # 5 minutes for full site crawls
                json=payload,
            )

            pages = data.get("pages", [])

            logger.info(
                "crawl_site_success",
                url=url,
                total_pages=len(pages),
                max_depth=max_depth,
                max_pages=max_pages,
            )

            return {
                "pages": pages,
                "total_pages": len(pages),
                "depth_reached": data.get("depth_reached", max_depth),
                "url": url,
            }

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}"
            try:
                error_msg += f": {e.response.text[:200]}"
            except:
                pass
            return {"error": error_msg, "url": url}

        except httpx.TimeoutException:
            return {"error": "Site crawl timeout after 5 minutes", "url": url}

        except Exception as e:
            return {"error": f"Site crawl failed: {str(e)}", "url": url}

    async def _capture_screenshot(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Capture a screenshot of a webpage.

        Args:
            params: Contains url, viewport (optional), full_page (optional)

        Returns:
            Dict containing: url, screenshot (base64 PNG string), viewport
        """
        url = params["url"]

        if not url.startswith(("http://", "https://")):
            return {"error": "Invalid URL: must start with http:// or https://"}

        viewport = params.get("viewport", {"width": 1280, "height": 720})
        full_page = params.get("full_page", False)

        payload = {
            "url": url,
            "viewport": viewport,
            "full_page": full_page,
        }

        try:
            data = await self._request_with_retry(
                "POST",
                f"{self._base_url}/screenshot",
                timeout=60.0,
                json=payload,
            )

            logger.info(
                "capture_screenshot_success",
                url=url,
                viewport=viewport,
                full_page=full_page,
            )

            # Return base64 string directly in response
            return {
                "url": url,
                "screenshot": data.get("screenshot", ""),
                "viewport": viewport,
                "format": "png",
                "encoding": "base64",
            }

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}"
            try:
                error_msg += f": {e.response.text[:200]}"
            except:
                pass
            return {"error": error_msg, "url": url}

        except httpx.TimeoutException:
            return {"error": "Screenshot timeout after 60s", "url": url}

        except Exception as e:
            return {"error": f"Screenshot failed: {str(e)}", "url": url}
