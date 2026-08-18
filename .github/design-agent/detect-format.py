#!/usr/bin/env python3
"""Prints the image format of the file at argv[1] based on magic bytes.

Output is one of: jpeg, png, webp, gif, other.
Used by the normalize step in design-agent.yml to decide whether
ImageMagick re-encoding is needed before validate-image.py runs.

Stdlib only — same constraint as validate-image.py.
"""
import pathlib
import sys


def detect(data: bytes) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data.startswith(b"GIF8"):
        return "gif"
    return "other"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <path>", file=sys.stderr)
        sys.exit(2)
    print(detect(pathlib.Path(sys.argv[1]).read_bytes()))
