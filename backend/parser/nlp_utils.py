"""
nlp_utils.py
------------
Core NLP extraction utilities using NLTK and regex.
Optional spaCy integration for enhanced entity recognition.
Handles: name, email, phone, skills, education, experience,
         links, certifications, total experience in years.
"""

import re
import csv
from pathlib import Path
from datetime import datetime
from typing import Optional

# ---------------------------------------------------------------------------
# Lazy imports (graceful degradation if packages missing)
# ---------------------------------------------------------------------------
_spacy_nlp = None
_nltk_ready = False
_SKILLS_SET: set[str] = set()

SKILLS_DB_PATH = Path(__file__).parent / "skills_db.csv"


def _load_spacy():
    global _spacy_nlp
    if _spacy_nlp is not None:
        return _spacy_nlp
    try:
        import spacy
        _spacy_nlp = spacy.load("en_core_web_sm")
    except Exception:
        _spacy_nlp = None
    return _spacy_nlp


def _load_nltk():
    global _nltk_ready
    if _nltk_ready:
        return
    try:
        import nltk
        for pkg in ["words", "stopwords", "punkt", "punkt_tab", "averaged_perceptron_tagger_eng", "maxent_ne_chunker_tab"]:
            try:
                nltk.download(pkg, quiet=True)
            except Exception:
                pass
        _nltk_ready = True
    except Exception:
        pass


