/**
 * popup.js — ResumeAI Chrome Extension Popup Logic
 * Handles: health check, tab detection, scraping, API calls, result rendering.
 */

const API_BASE = "http://localhost:8000";
const DASHBOARD_URL = "http://localhost:8000/app/index.html";

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const serverStatus = $("server-status");
const statusLabel  = $("status-label");
const siteBanner   = $("site-banner");
const siteIcon     = $("site-icon");
const siteName     = $("site-name");
const idleState    = $("idle-state");
const resultsState = $("results-state");
const loadingOvl   = $("loading-overlay");
const loadingText  = $("loading-text");
const errorBanner  = $("error-banner");
const errorText    = $("error-text");
const parseBtn     = $("parse-btn");
const copyBtn      = $("copy-btn");
const dashBtn      = $("dashboard-btn");
const resetBtn     = $("reset-btn");
const summaryRow   = $("summary-row");
const skillsChips  = $("skills-chips");
const skillsCount  = $("skills-count");
const eduList      = $("edu-list");
const expList      = $("exp-list");
const expYears     = $("exp-years");
const linksList    = $("links-list");
const certList     = $("cert-list");

let _parsedData = null;
let _activeTab  = null;

// ─── Site Config ──────────────────────────────────────────────────────────────
const SITE_CONFIG = {
  linkedin:  { icon: "💼", name: "LinkedIn",  color: "#0a66c2" },
  naukri:    { icon: "🔵", name: "Naukri",    color: "#4a90e2" },
  indeed:    { icon: "🟦", name: "Indeed",    color: "#2164f3" },
  glassdoor: { icon: "🟩", name: "Glassdoor", color: "#0caa41" },
  generic:   { icon: "🌐", name: "This Page", color: "#7c3aed" },
};

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  _activeTab = tab;

  // Update site banner
  const site = detectSiteFromUrl(tab.url || "");
  if (site !== "unknown") {
    const cfg = SITE_CONFIG[site] || SITE_CONFIG.generic;
    siteIcon.textContent = cfg.icon;
    siteName.textContent = cfg.name;
    siteBanner.classList.remove("hidden");
    parseBtn.disabled = false;
  }

  // Check backend health
  await checkHealth();

  // Check storage for cached results
  const stored = await chrome.storage.local.get(["lastResult", "lastTabId"]);
  if (stored.lastResult && stored.lastTabId === tab.id) {
    renderResults(stored.lastResult);
  }
})();

// ─── Site Detection ───────────────────────────────────────────────────────────
function detectSiteFromUrl(url) {
  if (url.includes("linkedin.com"))  return "linkedin";
  if (url.includes("naukri.com"))    return "naukri";
  if (url.includes("indeed.com"))    return "indeed";
  if (url.includes("glassdoor.com")) return "glassdoor";
  // Allow parsing any page
  if (url.startsWith("http"))        return "generic";
  return "unknown";
}

// ─── Health Check ─────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      setStatus("online", data.gemini_enabled ? "AI Ready" : "Online");
    } else {
      setStatus("offline", "Server Error");
    }
  } catch {
    setStatus("offline", "Server Offline");
    showError("Backend not running. Start the server: cd backend && py main.py");
    parseBtn.disabled = true;
  }
}

function setStatus(state, label) {
  serverStatus.className = `status-pill status-${state}`;
  statusLabel.textContent = label;
}

