import asyncio
import time
from abc import ABC, abstractmethod

import httpx

from src.config import settings
from src.database import Database, ScrapeContext


class BaseScraper(ABC):
    """Base class for all scrapers with shared HTTP + logging logic."""

    source_name: str = "unknown"

    def __init__(self, db: Database | None = None):
        self.db = db or Database()
        self.http_client = httpx.Client(
            timeout=settings.request_timeout_seconds,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
            },
        )

    def fetch(self, url: str) -> str:
        """Fetch a URL with rate limiting. Returns HTML text."""
        time.sleep(settings.request_delay_seconds)
        response = self.http_client.get(url)
        response.raise_for_status()
        return response.text

    def fetch_bytes(self, url: str) -> bytes:
        """Fetch a URL and return raw bytes (for PDFs)."""
        time.sleep(settings.request_delay_seconds)
        response = self.http_client.get(url)
        response.raise_for_status()
        return response.content

    @abstractmethod
    def run(self) -> None:
        """Execute the scraping job."""
        ...

    def run_with_logging(self) -> None:
        """Run the scraper with automatic scrape log tracking."""
        with ScrapeContext(self.db, self.source_name) as ctx:
            self._ctx = ctx
            self.run()

    def close(self):
        self.http_client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
