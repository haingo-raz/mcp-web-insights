"""
Tool: check_uptime

Given a URL, make an HTTP request and report whether the site is up, its
status code, and how long it took. No browser needed, just an HTTP client.
"""

import time
import httpx

from ..instrument import instrument


@instrument("check_uptime")
async def check_uptime(url: str) -> dict:
    """Check whether a website is reachable.

    Args:
        url: The full URL to check, e.g. "https://example.com".

    Returns:
        A dict with keys: url, up (bool), status_code, response_time_ms, error.
    """
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
        return {
            "url": url,
            "up": resp.status_code < 400,   # 2xx/3xx = up, 4xx/5xx = down-ish
            "status_code": resp.status_code,
            "response_time_ms": elapsed_ms,
            "error": None,
        }
    except httpx.HTTPError as exc:
        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
        return {
            "url": url,
            "up": False,
            "status_code": None,
            "response_time_ms": elapsed_ms,
            "error": str(exc),
        }