def _load_skills():
    global _SKILLS_SET
    if _SKILLS_SET:
        return _SKILLS_SET
    try:
        if SKILLS_DB_PATH.exists():
            with open(SKILLS_DB_PATH, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                for row in reader:
                    for cell in row:
                        skill = cell.strip()
                        if skill:
                            _SKILLS_SET.add(skill.lower())
    except Exception:
        pass
    return _SKILLS_SET


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
def extract_email(text: str) -> Optional[str]:
    """Extract first valid email address from text."""
    pattern = r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
    matches = re.findall(pattern, text)
    return matches[0] if matches else None


# ---------------------------------------------------------------------------
# Phone Numbers
# ---------------------------------------------------------------------------
def extract_phone(text: str) -> Optional[str]:
    """Extract phone/mobile number (Indian and international formats)."""
    patterns = [
        r"(?:\+91[\-\s]?)?[6-9]\d{9}",                      # Indian mobile
        r"(?:\+\d{1,3}[\-\s]?)?\(?\d{3}\)?[\-\s]?\d{3}[\-\s]?\d{4}",  # US/intl
        r"\+\d[\d\s\-]{8,14}\d",                             # Generic international
    ]
    for pattern in patterns:
        matches = re.findall(pattern, text)
        if matches:
            phone = re.sub(r"[\s\-]", "", matches[0])
            return phone
    return None


# ---------------------------------------------------------------------------
# Name
# ---------------------------------------------------------------------------
_NAME_TITLE_WORDS = {
    "resume", "curriculum", "vitae", "cv", "profile", "objective",
    "summary", "contact", "email", "phone", "address", "mobile",
    "linkedin", "github", "portfolio",
}

def extract_name(text: str) -> Optional[str]:
    """Extract candidate name using spaCy NER or NLTK heuristic."""
    nlp = _load_spacy()
    if nlp:
        doc = nlp(text[:500])
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                name = ent.text.strip()
                words = name.split()
                if (
                    len(words) >= 2
                    and not any(char.isdigit() for char in name)
                    and name.lower() not in _NAME_TITLE_WORDS
                ):
                    return name
    return _name_from_first_line(text)


def _name_from_first_line(text: str) -> Optional[str]:
    """Heuristic: pick first capitalised short line as the name."""
    for line in text.split("\n")[:10]:
        line = line.strip()
        if (
            2 <= len(line.split()) <= 5
            and line[0].isupper()
            and not any(char.isdigit() for char in line)
            and not any(kw in line.lower() for kw in _NAME_TITLE_WORDS)
        ):
            return line
    return None


# ---------------------------------------------------------------------------
# Links
# ---------------------------------------------------------------------------
def extract_links(text: str) -> dict:
    """Extract LinkedIn, GitHub, and other notable URLs."""
    # With http prefix
    url_pattern = r"https?://[^\s\)\]\,\;\'\"]+"
    all_urls = re.findall(url_pattern, text, re.IGNORECASE)

    # Without http prefix (e.g. linkedin.com/in/johndoe)
    bare_linkedin = re.findall(r"(?:www\.)?linkedin\.com/in/[^\s\)\]\,\;\'\"/]+", text, re.IGNORECASE)
    bare_github   = re.findall(r"(?:www\.)?github\.com/[^\s\)\]\,\;\'\"/]+", text, re.IGNORECASE)
    all_urls += ["https://" + u for u in bare_linkedin + bare_github]

    result = {"linkedin": None, "github": None, "portfolio": None, "other": []}
    for url in all_urls:
        url_lower = url.lower()
        if "linkedin.com" in url_lower and not result["linkedin"]:
            result["linkedin"] = url
        elif "github.com" in url_lower and not result["github"]:
            result["github"] = url
        elif any(kw in url_lower for kw in ["portfolio", "me.", "personal", "site"]):
            result["portfolio"] = url
        else:
            if url not in result["other"]:
                result["other"].append(url)
    return result


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------
def extract_skills(text: str) -> list[str]:
    """Match skills from text against skills_db.csv using regex."""
    skills_set = _load_skills()
    text_lower = text.lower()
    found_skills = {s for s in skills_set if re.search(r"\b" + re.escape(s) + r"\b", text_lower)}
    return sorted([s.title() for s in found_skills])


# ---------------------------------------------------------------------------
# Education
# ---------------------------------------------------------------------------
_DEGREE_PATTERNS = [r"\b(B\.?E\.?|B\.?Tech|M\.?Tech|B\.?Sc|M\.?Sc|Bachelor(?:'s)?|Master(?:'s)?|PhD|MBA|BCA|MCA)\b"]
_COLLEGE_KEYWORDS = ["university", "college", "institute", "school", "academy"]

def extract_education(text: str) -> dict:
    """Extract degrees and colleges using regex."""
    degrees = []
    for pattern in _DEGREE_PATTERNS:
        degrees.extend(re.findall(pattern, text, re.IGNORECASE))
    
    colleges = [line.strip() for line in text.split("\n") 
                if any(kw in line.lower() for kw in _COLLEGE_KEYWORDS)]
    
    return {
        "degrees": list(dict.fromkeys(degrees)),
        "colleges": list(dict.fromkeys(colleges))[:3],
    }


# ---------------------------------------------------------------------------
# Work Experience
# ---------------------------------------------------------------------------
_DESIGNATION_PATTERNS = [
    r"\b(Software Engineer|Senior Software Engineer|Junior Software Engineer)\b",
    r"\b(Software Developer|Senior Developer|Junior Developer|Lead Developer)\b",
    r"\b(Data Scientist|Data Analyst|Business Analyst|Research Analyst)\b",
    r"\b(Machine Learning Engineer|ML Engineer|AI Engineer|Deep Learning Engineer)\b",
    r"\b(Full[- ]?Stack Developer|Frontend Developer|Backend Developer)\b",
    r"\b(DevOps Engineer|Cloud Engineer|Platform Engineer|Site Reliability Engineer)\b",
    r"\b(Product Manager|Project Manager|Program Manager|Engineering Manager)\b",
    r"\b(Technical Lead|Tech Lead|Team Lead|Engineering Lead)\b",
    r"\b(CTO|CEO|COO|VP of Engineering|Director of Engineering)\b",
    r"\b(Consultant|Architect|Researcher|Scientist|Analyst)\b",
    r"\b(Intern|Trainee|Associate|Junior|Senior|Principal|Staff\s+Engineer)\b",
]

_COMPANY_KEYWORDS = [
    "pvt", "ltd", "limited", "inc", "corp", "llc", "technologies",
    "solutions", "systems", "services", "software", "labs",
    "consulting", "group", "global", "enterprises", "infotech",
]

_EDUCATION_KEYWORDS = ["university", "college", "school", "institute", "academy"]


def extract_experience(text: str) -> dict:
    """Extract designations, company names, and total years of experience."""
    designations = []
    for pattern in _DESIGNATION_PATTERNS:
        designations.extend(re.findall(pattern, text, re.IGNORECASE))

    # Try spaCy first for org detection
    companies = []
    nlp = _load_spacy()
    if nlp:
        doc = nlp(text[:3000])
        for ent in doc.ents:
            if ent.label_ == "ORG":
                el = ent.text.lower()
                if (
                    any(kw in el for kw in _COMPANY_KEYWORDS)
                    and not any(edu in el for edu in _EDUCATION_KEYWORDS)
                ):
                    companies.append(ent.text.strip())

    # Regex fallback: lines containing company keywords
    if not companies:
        for line in text.split("\n"):
            ll = line.lower().strip()
            if (
                any(kw in ll for kw in _COMPANY_KEYWORDS)
                and not any(edu in ll for edu in _EDUCATION_KEYWORDS)
                and 3 < len(line.strip()) < 80
            ):
                candidate = line.strip()
                if candidate not in companies:
                    companies.append(candidate)
                if len(companies) >= 5:
                    break

    return {
        "companies":    list(dict.fromkeys(companies))[:5],
        "designations": list(dict.fromkeys(d.strip() for d in designations))[:5],
        "total_years":  _calculate_total_experience(text),
    }


def _calculate_total_experience(text: str) -> Optional[float]:
    """Calculate total years from date range patterns like 2019-2022 or 2020-Present."""
    pattern = r"(?:19|20)\d{2}\s*[-\u2013]\s*(?:(?:19|20)\d{2}|[Pp]resent|[Cc]urrent)"
    matches = re.findall(pattern, text)
    current_year = datetime.now().year
    years = []
    for match in matches:
        parts = re.findall(r"\d{4}", match)
        if parts:
            start = int(parts[0])
            end = int(parts[1]) if len(parts) > 1 else current_year
            if 1990 <= start <= current_year:
                years.append(max(0, end - start))
    return float(sum(years)) if years else None


# ---------------------------------------------------------------------------
# Certifications
# ---------------------------------------------------------------------------
_CERT_PATTERNS = [
    r"\b(AWS\s+Certified[^,\n]{3,50})",
    r"\b(Google\s+Cloud\s+Certified[^,\n]{3,50})",
    r"\b(Microsoft\s+Certified[^,\n]{3,50})",
    r"\b(Oracle\s+Certified[^,\n]{3,50})",
    r"\b(Certified\s+[A-Z][a-zA-Z\s]{3,40}(?:Professional|Developer|Engineer|Architect|Associate|Expert|Practitioner))\b",
    r"\b(PMP|CISSP|CEH|CISA|CPA|CFA|PMI|Six\s+Sigma|Scrum\s+Master)\b",
    r"\b(?:Coursera|Udemy|edX|LinkedIn\s+Learning)[^\n]{3,60}Certificate",
]


def extract_certifications(text: str) -> list:
    """Extract certifications from resume text using pattern matching."""
    certs = []
    for pattern in _CERT_PATTERNS:
        for m in re.findall(pattern, text, re.IGNORECASE):
            cert = (m[0] if isinstance(m, tuple) else m).strip()
            if len(cert) > 3:
                certs.append(cert)
    return list(dict.fromkeys(certs))[:10]
