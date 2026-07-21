"""
Observable MCP server: entry point.

This file:
  1. Creates a FastMCP server instance.
  2. Registers our tool functions with it.
  3. Starts a Prometheus metrics HTTP endpoint on a side port, then runs
     the MCP server over stdio.

"""

from mcp.server.fastmcp import FastMCP
from prometheus_client import start_http_server

from .tools.uptime import check_uptime
from .tools.metadata import fetch_page_metadata
from .tools.screenshot import screenshot_url

mcp = FastMCP("observable-web-insights")

mcp.tool()(check_uptime)
mcp.tool()(fetch_page_metadata)
mcp.tool()(screenshot_url)


def main() -> None:
    """Start the metrics server, then run the MCP server (blocking)."""
    # Expose Prometheus metrics at http://localhost:8000/metrics
    start_http_server(8000)

    mcp.run()


if __name__ == "__main__":
    main()