"""
Tool: fetch_page_metadata

Given a URL, fetch the HTML and pull out the metadata a browser or search
engine cares about: the <title>, the meta description, and Open Graph tags
(og:title, og:image, etc. -- the stuff that builds link previews).

"""

from html.parser import HTMLParser

import httpx

from ..instrument import instrument


class _MetaExtractor(HTMLParser):
    """A tiny HTML parser that collects <title> and <meta> tags.

    HTMLParser fires callbacks as it walks the document. We override three:
    handle_starttag (for <meta> and opening <title>), handle_endtag (to know
    when <title> closes), and handle_data (the text inside <title>).
    """

    def __init__(self) -> None:
        super().__init__()
        self.title: str | None = None
        self._in_title = False
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            a = dict(attrs)
            key = a.get("name") or a.get("property")
            content = a.get("content")
            if key and content:
                self.meta[key.lower()] = content

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title and data.strip():
            self.title = data.strip()


@instrument("fetch_page_metadata")
async def fetch_page_metadata(url: str) -> dict:
    """Fetch a page and extract its title, description, and Open Graph tags.

    Args:
        url: The full URL to inspect, e.g. "https://example.com".

    Returns:
        A dict with keys: url, title, description, open_graph (dict), error.
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()   # turn a 4xx/5xx into an exception here
            html = resp.text
    except httpx.HTTPError as exc:
        return {"url": url, "title": None, "description": None,
                "open_graph": {}, "error": str(exc)}

    parser = _MetaExtractor()
    parser.feed(html)

    open_graph = {k: v for k, v in parser.meta.items() if k.startswith("og:")}

    return {
        "url": url,
        "title": parser.title,
        "description": parser.meta.get("description"),
        "open_graph": open_graph,
        "error": None,
    }