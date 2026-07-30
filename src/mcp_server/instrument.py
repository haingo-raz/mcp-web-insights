"""A decorator that wraps a tool function with Prometheus bookkeeping."""

import time
import functools
from typing import Awaitable, Callable, TypeVar

from .metrics import TOOL_CALLS, TOOL_DURATION, ACTIVE_REQUESTS

R = TypeVar("R")  # keeps the decorated function's return type intact for editors


def instrument(tool_name: str) -> Callable[[Callable[..., Awaitable[R]]], Callable[..., Awaitable[R]]]:
    """Return a decorator that records Prometheus metrics for one tool."""

    def decorator(func: Callable[..., Awaitable[R]]) -> Callable[..., Awaitable[R]]:
        @functools.wraps(func)  # required so FastMCP's introspection sees the original name
        async def wrapper(*args, **kwargs) -> R:
            ACTIVE_REQUESTS.inc()
            start = time.perf_counter()
            status = "success"
            try:
                return await func(*args, **kwargs)
            except Exception:
                status = "error"
                raise
            finally:
                elapsed = time.perf_counter() - start
                TOOL_DURATION.labels(tool=tool_name).observe(elapsed)
                TOOL_CALLS.labels(tool=tool_name, status=status).inc()
                ACTIVE_REQUESTS.dec()
        return wrapper

    return decorator