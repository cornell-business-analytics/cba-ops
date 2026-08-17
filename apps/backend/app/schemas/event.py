import uuid
from datetime import datetime
from urllib.parse import urlparse

from pydantic import BaseModel, field_validator

from app.models.org import EventType

MAX_LINK_URL_LENGTH = 2048
MAX_LINK_LABEL_LENGTH = 80

# Anything outside this set is rejected rather than sanitized. The URL ends up
# in an href on the public website, so `javascript:` and `data:` payloads are
# the thing to keep out — the frontend renders whatever we store.
ALLOWED_LINK_SCHEMES = {"http", "https"}


def _clean_link_url(value: str | None) -> str | None:
    if value is None:
        return None

    url = value.strip()
    if not url:
        return None

    # Members paste "forms.gle/abc" as often as a full URL. Default the scheme
    # rather than bouncing the form back at them — but only when what follows
    # has no scheme at all, so "javascript:alert(1)" is never silently prefixed
    # into something that looks safe.
    if "//" not in url and ":" not in url.split("/", 1)[0]:
        url = f"https://{url}"

    if len(url) > MAX_LINK_URL_LENGTH:
        raise ValueError(f"Link URL must be at most {MAX_LINK_URL_LENGTH} characters")

    parsed = urlparse(url)
    if parsed.scheme.lower() not in ALLOWED_LINK_SCHEMES:
        raise ValueError("Link URL must start with http:// or https://")
    if not parsed.netloc:
        raise ValueError("Link URL is missing a domain")

    return url


def _clean_link_label(value: str | None) -> str | None:
    if value is None:
        return None
    label = value.strip()
    if not label:
        return None
    if len(label) > MAX_LINK_LABEL_LENGTH:
        raise ValueError(f"Link label must be at most {MAX_LINK_LABEL_LENGTH} characters")
    return label


class _EventLinkFields(BaseModel):
    """Shared validation for the optional call-to-action link."""

    @field_validator("link_url", check_fields=False)
    @classmethod
    def validate_link_url(cls, value: str | None) -> str | None:
        return _clean_link_url(value)

    @field_validator("link_label", check_fields=False)
    @classmethod
    def validate_link_label(cls, value: str | None) -> str | None:
        return _clean_link_label(value)


class EventPublic(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    description: str | None
    location: str | None
    event_date: datetime
    type: EventType
    is_published: bool
    link_url: str | None = None
    link_label: str | None = None

    model_config = {"from_attributes": True}


class EventCreate(_EventLinkFields):
    title: str
    slug: str
    description: str | None = None
    location: str | None = None
    event_date: datetime
    type: EventType
    is_published: bool = False
    link_url: str | None = None
    link_label: str | None = None


class EventUpdate(_EventLinkFields):
    title: str | None = None
    description: str | None = None
    location: str | None = None
    event_date: datetime | None = None
    type: EventType | None = None
    is_published: bool | None = None
    link_url: str | None = None
    link_label: str | None = None
