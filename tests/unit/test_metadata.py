"""Unit tests for fetch_page_metadata."""

import httpx
import respx

from mcp_server.tools.metadata import fetch_page_metadata

SAMPLE_HTML = """
<html>
  <head>
    <title>Test Page</title>
    <meta name="description" content="A page for testing.">
    <meta property="og:title" content="OG Test Title">
  </head>
  <body>Hello</body>
</html>
"""


@respx.mock
async def test_metadata_extracts_title_and_description():
    """Title, description, and og: tags should be extracted from the HTML."""
    respx.get("https://fake.test").mock(
        return_value=httpx.Response(200, text=SAMPLE_HTML)
    )

    result = await fetch_page_metadata("https://fake.test")

    assert result["title"] == "Test Page"
    assert result["description"] == "A page for testing."
    assert result["open_graph"]["og:title"] == "OG Test Title"
    assert result["error"] is None


@respx.mock
async def test_metadata_handles_error_status():
    """A 404 response should return an error dict with title=None."""
    respx.get("https://fake.test").mock(return_value=httpx.Response(404))

    result = await fetch_page_metadata("https://fake.test")

    assert result["title"] is None
    assert result["error"] is not None