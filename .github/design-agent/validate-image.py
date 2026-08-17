#!/usr/bin/env python3
"""Backstop validation for an image about to be committed to apps/website/public/.

The ops-tool upload endpoint re-encodes every image before it reaches R2 (see
apps/backend/app/services/images.py), so anything the design-agent downloads
should already be canonical and web-sized. This script exists because that is
not the only way bytes get here:

  - `workflow_dispatch` can be triggered by hand with an arbitrary
    `attachment_url`, bypassing the ops tool entirely.
  - R2 still holds objects uploaded before normalization existed.

Whatever the workflow downloads is committed verbatim and served to the public
site, so a bad file is worth failing the run over rather than shipping.

Stdlib only — the runner has no Pillow.

Usage: validate-image.py <path>
"""
import pathlib
import sys

# Comfortably above a 2560px-long-edge JPEG at quality 82 (typically 300-700 KB)
# but far below the multi-megabyte camera originals that exhausted the Vercel
# image-optimization quota.
MAX_BYTES = 3 * 1024 * 1024

SIGNATURES = {
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG\r\n\x1a\n": "png",
    b"GIF87a": "gif",
    b"GIF89a": "gif",
}

# Maps file extensions to the format name detect_format returns.
# Extensions not listed here are not checked — SVG and AVIF have quirks that
# make the extension check unreliable without a real parser.
EXTENSION_FORMAT: dict[str, str] = {
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".png": "png",
    ".gif": "gif",
    ".webp": "webp",
}


def detect_format(data: bytes) -> str | None:
    for signature, kind in SIGNATURES.items():
        if data.startswith(signature):
            return kind
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[4:12] in (b"ftypavif", b"ftypavis"):
        return "avif"
    if b"<svg" in data[:1024].lower():
        return "svg"
    return None


def validate(data: bytes) -> tuple[str | None, list[str]]:
    errors: list[str] = []

    if not data:
        return None, ["file is empty"]

    kind = detect_format(data)
    if kind is None:
        errors.append(f"unrecognised image format (first bytes: {data[:8]!r})")

    if kind == "jpeg":
        eoi = data.rfind(b"\xff\xd9")
        if eoi == -1:
            errors.append("JPEG has no end-of-image marker (truncated)")
        else:
            trailing = len(data) - (eoi + 2)
            if trailing > 0:
                # The exact defect that shipped ~30 KB of zero padding to main.
                errors.append(
                    f"JPEG has {trailing:,} bytes of trailing data after the EOI marker"
                )

    if len(data) > MAX_BYTES:
        errors.append(
            f"{len(data):,} bytes exceeds the {MAX_BYTES:,} byte limit — oversized "
            "sources burn the Vercel image-optimization quota"
        )

    return kind, errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {argv[0]} <path>", file=sys.stderr)
        return 2

    path = pathlib.Path(argv[1])
    if not path.is_file():
        print(f"::error::{path} does not exist")
        return 1

    data = path.read_bytes()
    kind, errors = validate(data)

    # Catch format/extension mismatches before they ship as broken images.
    # With Next.js image optimization disabled, the CDN serves the raw file
    # bytes with a Content-Type derived from the extension (e.g. image/jpeg
    # for .jpg). A PNG stored as .jpg will display as a broken image in most
    # browsers. Failing here is better than merging a silently broken asset.
    ext = path.suffix.lower()
    expected = EXTENSION_FORMAT.get(ext)
    if expected and kind and kind != expected:
        errors.append(
            f"file bytes are {kind} but the target path has a .{ext.lstrip('.')} "
            f"extension — upload a {expected.upper()} image, or pick a target "
            f"path whose extension matches the format you're uploading"
        )

    if errors:
        print(f"::error::{path} failed image validation:")
        for error in errors:
            print(f"::error::  - {error}")
        return 1

    print(f"{path}: OK ({kind}, {path.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
