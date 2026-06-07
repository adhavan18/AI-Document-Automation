"""
AWS Textract form extraction — extract key-value pairs and fields directly.

Uses AnalyzeDocument with FORMS feature to extract structured form data,
including field names, values, and confidence scores from USCIS forms.

Returns both plain text (for native extraction fallback) and structured
field extraction as (text, fields_dict).
"""

from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Any


def _client():
    import boto3
    return boto3.client(
        "textract",
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )


def extract_form_fields(pdf_path: str, max_pages: int = 10) -> tuple[str, dict[str, Any]]:
    """
    Extract form fields + plain text from PDF using Textract AnalyzeDocument.

    Returns:
        (full_text, fields_dict)
        - full_text: concatenated LINE blocks across all pages (for native regex fallback)
        - fields_dict: {field_name: {"value": str, "confidence": float}} from form KV extraction
    """
    try:
        import pypdfium2
    except ImportError:
        print("[TEXTRACT] pypdfium2 not installed")
        return "", {}

    path = Path(pdf_path)
    if not path.exists():
        return "", {}

    client = _client()
    doc = pypdfium2.PdfDocument(str(path))
    scale = 150 / 72.0  # 150 DPI default
    n = min(len(doc), max_pages)
    page_texts: list[str] = []
    all_fields: dict[str, Any] = {}

    print(f"[TEXTRACT] Analyzing {path.name} ({n} page(s))")

    for i in range(n):
        bitmap = doc[i].render(scale=scale, rotation=0)
        pil_image = bitmap.to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format="JPEG", quality=95)
        img_bytes = buf.getvalue()

        try:
            # AnalyzeDocument with FORMS feature for structured extraction
            response = client.analyze_document(
                Document={"Bytes": img_bytes},
                FeatureTypes=["FORMS"],
            )

            # Extract text blocks (LINE type) for plain-text fallback
            text_blocks = [
                b["Text"]
                for b in response.get("Blocks", [])
                if b.get("BlockType") == "LINE"
            ]
            page_text = "\n".join(text_blocks)
            page_texts.append(page_text)

            # Extract form key-value pairs
            blocks_by_id = {b["Id"]: b for b in response.get("Blocks", [])}
            for block in response.get("Blocks", []):
                if block.get("BlockType") == "KEY_VALUE_SET" and block.get("EntityTypes") == ["KEY"]:
                    key_block = block
                    key_text = _extract_text_from_block(key_block, blocks_by_id)
                    if not key_text:
                        continue

                    # Find associated value
                    value_block = None
                    for rel in key_block.get("Relationships", []):
                        if rel["Type"] == "VALUE":
                            for val_id in rel["Ids"]:
                                val_block = blocks_by_id.get(val_id)
                                if val_block and val_block.get("EntityTypes") == ["VALUE"]:
                                    value_block = val_block
                                    break
                            if value_block:
                                break

                    value_text = ""
                    confidence = 0.0
                    if value_block:
                        value_text = _extract_text_from_block(value_block, blocks_by_id)
                        confidence = value_block.get("Confidence", 0.0) / 100.0

                    if value_text or key_text:
                        all_fields[key_text] = {
                            "value": value_text,
                            "confidence": confidence,
                        }

            print(f"[TEXTRACT] page {i + 1}: {len(page_text)} chars, {len(all_fields)} form fields")

        except Exception as exc:
            print(f"[TEXTRACT] page {i + 1} failed: {exc}")
            page_texts.append("")

    combined_text = "\n".join(page_texts)
    print(f"[TEXTRACT] Done: {len(combined_text)} total chars, {len(all_fields)} fields")
    return combined_text, all_fields


def _extract_text_from_block(block: dict, blocks_by_id: dict) -> str:
    """Recursively extract text from a block and its children."""
    text_parts = []
    if block.get("Text"):
        text_parts.append(block["Text"])
    for rel in block.get("Relationships", []):
        if rel["Type"] == "CHILD":
            for child_id in rel["Ids"]:
                child_block = blocks_by_id.get(child_id)
                if child_block:
                    text_parts.append(_extract_text_from_block(child_block, blocks_by_id))
    return " ".join(p for p in text_parts if p).strip()


def ocr_pdf(pdf_path: str, max_pages: int = 10) -> str:
    """
    Legacy API: extract plain text only (for backwards compatibility).
    Use extract_form_fields() for structured extraction.
    """
    text, _ = extract_form_fields(pdf_path, max_pages)
    return text


def is_available() -> bool:
    """True when boto3 is importable and AWS credentials are configured."""
    try:
        import boto3  # noqa: F401
        return bool(
            os.environ.get("AWS_ACCESS_KEY_ID")
            and os.environ.get("AWS_SECRET_ACCESS_KEY")
        )
    except ImportError:
        return False
