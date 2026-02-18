import os
import tempfile
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None


def _extract_with_pymupdf(pdf_bytes: bytes) -> str:
    if fitz is None:
        raise RuntimeError("PyMuPDF is required. Install with: pip install pymupdf")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    parts = []
    for page in doc:
        parts.append(page.get_text())
    doc.close()
    return "\n".join(parts).strip()


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF. Uses Marker for layout-aware parsing when available, else PyMuPDF."""
    try:
        from marker.converters.pdf import PdfConverter
        from marker.models import create_model_dict
        from marker.output import text_from_rendered
    except ImportError:
        return _extract_with_pymupdf(pdf_bytes)

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        path = f.name
        try:
            f.write(pdf_bytes)
            f.flush()
        finally:
            f.close()
    try:
        converter = PdfConverter(artifact_dict=create_model_dict())
        rendered = converter(path)
        text, _, _ = text_from_rendered(rendered)
        return (text or "").strip() or _extract_with_pymupdf(pdf_bytes)
    except Exception:
        return _extract_with_pymupdf(pdf_bytes)
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass
