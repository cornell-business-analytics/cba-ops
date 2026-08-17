"""Normalization for user-uploaded images.

Every image that reaches R2 goes through `normalize_image` first. This exists
because raw uploads were reaching the public site untouched, which caused two
production problems:

1. **Non-canonical bytes.** Files arrived zero-padded out to a 4096-byte block
   boundary — a complete JPEG stream (EOI marker intact) followed by tens of KB
   of `\\x00`. Most decoders skip the trailing garbage, so it survived review
   unnoticed, but it is not something that should be committed to the repo. The
   design-agent commits the uploaded bytes verbatim into `apps/website/public/`,
   so whatever lands here is what ships. Re-encoding through Pillow guarantees a
   canonical byte stream regardless of what the client sent.

2. **Camera originals.** Members upload straight off a DSLR — 6000x4000 at
   6-7 MB. Next.js `<Image>` runs those through Vercel's image optimizer, and a
   handful of swaps was enough to exhaust the plan's transformation quota, after
   which every `/_next/image` request on the site returns
   `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` and images stop rendering
   site-wide — not just the swapped ones.

Downscaling to MAX_DIMENSION and re-encoding fixes both, and applying the EXIF
orientation tag means a photo shot in portrait no longer lands sideways once the
metadata is stripped.
"""
import io
import logging

from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

# Per-purpose output settings. Next.js image optimization is switched off (see
# apps/website/next.config.mjs), so whatever is stored here is exactly what a
# visitor downloads — there is no resizing or format negotiation downstream to
# rescue an oversized file. That cuts both ways: it means we must size these
# correctly ourselves, and it means we are free to pick the format.
#
#   website  — full-bleed heroes at 100vw and homepage pillars at 50vw. Kept at
#              2560 because the hero is the one image that renders edge-to-edge
#              on a large display, and kept in its original format because the
#              design-agent commits these into the repo at a fixed path whose
#              extension must keep matching the bytes.
#
#   headshot — a 280px column on a profile page and a 25vw cell in the team
#              grid (~480px on a 1920 viewport). 800 covers both comfortably.
#              These are served straight from R2 with the URL stored whole in
#              the database, so the format is ours to choose: WebP is roughly a
#              third smaller than JPEG at matching quality, and a team page
#              loads dozens of them at once.
PURPOSES = {
    "website": {"max_dimension": 2560, "output_type": None},  # None = keep input format
    "headshot": {"max_dimension": 800, "output_type": "image/webp"},
}
DEFAULT_PURPOSE = "website"
MAX_DIMENSION = PURPOSES[DEFAULT_PURPOSE]["max_dimension"]

# Kept as a name because callers and tests reason in terms of size caps.
MAX_DIMENSIONS = {name: spec["max_dimension"] for name, spec in PURPOSES.items()}

EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

JPEG_QUALITY = 82
WEBP_QUALITY = 80

# Formats we can decode and re-encode safely. AVIF is deliberately absent —
# Pillow only decodes it with a plugin that may not be present, and passing an
# AVIF through untouched is better than rejecting a valid upload.
_NORMALIZABLE = {"image/jpeg", "image/png", "image/webp"}


def _has_alpha(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info


def normalize_image(
    content: bytes, content_type: str, purpose: str = DEFAULT_PURPOSE
) -> tuple[bytes, str]:
    """Decode, orient, downscale and re-encode an uploaded image.

    Returns (bytes, content_type). The returned content type is what the caller
    must store the object as — it is not always the input type, since some
    purposes re-encode to a more efficient format. Use EXTENSIONS to derive the
    matching file extension rather than trusting the uploaded filename.

    Non-image content types (PDF) and formats we cannot decode are returned
    unchanged. A payload that claims to be an image but does not decode raises
    ValueError — that is a corrupt or mislabelled upload and should not be
    silently published to the website.
    """
    spec = PURPOSES[purpose]
    max_dimension = spec["max_dimension"]

    if content_type not in _NORMALIZABLE:
        return content, content_type

    try:
        img = Image.open(io.BytesIO(content))
        img.load()
    except UnidentifiedImageError as exc:
        raise ValueError("File is not a readable image") from exc
    except OSError as exc:
        # Truncated / malformed image data.
        raise ValueError(f"Image could not be decoded: {exc}") from exc

    # Bake in the EXIF orientation tag, since re-encoding drops the metadata
    # that would otherwise tell the browser how to rotate the image.
    img = ImageOps.exif_transpose(img)

    if max(img.size) > max_dimension:
        img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)

    out_type = spec["output_type"] or content_type

    out = io.BytesIO()
    if out_type == "image/jpeg":
        # JPEG has no alpha channel; flatten onto white rather than letting
        # Pillow raise on an RGBA -> JPEG save.
        if _has_alpha(img):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[-1])
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")
        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    elif out_type == "image/png":
        img.save(out, format="PNG", optimize=True)
    else:  # image/webp
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if _has_alpha(img) else "RGB")
        img.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)

    normalized = out.getvalue()
    logger.info(
        "normalized %s -> %s for %s: %d bytes -> %d bytes (%dx%d)",
        content_type, out_type, purpose, len(content), len(normalized), img.width, img.height,
    )
    return normalized, out_type
