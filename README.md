# ResumeAI — AI-Powered Resume Parser

> A full-stack resume parsing application inspired by [pyresparser](https://github.com/OmkarPathak/pyresparser), built with **FastAPI**, **spaCy**, **NLTK**, and **Google Gemini AI**.

---

## ✨ Features

| Field | Extraction Method |
|---|---|
| 👤 Name | spaCy NER (PERSON entity) |
| 📧 Email | Regex |
| 📱 Phone Number | Regex (Indian & International) |
| 🛠️ Skills | Keyword match against 500+ skills DB |
| 🎓 Education | spaCy ORG NER + Pattern matching |
| 💼 Work Experience | spaCy ORG NER + Designation patterns |
| ⏱️ Total Years Experience | Date range calculation |
| 🔗 Links (LinkedIn, GitHub) | URL regex extraction |
| 🏆 Certifications | Pattern matching |
| 🤖 Gemini AI Enhancement | Smart gap-filling (optional) |

---

## 📁 Project Structure

```
resume_parser/
├── backend/
│   ├── main.py                ← FastAPI server
│   ├── requirements.txt       ← Python dependencies
│   └── parser/
│       ├── __init__.py
│       ├── extractor.py       ← Main pipeline orchestrator
│       ├── text_extractor.py  ← PDF/DOCX/TXT/Image → text
│       ├── nlp_utils.py       ← spaCy + NLTK extraction
│       ├── gemini_utils.py    ← Google Gemini AI integration
│       └── skills_db.csv      ← 500+ skills keyword database
├── frontend/
│   ├── index.html             ← Web dashboard
│   ├── style.css              ← Glassmorphism dark theme
│   └── app.js                 ← Upload + result rendering
└── README.md
```

---

## 🚀 Setup & Installation

### Step 1 — Prerequisites

Make sure you have **Python 3.8+** installed:
```bash
python --version
```

For image (OCR) support, install **Tesseract OCR**:
- Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
- After install, add to PATH: `C:\Program Files\Tesseract-OCR\`

---

### Step 2 — Install Python Dependencies

```bash
cd resume_parser/backend
pip install -r requirements.txt
```

---

### Step 3 — Download NLP Models

```bash
# spaCy English model
python -m spacy download en_core_web_sm

# NLTK data
python -c "import nltk; nltk.download('words'); nltk.download('stopwords'); nltk.download('punkt')"
```

---

### Step 4 — (Optional) Configure Gemini AI

If you have a Google Gemini API key, create a `.env` file in `backend/`:

```
GEMINI_API_KEY=your_api_key_here
```

Or set it as an environment variable:
```bash
# Windows PowerShell
$env:GEMINI_API_KEY="your_api_key_here"

# Linux/Mac
export GEMINI_API_KEY="your_api_key_here"
```

> Without a Gemini key, the parser works perfectly using spaCy + NLTK only.

---

### Step 5 — Start the Backend Server

```bash
cd resume_parser/backend
python main.py
```

Server starts at: **http://localhost:8000**

API Documentation: **http://localhost:8000/docs**

---

### Step 6 — Open the Web Dashboard

Simply open `frontend/index.html` in your browser:
```bash
# Windows
start resume_parser/frontend/index.html
```

Or serve it with Python:
```bash
cd resume_parser/frontend
python -m http.server 3000
# Open http://localhost:3000
```

---

## 🔌 API Usage

### Parse a Resume via API

```bash
curl -X POST "http://localhost:8000/parse" \
  -H "accept: application/json" \
  -F "file=@/path/to/resume.pdf"
```

### Example Response

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "9876543210",
  "skills": ["Python", "Machine Learning", "React", "FastAPI", "Docker"],
  "education": {
    "degrees": ["B.E. IN COMPUTER ENGINEERING"],
    "colleges": ["IIT Bombay"]
  },
  "experience": {
    "companies": ["Google LLC", "Microsoft Corp"],
    "designations": ["Software Engineer", "Senior Developer"],
    "total_years": 3.5
  },
  "links": {
    "linkedin": "https://linkedin.com/in/johndoe",
    "github": "https://github.com/johndoe",
    "portfolio": null,
    "other": []
  },
  "certifications": ["AWS Certified Developer", "Google Cloud Professional"],
  "gemini_enhanced": false,
  "raw_text_length": 4821
}
```

---

### Use as a Python Library

```python
from parser.extractor import parse_resume

with open("resume.pdf", "rb") as f:
    data = parse_resume(f.read(), "resume.pdf")

print(data["name"])
print(data["skills"])
```

---

## 📄 Supported File Formats

| Format | Library Used |
|---|---|
| PDF | pdfminer.six (+ PyPDF2 fallback) |
| DOCX | python-docx |
| TXT | Built-in |
| JPG / PNG / BMP | pytesseract + Pillow (OCR) |

---

## 🛠️ Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — REST API framework
- [spaCy](https://spacy.io/) — NLP & Named Entity Recognition
- [NLTK](https://www.nltk.org/) — Natural Language Toolkit
- [pdfminer.six](https://github.com/pdfminer/pdfminer.six) — PDF extraction
- [python-docx](https://python-docx.readthedocs.io/) — DOCX extraction
- [pytesseract](https://github.com/madmaze/pytesseract) — OCR for images
- [Google Generative AI](https://ai.google.dev/) — Gemini AI (optional)

**Frontend**
- Vanilla HTML + CSS + JavaScript
- Glassmorphism dark theme
- Drag-and-drop file upload
- Animated results with JSON export

---

## 📜 License

MIT License. Built with inspiration from [pyresparser](https://github.com/OmkarPathak/pyresparser) by Omkar Pathak.
