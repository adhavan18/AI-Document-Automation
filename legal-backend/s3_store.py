"""
Thin boto3 wrapper for the legal-doc-auto S3 bucket.

Bucket layout:
  incoming/   — files uploaded by users, waiting for pipeline processing
  processed/  — files that have completed the extraction pipeline

AWS credentials are loaded from the environment (.env via dotenv in app.py).
"""
from __future__ import annotations

import os
from pathlib import Path

import boto3

BUCKET = "legal-doc-auto"

_s3 = None


def _client():
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
            region_name=os.environ.get("AWS_REGION", "us-east-1"),
        )
    return _s3


def upload_to_incoming(local_path: Path, filename: str) -> str:
    """Upload a local file to incoming/ and return the S3 key."""
    key = f"incoming/{filename}"
    _client().upload_file(str(local_path), BUCKET, key)
    print(f"[S3] Uploaded to s3://{BUCKET}/{key}", flush=True)
    return key


def move_to_processed(incoming_key: str) -> str:
    """Copy incoming/ → processed/, delete the original. Returns the new key."""
    processed_key = "processed/" + incoming_key.removeprefix("incoming/")
    _client().copy_object(
        Bucket=BUCKET,
        CopySource={"Bucket": BUCKET, "Key": incoming_key},
        Key=processed_key,
    )
    _client().delete_object(Bucket=BUCKET, Key=incoming_key)
    print(f"[S3] Moved s3://{BUCKET}/{incoming_key} → {processed_key}", flush=True)
    return processed_key


def stream_object(s3_key: str):
    """Return a boto3 streaming body for the given S3 key."""
    response = _client().get_object(Bucket=BUCKET, Key=s3_key)
    return response["Body"]


def key_exists(s3_key: str) -> bool:
    """Return True if the key exists in the bucket."""
    try:
        _client().head_object(Bucket=BUCKET, Key=s3_key)
        return True
    except Exception:
        return False
