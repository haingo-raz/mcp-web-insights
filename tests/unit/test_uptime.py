"""Unit tests for check_uptime."""

import httpx
import respx

from mcp_server.tools.uptime import check_uptime


@respx.mock
async def test_uptime_reports_up_for_200():
    """A 200 response should be reported as up=True with the status code."""
    respx.get("https://fake.test").mock(return_value=httpx.Response(200))

    result = await check_uptime("https://fake.test")

    assert result["up"] is True
    assert result["status_code"] == 200
    assert result["error"] is None


@respx.mock
async def test_uptime_reports_down_for_500():
    """A 500 response should be reported as up=False (server error)."""
    respx.get("https://fake.test").mock(return_value=httpx.Response(500))

    result = await check_uptime("https://fake.test")

    assert result["up"] is False
    assert result["status_code"] == 500


@respx.mock
async def test_uptime_handles_network_failure():
    """A connection error should be caught and reported, not raised."""
    respx.get("https://fake.test").mock(side_effect=httpx.ConnectError("boom"))

    result = await check_uptime("https://fake.test")

    assert result["up"] is False
    assert result["status_code"] is None
    assert result["error"] is not None