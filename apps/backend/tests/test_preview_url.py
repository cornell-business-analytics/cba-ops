from urllib.parse import parse_qs, urlparse

from app.core.config import settings
from app.services.github import _with_protection_bypass


def test_returns_url_unchanged_without_secret(monkeypatch):
    """Leaving the env var blank must keep the old behaviour rather than
    producing a link with an empty bypass param."""
    monkeypatch.setattr(settings, "VERCEL_PROTECTION_BYPASS_SECRET", "")

    url = "https://cba-website-abc123.vercel.app"
    assert _with_protection_bypass(url) == url


def test_appends_bypass_params(monkeypatch):
    monkeypatch.setattr(settings, "VERCEL_PROTECTION_BYPASS_SECRET", "s3cret")

    result = _with_protection_bypass("https://cba-website-abc123.vercel.app")

    query = parse_qs(urlparse(result).query)
    assert query["x-vercel-protection-bypass"] == ["s3cret"]
    # Without the cookie, only the first request is authenticated and clicking
    # any link inside the preview bounces the reviewer to the login wall.
    assert query["x-vercel-set-bypass-cookie"] == ["true"]


def test_preserves_existing_query_string(monkeypatch):
    monkeypatch.setattr(settings, "VERCEL_PROTECTION_BYPASS_SECRET", "s3cret")

    result = _with_protection_bypass("https://cba-website-abc123.vercel.app/?ref=ops")

    query = parse_qs(urlparse(result).query)
    assert query["ref"] == ["ops"]
    assert query["x-vercel-protection-bypass"] == ["s3cret"]


def test_url_encodes_secret(monkeypatch):
    monkeypatch.setattr(settings, "VERCEL_PROTECTION_BYPASS_SECRET", "a b&c=d")

    result = _with_protection_bypass("https://cba-website-abc123.vercel.app")

    assert parse_qs(urlparse(result).query)["x-vercel-protection-bypass"] == ["a b&c=d"]
