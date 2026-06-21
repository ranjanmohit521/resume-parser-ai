"""
main.py
-------
FastAPI server for the Resume Parser.

Endpoints:
  POST /parse       — Upload a resume file, returns structured JSON
  POST /parse-text  — Accept raw text (used by Chrome extension)
  GET  /health      — Health check
  GET  /formats     — Supported file formats
"""

import os
from pathlib import Path
from typing import Any, Optional
from pydantic import BaseModel

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from parser.extractor import parse_resume
from parser.gemini_utils import is_gemini_available

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Resume Parser API",
    description="AI-powered resume parser using spaCy, NLTK, and optionally Google Gemini.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow all origins for local dev (tighten for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the frontend if it exists
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/app", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

# ---------------------------------------------------------------------------
# Supported formats
# ---------------------------------------------------------------------------
SUPPORTED_FORMATS = [".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".bmp", ".tiff"]
MAX_FILE_SIZE_MB = 10


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "gemini_enabled": is_gemini_available(),
        "supported_formats": SUPPORTED_FORMATS,
    }


@app.get("/formats")
async def supported_formats() -> dict:
    """Return supported file formats."""
    return {
        "formats": [
            {"ext": ".pdf",  "name": "PDF Document",       "icon": "📄"},
            {"ext": ".docx", "name": "Word Document",       "icon": "📝"},
            {"ext": ".txt",  "name": "Plain Text",          "icon": "📋"},
            {"ext": ".jpg",  "name": "JPEG Image (OCR)",    "icon": "🖼️"},
            {"ext": ".jpeg", "name": "JPEG Image (OCR)",    "icon": "🖼️"},
            {"ext": ".png",  "name": "PNG Image (OCR)",     "icon": "🖼️"},
        ]
    }


@app.post("/parse")
async def parse_resume_endpoint(file: UploadFile = File(...)) -> Any:
    """
    Parse an uploaded resume file and return structured data.

    Accepts: PDF, DOCX, TXT, JPG, JPEG, PNG
    Returns: JSON with extracted name, email, phone, skills, education, experience, links, certifications.
    """
    # Validate file extension
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported: {', '.join(SUPPORTED_FORMATS)}"
        )

    # Read file bytes
    file_bytes = await file.read()

    # Validate file size
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum allowed: {MAX_FILE_SIZE_MB} MB."
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Run the parsing pipeline
    result = parse_resume(file_bytes, filename)

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return JSONResponse(content=result)


# ---------------------------------------------------------------------------
# Text endpoint (Chrome Extension)
# ---------------------------------------------------------------------------

class TextPayload(BaseModel):
    """Payload sent by the Chrome extension with scraped page text."""
    text:   str
    source: Optional[str] = "generic"  # 'linkedin' | 'naukri' | 'indeed' | 'generic'


@app.post("/parse-text")
async def parse_text_endpoint(payload: TextPayload) -> Any:
    """
    Parse raw text scraped from a web page (LinkedIn, Naukri, etc.).
    Used by the ResumeAI Chrome Extension.

    Body: { "text": "...", "source": "linkedin" }
    Returns: same JSON structure as /parse
    """
    text = payload.text.strip()

    if not text or len(text) < 30:
        raise HTTPException(
            status_code=400,
            detail="Text is too short to parse. Make sure the page has loaded fully."
        )

    if len(text) > 50_000:
        text = text[:50_000]  # cap at 50k chars

    # Re-use the same NLP pipeline — encode to bytes with a .txt filename
    result = parse_resume(text.encode("utf-8", errors="replace"), "scraped_page.txt")

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    # Tag the source so the extension/frontend can show it
    result["source"] = payload.source
    return JSONResponse(content=result)


# ---------------------------------------------------------------------------
# Entry point for direct execution
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
