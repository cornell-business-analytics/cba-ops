#!/usr/bin/env python3
"""
Run this once to configure CORS on the R2 bucket via the S3 API.
The Cloudflare dashboard CORS settings only apply to the public (.r2.dev) URL,
not the private S3 API endpoint that presigned upload URLs use.

Usage:
    cd apps/backend
    python set_r2_cors.py
"""
import sys

try:
    import boto3
    from botocore.config import Config
except ImportError:
    sys.exit("boto3 not found — run: pip install boto3")

try:
    from app.core.config import settings
except ImportError:
    sys.exit("Run this script from the apps/backend directory")

if not settings.R2_ACCOUNT_ID or not settings.R2_ACCESS_KEY_ID:
    sys.exit("R2_ACCOUNT_ID / R2_ACCESS_KEY_ID not set in .env")

client = boto3.client(
    "s3",
    endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

client.put_bucket_cors(
    Bucket=settings.R2_BUCKET_NAME,
    CORSConfiguration={
        "CORSRules": [
            {
                "AllowedOrigins": ["https://cba-ops-frontend.vercel.app"],
                "AllowedMethods": ["GET", "PUT"],
                "AllowedHeaders": ["*"],
                "MaxAgeSeconds": 3600,
            }
        ]
    },
)

print(f"CORS set on bucket '{settings.R2_BUCKET_NAME}' — upload should work now.")
