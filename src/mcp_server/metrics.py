"""
Prometheus metrics for the Observable MCP server.

A "metric" is a number Prometheus scrapes over HTTP on a schedule.
We define the metric objects ONCE here (module-level) so every part of the
app shares the same counters.

Three metric types are used:
- Counter:   only goes up (total calls, total errors). You .inc() it.
- Histogram: records a distribution (e.g. request durations) into buckets,
             so you can later ask "95th percentile latency".
- Gauge:     goes up AND down (e.g. how many requests are in flight now).
"""

from prometheus_client import Counter, Histogram, Gauge

TOOL_CALLS = Counter(
    "mcp_tool_calls_total",
    "Total number of MCP tool invocations.",
    labelnames=("tool", "status"),  # status = "success" | "error"
)

TOOL_DURATION = Histogram(
    "mcp_tool_duration_seconds",
    "Time spent executing an MCP tool, in seconds.",
    labelnames=("tool",),
)

ACTIVE_REQUESTS = Gauge(
    "mcp_active_requests",
    "Number of tool calls currently being processed.",
)