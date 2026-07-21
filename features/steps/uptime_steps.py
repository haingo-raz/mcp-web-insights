"""Step definitions backing features/uptime.feature."""

import asyncio

import httpx
import respx

from behave import given, when, then

from mcp_server.tools.uptime import check_uptime


@given("a website that responds with status {status:d}")
def step_set_status(context, status):
    context.mocked_status = status


@when("I check its uptime")
def step_check_uptime(context):
    with respx.mock:
        respx.get("https://bdd.test").mock(
            return_value=httpx.Response(context.mocked_status)
        )
        context.result = asyncio.run(check_uptime("https://bdd.test"))


@then("the result should say the site is up")
def step_assert_up(context):
    assert context.result["up"] is True, f"Expected up, got {context.result}"


@then("the result should say the site is down")
def step_assert_down(context):
    assert context.result["up"] is False, f"Expected down, got {context.result}"


@then("the status code should be {code:d}")
def step_assert_status(context, code):
    assert context.result["status_code"] == code