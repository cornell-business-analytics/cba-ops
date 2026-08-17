from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas.event import EventCreate, EventUpdate


def _event(**overrides):
    payload = {
        "title": "Fall Info Session",
        "slug": "fall-info-session",
        "event_date": datetime(2026, 9, 1, 18, 0, tzinfo=UTC),
        "type": "recruitment",
    }
    payload.update(overrides)
    return EventCreate(**payload)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("https://forms.gle/abc123", "https://forms.gle/abc123"),
        ("http://example.com/rsvp", "http://example.com/rsvp"),
        # Bare hostnames are the common paste, so the scheme is defaulted in.
        ("forms.gle/abc123", "https://forms.gle/abc123"),
        ("www.cornellbusinessanalytics.org", "https://www.cornellbusinessanalytics.org"),
        ("  https://example.com/rsvp  ", "https://example.com/rsvp"),
    ],
)
def test_accepts_and_normalizes_valid_urls(raw, expected):
    assert _event(link_url=raw).link_url == expected


@pytest.mark.parametrize(
    "raw",
    [
        "javascript:alert(document.cookie)",
        "JavaScript:alert(1)",
        "  javascript:alert(1)  ",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
    ],
)
def test_rejects_dangerous_schemes(raw):
    """These end up in an href on the public site, so they must never be stored
    — and must never be silently rewritten into something that looks safe."""
    with pytest.raises(ValidationError):
        _event(link_url=raw)


def test_rejects_url_without_domain():
    with pytest.raises(ValidationError):
        _event(link_url="https://")


def test_rejects_overlong_url():
    with pytest.raises(ValidationError):
        _event(link_url="https://example.com/" + "a" * 2100)


@pytest.mark.parametrize("raw", ["", "   ", None])
def test_blank_url_becomes_none(raw):
    assert _event(link_url=raw).link_url is None


@pytest.mark.parametrize("raw", ["", "   ", None])
def test_blank_label_becomes_none(raw):
    assert _event(link_label=raw).link_label is None


def test_label_is_trimmed():
    assert _event(link_label="  RSVP  ").link_label == "RSVP"


def test_rejects_overlong_label():
    with pytest.raises(ValidationError):
        _event(link_label="R" * 81)


def test_update_can_clear_link():
    """PATCH sends an explicit null to remove a link; the handler uses
    exclude_unset so that null reaches the model instead of being dropped."""
    update = EventUpdate(link_url=None)
    assert "link_url" in update.model_dump(exclude_unset=True)
    assert update.model_dump(exclude_unset=True)["link_url"] is None


def test_update_leaves_unsent_fields_alone():
    update = EventUpdate(title="Renamed")
    assert update.model_dump(exclude_unset=True) == {"title": "Renamed"}


def test_update_validates_url_too():
    with pytest.raises(ValidationError):
        EventUpdate(link_url="javascript:alert(1)")
