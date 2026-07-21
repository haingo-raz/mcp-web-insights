"""
Tool: screenshot_url

Load a URL in a real headless Chrome browser (so JavaScript runs) and capture
a PNG screenshot of the rendered page.

"""

import asyncio
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from ..instrument import instrument

SCREENSHOT_DIR = Path("screenshots")


def _capture(url: str, out_path: Path) -> None:
    """Blocking Selenium work: launch Chrome, load page, save PNG."""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,800")

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
        A dict with keys: url, screenshot_path, width, height, error.
    """
    SCREENSHOT_DIR.mkdir(exist_ok=True)

    safe = "".join(c if c.isalnum() else "_" for c in url)[:60]
    out_path = SCREENSHOT_DIR / f"{safe}_{int(time.time())}.png"

    try:
        await asyncio.to_thread(_capture, url, out_path)
        return {
            "url": url,
            "screenshot_path": str(out_path),
            "width": 1280,
            "height": 800,
            "error": None,
        }
    except Exception as exc:
        return {
            "url": url,
            "screenshot_path": None,
            "width": None,
            "height": None,
            "error": str(exc),
        }