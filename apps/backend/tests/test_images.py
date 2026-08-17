import io

import pytest
from PIL import Image

from app.services.images import MAX_DIMENSION, normalize_image


def _jpeg(width: int, height: int, exif: Image.Exif | None = None) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), (120, 160, 140))
    # Pillow rejects an explicit exif=None, so only pass it when set.
    extra = {"exif": exif} if exif is not None else {}
    img.save(buf, format="JPEG", quality=95, **extra)
    return buf.getvalue()


def _png(width: int, height: int, mode: str = "RGBA") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, (width, height), (10, 20, 30, 128)[: len(mode)]).save(buf, format="PNG")
    return buf.getvalue()


def test_strips_trailing_padding():
    """The defect that shipped to production: a complete JPEG followed by
    zero-padding out to a 4096-byte block boundary."""
    original = _jpeg(800, 600)
    padded = original + b"\x00" * (4096 - len(original) % 4096)
    assert padded.rfind(b"\xff\xd9") != len(padded) - 2

    result = normalize_image(padded, "image/jpeg")

    assert result.endswith(b"\xff\xd9")
    assert result.rfind(b"\xff\xd9") == len(result) - 2


def test_downscales_oversized_image():
    result = normalize_image(_jpeg(6000, 4000), "image/jpeg")

    img = Image.open(io.BytesIO(result))
    assert max(img.size) == MAX_DIMENSION
    assert img.size == (MAX_DIMENSION, 1707)  # aspect ratio preserved (4000 * 2560/6000)


def test_leaves_small_image_dimensions_alone():
    result = normalize_image(_jpeg(400, 300), "image/jpeg")

    assert Image.open(io.BytesIO(result)).size == (400, 300)


def test_applies_exif_orientation():
    """A photo shot vertically carries orientation=6 with landscape pixel data.
    Re-encoding drops the tag, so the rotation has to be baked in first or the
    image ships sideways."""
    exif = Image.Exif()
    exif[274] = 6  # rotate 90 CW
    result = normalize_image(_jpeg(600, 400, exif=exif), "image/jpeg")

    img = Image.open(io.BytesIO(result))
    assert img.size == (400, 600)
    assert 274 not in img.getexif()


def test_strips_exif_metadata():
    exif = Image.Exif()
    exif[271] = "SONY"  # Make
    result = normalize_image(_jpeg(800, 600, exif=exif), "image/jpeg")

    assert 271 not in Image.open(io.BytesIO(result)).getexif()


def test_preserves_png_alpha():
    result = normalize_image(_png(300, 300), "image/png")

    img = Image.open(io.BytesIO(result))
    assert img.format == "PNG"
    assert img.mode in ("RGBA", "LA", "P")


def test_flattens_alpha_when_target_is_jpeg():
    """A PNG mislabelled as image/jpeg must not blow up on save."""
    result = normalize_image(_png(300, 300), "image/jpeg")

    img = Image.open(io.BytesIO(result))
    assert img.format == "JPEG"
    assert img.mode == "RGB"


def test_rejects_undecodable_payload():
    with pytest.raises(ValueError):
        normalize_image(b"this is not an image", "image/jpeg")


def test_rejects_truncated_jpeg():
    truncated = _jpeg(800, 600)[: 1024]
    with pytest.raises(ValueError):
        normalize_image(truncated, "image/jpeg")


def test_passes_through_non_normalizable_types():
    """PDFs and formats Pillow may not decode (AVIF) go to R2 untouched rather
    than being rejected."""
    pdf = b"%PDF-1.4 fake pdf body"
    assert normalize_image(pdf, "application/pdf") == pdf
    assert normalize_image(pdf, "image/avif") == pdf


def test_output_is_smaller_for_camera_original():
    original = _jpeg(6000, 4000)
    assert len(normalize_image(original, "image/jpeg")) < len(original)