// ─── Parse Button ─────────────────────────────────────────────────────────────
parseBtn.addEventListener("click", async () => {
  hideError();
  showLoading("Scraping page…");

  try {
    // Step 1: Inject & run content script to scrape the page
    let scraped;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: _activeTab.id },
        files:  ["content/content.js"],
      });
      scraped = results?.[0]?.result;
    } catch {
      // Content script already injected — send message
      scraped = await new Promise(resolve => {
        chrome.tabs.sendMessage(_activeTab.id, { type: "SCRAPE" }, resp => {
          resolve(resp || null);
        });
      });
    }

    if (!scraped || !scraped.text || scraped.text.trim().length < 30) {
      throw new Error("Could not extract text from this page. Try scrolling down first to load all content.");
    }

    setLoadingText("Parsing with AI…");

    // Step 2: Send to backend
    const res = await fetch(`${API_BASE}/parse-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: scraped.text, source: scraped.source }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    _parsedData = { ...data, _source: scraped.source, _meta: scraped.meta };

    // Cache result for this tab
    await chrome.storage.local.set({ lastResult: _parsedData, lastTabId: _activeTab.id });

    hideLoading();
    renderResults(_parsedData);

  } catch (err) {
    hideLoading();
    showError(err.message);
  }
});

// ─── Render Results ───────────────────────────────────────────────────────────
function renderResults(data) {
  _parsedData = data;
  idleState.classList.add("hidden");
  resultsState.classList.remove("hidden");
  copyBtn.classList.remove("hidden");
  resetBtn.classList.remove("hidden");

  // Summary cards
  summaryRow.innerHTML = "";
  const summaryItems = [
    { icon: "👤", label: "Name",  value: data.name },
    { icon: "📧", label: "Email", value: data.email },
    { icon: "📱", label: "Phone", value: data.phone },
    { icon: "⏱️",  label: "Exp",   value: data.experience?.total_years != null ? `${data.experience.total_years} yrs` : null },
  ];
  summaryItems.forEach(({ icon, label, value }) => {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div class="sc-icon">${icon}</div>
      <div class="sc-label">${label}</div>
      <div class="sc-value ${!value ? "na" : ""}">${esc(value) || "—"}</div>
    `;
    summaryRow.appendChild(card);
  });

  // Skills
  skillsChips.innerHTML = "";
  const skills = data.skills || [];
  skillsCount.textContent = skills.length;
  if (skills.length > 0) {
    // Show top 20 skills to avoid overflow
    skills.slice(0, 20).forEach(s => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = s;
      skillsChips.appendChild(chip);
    });
    if (skills.length > 20) {
      const more = document.createElement("span");
      more.className = "chip";
      more.style.opacity = "0.5";
      more.textContent = `+${skills.length - 20} more`;
      skillsChips.appendChild(more);
    }
  } else {
    skillsChips.innerHTML = `<span style="color:var(--text-3);font-size:12px;">None detected</span>`;
  }

  // Education
  const edu = data.education || {};
  const eduItems = [...(edu.degrees || []), ...(edu.colleges || [])];
  if (eduItems.length > 0) {
    $("edu-section").classList.remove("hidden");
    eduList.innerHTML = eduItems.map(item =>
      `<div class="list-item"><span class="list-dot">▸</span>${esc(item)}</div>`
    ).join("");
  } else {
    $("edu-section").classList.add("hidden");
  }

  // Experience
  const exp = data.experience || {};
  const expItems = [
    ...(exp.designations || []).map(d => `👔 ${d}`),
    ...(exp.companies || []).map(c => `🏢 ${c}`),
  ];
  if (exp.total_years != null) {
    expYears.textContent = `${exp.total_years} yrs`;
    expYears.classList.remove("hidden");
  } else {
    expYears.classList.add("hidden");
  }
  if (expItems.length > 0) {
    $("exp-section").classList.remove("hidden");
    expList.innerHTML = expItems.map(item =>
      `<div class="list-item"><span class="list-dot">▸</span>${esc(item)}</div>`
    ).join("");
  } else {
    $("exp-section").classList.add("hidden");
  }

  // Links
  const links = data.links || {};
  const linkHtml = [];
  if (links.linkedin) linkHtml.push(buildLink("💼", "LinkedIn", links.linkedin));
  if (links.github)   linkHtml.push(buildLink("🐙", "GitHub",   links.github));
  if (links.portfolio) linkHtml.push(buildLink("🌐", "Portfolio", links.portfolio));
  if (linkHtml.length > 0) {
    $("links-section").classList.remove("hidden");
    linksList.innerHTML = linkHtml.join("");
    // Attach click handlers
    linksList.querySelectorAll(".link-item").forEach(el => {
      el.addEventListener("click", () => chrome.tabs.create({ url: el.dataset.url }));
    });
  } else {
    $("links-section").classList.add("hidden");
  }

  // Certifications
  const certs = data.certifications || [];
  if (certs.length > 0) {
    $("cert-section").classList.remove("hidden");
    certList.innerHTML = certs.map(c =>
      `<div class="cert-item"><span>🎖️</span>${esc(c)}</div>`
    ).join("");
  } else {
    $("cert-section").classList.add("hidden");
  }
}

function buildLink(icon, label, url) {
  return `<div class="link-item" data-url="${esc(url)}">
    <span class="link-icon">${icon}</span>
    <span class="link-text">${label}</span>
    <span style="color:var(--text-3);font-size:11px;">↗</span>
  </div>`;
}

// ─── Copy JSON ────────────────────────────────────────────────────────────────
copyBtn.addEventListener("click", async () => {
  if (!_parsedData) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(_parsedData, null, 2));
    copyBtn.textContent = "✓ Copied!";
    setTimeout(() => { copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy JSON`; }, 2000);
  } catch { showError("Clipboard access denied."); }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
dashBtn.addEventListener("click", () => chrome.tabs.create({ url: DASHBOARD_URL }));

// ─── Reset ────────────────────────────────────────────────────────────────────
resetBtn.addEventListener("click", () => {
  _parsedData = null;
  chrome.storage.local.remove(["lastResult", "lastTabId"]);
  resultsState.classList.add("hidden");
  idleState.classList.remove("hidden");
  copyBtn.classList.add("hidden");
  resetBtn.classList.add("hidden");
  hideError();
});

// ─── Loading Helpers ──────────────────────────────────────────────────────────
function showLoading(text) {
  loadingText.textContent = text;
  loadingOvl.classList.remove("hidden");
}
function setLoadingText(t) { loadingText.textContent = t; }
function hideLoading()      { loadingOvl.classList.add("hidden"); }

// ─── Error Helpers ────────────────────────────────────────────────────────────
function showError(msg) {
  errorText.textContent = msg;
  errorBanner.classList.remove("hidden");
}
function hideError() { errorBanner.classList.add("hidden"); }

// ─── Utils ────────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
