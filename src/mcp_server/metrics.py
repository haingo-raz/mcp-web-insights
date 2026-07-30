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