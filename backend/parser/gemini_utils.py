"""
gemini_utils.py
---------------
Optional Google Gemini AI integration for enhanced resume parsing.
Used as a smart fallback/enhancement when spaCy results are incomplete.
Requires GEMINI_API_KEY environment variable.
"""

import os
import json
import re
from typing import Optional

GEMINI_AVAILABLE = False
_gemini_model = None


def _init_gemini():
    """Lazy initialization of Gemini client."""
    global GEMINI_AVAILABLE, _gemini_model
    if _gemini_model is not None:
        return _gemini_model

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        GEMINI_AVAILABLE = True
        return _gemini_model
    except Exception:
        return None


def is_gemini_available() -> bool:
    """Return True if Gemini API is configured and available."""
    return _init_gemini() is not None


def enhance_with_gemini(resume_text: str, existing_data: dict) -> dict:
    """
    Send resume text to Gemini to fill in missing or low-quality fields.

    Args:
        resume_text: Raw extracted resume text.
        existing_data: Already-parsed fields from spaCy/NLTK.

    Returns:
        Merged dict with Gemini-enhanced fields where applicable.
    """
    model = _init_gemini()
    if model is None:
        return existing_data

    # Only send to Gemini if critical fields are missing
    missing_fields = [
        field for field in ["name", "email", "phone", "skills", "education", "experience"]
        if not existing_data.get(field) or existing_data[field] in [None, [], {}]
    ]

    if not missing_fields and len(existing_data.get("skills", [])) > 5:
        # Everything looks good, no need for Gemini
        return existing_data

    prompt = f"""You are a professional resume parser. Extract information from the following resume text.
Return ONLY a valid JSON object with these exact keys:
- "name": string or null
- "email": string or null  
- "phone": string or null
- "skills": array of strings (technical and soft skills)
- "education": {{"degrees": array of strings, "colleges": array of strings}}
- "experience": {{"companies": array of strings, "designations": array of strings, "total_years": number or null}}
- "links": {{"linkedin": string or null, "github": string or null, "portfolio": string or null}}
- "certifications": array of strings

Resume Text:
---
{resume_text[:4000]}
---

Return ONLY valid JSON. No markdown, no explanation."""

    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Strip markdown code blocks if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        gemini_data = json.loads(raw)

        # Merge: prefer existing spaCy data, use Gemini to fill gaps
        merged = dict(existing_data)

        for key in ["name", "email", "phone"]:
            if not merged.get(key) and gemini_data.get(key):
                merged[key] = gemini_data[key]

        # Merge skills (union)
        existing_skills = set(s.lower() for s in (merged.get("skills") or []))
        gemini_skills = gemini_data.get("skills") or []
        for skill in gemini_skills:
            if skill.lower() not in existing_skills:
                if not isinstance(merged.get("skills"), list):
                    merged["skills"] = []
                merged["skills"].append(skill)

        # Merge education
        existing_edu = merged.get("education") or {}
        gemini_edu = gemini_data.get("education") or {}
        merged["education"] = {
            "degrees": list(dict.fromkeys(
                (existing_edu.get("degrees") or []) + (gemini_edu.get("degrees") or [])
            ))[:5],
            "colleges": list(dict.fromkeys(
                (existing_edu.get("colleges") or []) + (gemini_edu.get("colleges") or [])
            ))[:3],
        }

        # Merge experience
        existing_exp = merged.get("experience") or {}
        gemini_exp = gemini_data.get("experience") or {}
        merged["experience"] = {
            "companies": list(dict.fromkeys(
                (existing_exp.get("companies") or []) + (gemini_exp.get("companies") or [])
            ))[:5],
            "designations": list(dict.fromkeys(
                (existing_exp.get("designations") or []) + (gemini_exp.get("designations") or [])
            ))[:5],
            "total_years": existing_exp.get("total_years") or gemini_exp.get("total_years"),
        }

        # Merge links
        existing_links = merged.get("links") or {}
        gemini_links = gemini_data.get("links") or {}
        merged["links"] = {
            "linkedin": existing_links.get("linkedin") or gemini_links.get("linkedin"),
            "github": existing_links.get("github") or gemini_links.get("github"),
            "portfolio": existing_links.get("portfolio") or gemini_links.get("portfolio"),
            "other": existing_links.get("other") or [],
        }

        # Merge certifications
        existing_certs = merged.get("certifications") or []
        gemini_certs = gemini_data.get("certifications") or []
        merged["certifications"] = list(dict.fromkeys(existing_certs + gemini_certs))[:10]

        return merged

    except (json.JSONDecodeError, Exception):
        # Gemini call failed — return existing data unchanged
        return existing_data
