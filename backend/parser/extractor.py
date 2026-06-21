"""
extractor.py
------------
Main orchestrator for the resume parsing pipeline.
Runs spaCy/NLTK extraction first, then optionally enhances with Gemini AI.
"""

from .text_extractor import extract_text
from .nlp_utils import (
    extract_name,
    extract_email,
    extract_phone,
    extract_skills,
    extract_education,
    extract_experience,
    extract_links,
    extract_certifications,
)
from .gemini_utils import enhance_with_gemini, is_gemini_available


def parse_resume(file_bytes: bytes, filename: str) -> dict:
    """
    Full pipeline: file → text → structured data.

    Args:
        file_bytes: Raw bytes of the uploaded resume file.
        filename:   Original filename (determines format).

    Returns:
        Structured dict with all extracted resume fields.
    """

    # Step 1: Extract plain text from file
    try:
        text = extract_text(file_bytes, filename)
    except ValueError as e:
        return {"error": str(e)}

    if not text or len(text.strip()) < 50:
        return {"error": "Could not extract sufficient text from the file. Please check the file quality."}

    # Step 2: Run spaCy + NLTK extraction
    education = extract_education(text)
    experience = extract_experience(text)
    links = extract_links(text)

    structured = {
        "name":           extract_name(text),
        "email":          extract_email(text),
        "phone":          extract_phone(text),
        "skills":         extract_skills(text),
        "education":      education,
        "experience":     experience,
        "links":          links,
        "certifications": extract_certifications(text),
        "raw_text_length": len(text),
        "gemini_enhanced": False,
    }

    # Step 3: Optionally enhance with Gemini AI
    if is_gemini_available():
        enhanced = enhance_with_gemini(text, structured)
        enhanced["gemini_enhanced"] = True
        return enhanced

    return structured
