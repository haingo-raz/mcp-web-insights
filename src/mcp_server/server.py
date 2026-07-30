"""
MCP_TRANSPORT=stdio (default) runs over stdin/stdout.
MCP_TRANSPORT=sse starts an HTTP server; configure the host and port
via FASTMCP_HOST and FASTMCP_PORT (defaults: 127.0.0.1, 8000).
"""

import os

from mcp.server.fastmcp import FastMCP
from prometheus_client import start_http_server

from .tools.uptime import check_uptime
from .tools.metadata import fetch_page_metadata
from .tools.screenshot import screenshot_url

host = os.getenv("MCP_HOST", "127.0.0.1")
port = int(os.getenv("MCP_PORT", "8080"))
mcp = FastMCP("observable-web-insights", host=host, port=port)

mcp.tool()(check_uptime)
mcp.tool()(fetch_page_metadata)
mcp.tool()(screenshot_url)


def main() -> None:
    """Start the metrics server, then run the MCP server (blocking)."""
    transport = os.getenv("MCP_TRANSPORT", "stdio")

    if transport == "sse":
        start_http_server(9000)
        mcp.run(transport="sse")
    else:
        start_http_server(8000)
        mcp.run()


if __name__ == "__main__":
    main()