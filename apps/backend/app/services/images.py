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

# Longest edge, in pixels. The largest slot any of these images fills is a
# full-bleed hero at 50vw, so 2560 still covers a 2x retina 1280px column with
# room to spare. Anything above this is pure waste.
MAX_DIMENSION = 2560

JPEG_QUALITY = 82
WEBP_QUALITY = 82

# Formats we can decode and re-encode safely. AVIF is deliberately absent —
# Pillow only decodes it with a plugin that may not be present, and passing an
# AVIF through untouched is better than rejecting a valid upload.
_NORMALIZABLE = {"image/jpeg", "image/png", "image/webp"}


def _has_alpha(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info


def normalize_image(content: bytes, content_type: str) -> bytes:
    """Decode, orient, downscale and re-encode an uploaded image.

    Returns canonical bytes in the same format family as the input, so the file
    extension chosen by the caller stays correct.

    Non-image content types (PDF) and formats we cannot decode are returned
    unchanged. A payload that claims to be an image but does not decode raises
    ValueError — that is a corrupt or mislabelled upload and should not be
    silently published to the website.
    """
    if content_type not in _NORMALIZABLE:
        return content

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

    if max(img.size) > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    out = io.BytesIO()
    if content_type == "image/jpeg":
        # JPEG has no alpha channel; flatten onto white rather than letting
        # Pillow raise on an RGBA -> JPEG save.
        if _has_alpha(img):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[-1])
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")
        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    elif content_type == "image/png":
        img.save(out, format="PNG", optimize=True)
    else:  # image/webp
        img.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)

    normalized = out.getvalue()
    logger.info(
        "normalized %s: %d bytes -> %d bytes (%dx%d)",
        content_type, len(content), len(normalized), img.width, img.height,
    )
    return normalized
