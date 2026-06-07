"""
AWS Textract OCR — replaces EasyOCR + Tesseract.

Rasterises each PDF page with pypdfium2 and sends JPEG bytes to
Textract DetectDocumentText. No S3 dependency — bytes are sent inline.
"""

from __future__ import annotations

import io
import os
from pathlib import Path


def _client():
    import boto3
    return boto3.client(
        "textract",
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )


def ocr_pdf(pdf_path: str, dpi: int = 150, max_pages: int = 10) -> str:
    """
    Rasterise up to *max_pages* pages of *pdf_path* and run Textract on each.
    Returns concatenated page text, or "" on failure.
    """
    try:
        import pypdfium2
    except ImportError:
        print("[TEXTRACT] pypdfium2 not installed — OCR unavailable")
        return ""

    path = Path(pdf_path)
    if not path.exists():
        return ""

    client = _client()
    doc = pypdfium2.PdfDocument(str(path))
    scale = dpi / 72.0
    n = min(len(doc), max_pages)
    page_texts: list[str] = []

    print(f"[TEXTRACT] OCR start: {path.name} ({n} page(s))")

    for i in range(n):
        bitmap = doc[i].render(scale=scale, rotation=0)
        pil_image = bitmap.to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format="JPEG", quality=95)
        img_bytes = buf.getvalue()

        try:
            response = client.detect_document_text(Document={"Bytes": img_bytes})
            lines = [
                b["Text"]
                for b in response.get("Blocks", [])
                if b["BlockType"] == "LINE"
            ]
            text = "\n".join(lines)
        except Exception as exc:
            print(f"[TEXTRACT] page {i + 1} failed: {exc}")
            text = ""

        page_texts.append(text)
        print(f"[TEXTRACT] page {i + 1}/{n}: {len(text)} chars")

    combined = "\n".join(page_texts)
    print(f"[TEXTRACT] total chars: {len(combined)}")
    return combined


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
