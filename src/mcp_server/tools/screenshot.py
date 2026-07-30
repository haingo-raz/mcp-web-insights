"""
Set CHROME_BIN and CHROME_DRIVER to override binary paths.
Required in Docker where Chrome is installed at /usr/bin/chromium.
"""

import asyncio
import base64
import os
import tempfile
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

from ..instrument import instrument


def _capture(url: str, out_path: Path) -> None:
    """Blocking Selenium call — must run in a thread, not the event loop."""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,800")

    chrome_bin = os.getenv("CHROME_BIN")
    if chrome_bin:
        options.binary_location = chrome_bin

    chrome_driver = os.getenv("CHROME_DRIVER")
    if chrome_driver:
        service = Service(chrome_driver)
        driver = webdriver.Chrome(service=service, options=options)
    else:
        driver = webdriver.Chrome(options=options)

    try:
        driver.get(url)
        driver.save_screenshot(str(out_path))
    finally:
        driver.quit()


@instrument("screenshot_url")
async def screenshot_url(url: str) -> dict:
    """Capture a screenshot of a rendered web page.

    Args:
        url: The full URL to screenshot, e.g. "https://example.com".

    Returns:
        A dict with keys: url, screenshot_base64 (PNG as base64 string),
        width, height, error.
    """
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        out_path = Path(tmp.name)

    try:
        await asyncio.to_thread(_capture, url, out_path)
        with open(out_path, "rb") as f:
            screenshot_base64 = base64.b64encode(f.read()).decode("utf-8")
        return {
            "url": url,
            "screenshot_base64": screenshot_base64,
            "width": 1280,
            "height": 800,
            "error": None,
        }
    except Exception as exc:
        return {
            "url": url,
            "screenshot_base64": None,
            "width": None,
            "height": None,
            "error": str(exc),
        }
    finally:
        out_path.unlink(missing_ok=True)
