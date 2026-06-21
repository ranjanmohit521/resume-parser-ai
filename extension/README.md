# ResumeAI Chrome Extension

> Parse LinkedIn, Naukri, and Indeed profiles instantly with one click.
> Powered by the local ResumeAI FastAPI backend.

---

## 📸 What It Does

| Step | Action |
|---|---|
| 1 | Visit any **LinkedIn**, **Naukri**, or **Indeed** profile page |
| 2 | Click the **ResumeAI** extension icon in your Chrome toolbar |
| 3 | Click **"Parse This Page"** |
| 4 | Instantly see extracted **name, email, phone, skills, experience, education, links, certifications** |
| 5 | **Copy JSON** or open the full **Dashboard** |

---

## 🚀 How to Load the Extension in Chrome

### Step 1 — Start the Backend Server
```powershell
cd resume_parser\backend
py main.py
```
Keep this running. The extension calls `http://localhost:8000`.

### Step 2 — Open Chrome Extensions
1. Open Chrome and go to: `chrome://extensions/`
2. Enable **Developer Mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the **`extension/`** folder:
   ```
   c:\Users\ranja\Downloads\Project\resume_parser\extension\
   ```
5. The **ResumeAI ⚡** icon appears in your Chrome toolbar!

---

## 🌐 Supported Sites

| Site | URL Pattern | What's Extracted |
|---|---|---|
| LinkedIn | `linkedin.com/in/*` | Name, headline, skills, experience, education |
| Naukri | `naukri.com/*` | Full profile text → NLP parsed |
| Indeed | `indeed.com/resume/*` | Full profile text → NLP parsed |
| Any Page | Any `http/https` URL | Generic text extraction |

---

## 📁 Extension Structure

```
extension/
├── manifest.json              ← Manifest V3 config
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup/
│   ├── popup.html             ← Extension popup UI
│   ├── popup.css              ← Dark glassmorphism theme
│   └── popup.js               ← Scrape + render logic
├── content/
│   └── content.js             ← DOM scraper (LinkedIn/Naukri/Indeed)
└── background/
    └── service_worker.js      ← Message router + API calls
```

---

## ⚙️ How It Works (Technical)

```
[LinkedIn Profile Page]
       ↓ content.js scrapes DOM text
[Popup click → chrome.scripting.executeScript]
       ↓ sends text to backend
[POST http://localhost:8000/parse-text]
       ↓ returns structured JSON
[popup.js renders results]
       → Name, Skills, Experience, Links, Certs
```

---

## 🔧 Tips

- **LinkedIn loads lazily** → Scroll down to load skills/experience sections *before* clicking Parse
- **Backend must be running** → The green "Online" dot in the popup confirms it's connected
- **Results are cached** → Reopening the popup shows the last parse result for that tab
- **Copy JSON** → Copies the full structured data to clipboard for use in your own code

---

## 🛠 API Endpoint Used

```
POST http://localhost:8000/parse-text
Content-Type: application/json

{
  "text": "scraped page text...",
  "source": "linkedin"
}
```

Response: Same JSON as the file upload endpoint (`/parse`).
