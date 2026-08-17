#!/usr/bin/env python3
"""One-time backfill: re-encode images already stored in R2.

Uploads have been normalized on the way in since app/services/images.py
landed, but everything uploaded before that is still whatever the browser
sent — for headshots, a canvas-encoded JPEG at quality 0.95 upscaled to a
1200px short edge, typically 400-900 KB each.

That went unnoticed while Vercel's image optimizer was resizing them on
delivery. With optimization switched off (apps/website/next.config.mjs) the
stored object is exactly what a visitor downloads, so a team page pulls every
one of those files at full size.

Dry run (default — writes nothing):

    uv run python scripts/renormalize_r2_images.py --purpose headshot

Apply, keeping a restorable copy of each original:

    uv run python scripts/renormalize_r2_images.py --purpose headshot --apply

Requires the same R2_* env vars the API uses.
"""
import argparse
import sys

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

sys.path.insert(0, ".")

from app.core.config import settings  # noqa: E402
from app.services.images import DEFAULT_PURPOSE, MAX_DIMENSIONS, normalize_image  # noqa: E402

CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
BACKUP_SUFFIX = ".orig"


def _client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _content_type(key: str) -> str | None:
    for ext, content_type in CONTENT_TYPES.items():
        if key.lower().endswith(ext):
            return content_type
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--purpose", choices=sorted(MAX_DIMENSIONS), default=DEFAULT_PURPOSE,
        help="Which size cap to apply (default: %(default)s)",
    )
    parser.add_argument("--prefix", default="uploads/", help="Key prefix to scan (default: %(default)s)")
    parser.add_argument(
        "--apply", action="store_true",
        help="Actually write. Without this the script only reports what it would do.",
    )
    parser.add_argument(
        "--no-backup", action="store_true",
        help=f"Skip copying each original to <key>{BACKUP_SUFFIX} before overwriting.",
    )
    parser.add_argument(
        "--min-saving", type=int, default=10,
        help="Skip objects that would shrink by less than this %% (default: %(default)s)",
    )
    args = parser.parse_args()

    if not settings.R2_ACCESS_KEY_ID:
        print("R2 credentials are not configured — set the R2_* env vars first.", file=sys.stderr)
        return 2

    max_dimension = MAX_DIMENSIONS[args.purpose]
    client = _client()

    scanned = rewritten = skipped = failed = 0
    bytes_before = bytes_after = 0

    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=settings.R2_BUCKET_NAME, Prefix=args.prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(BACKUP_SUFFIX):
                continue
            content_type = _content_type(key)
            if content_type is None:
                continue

            scanned += 1
            original = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)["Body"].read()

            try:
                normalized = normalize_image(original, content_type, max_dimension)
            except ValueError as exc:
                # Corrupt or mislabelled object — report it, leave it alone.
                print(f"  FAILED  {key}: {exc}")
                failed += 1
                continue

            saving = 100 * (len(original) - len(normalized)) / len(original)
            if saving < args.min_saving:
                skipped += 1
                continue

            bytes_before += len(original)
            bytes_after += len(normalized)
            rewritten += 1
            print(f"  {key}  {len(original):>9,} -> {len(normalized):>9,} bytes  (-{saving:.0f}%)")

            if not args.apply:
                continue

            if not args.no_backup:
                try:
                    client.copy_object(
                        Bucket=settings.R2_BUCKET_NAME,
                        Key=key + BACKUP_SUFFIX,
                        CopySource={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
                    )
                except ClientError as exc:
                    print(f"  FAILED  {key}: could not back up ({exc}) — not overwriting")
                    failed += 1
                    rewritten -= 1
                    continue

            client.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=normalized,
                ContentType=content_type,
            )

    saved = bytes_before - bytes_after
    print()
    print(f"purpose={args.purpose} (max {max_dimension}px)")
    print(f"scanned {scanned}, rewritten {rewritten}, skipped {skipped}, failed {failed}")
    if rewritten:
        print(f"{bytes_before:,} -> {bytes_after:,} bytes ({saved / 1_048_576:.1f} MB saved)")
    if not args.apply:
        print("\nDRY RUN — nothing was written. Re-run with --apply to make these changes.")
    elif not args.no_backup and rewritten:
        print(f"\nOriginals kept alongside each object as <key>{BACKUP_SUFFIX}.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
