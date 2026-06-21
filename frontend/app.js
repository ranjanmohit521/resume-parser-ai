/**
 * app.js — ResumeAI Frontend Logic
 * Handles file upload, API call, result rendering, and UX interactions.
 */

const API_BASE = "http://localhost:8000";

// ─── DOM Refs ───────────────────────────────────────────────────────────────
const dropZone      = document.getElementById("drop-zone");
const fileInput     = document.getElementById("file-input");
const browseTrigger = document.getElementById("browse-trigger");
const fileInfo      = document.getElementById("file-info");
const fileName      = document.getElementById("file-name");
const fileSizeEl    = document.getElementById("file-size");
const removeFileBtn = document.getElementById("remove-file");
const parseBtn      = document.getElementById("parse-btn");
const parseBtnText  = parseBtn.querySelector(".parse-btn-text");
const parseBtnLoader= parseBtn.querySelector(".parse-btn-loader");
const uploadSection = document.getElementById("upload-section");
const resultsSection= document.getElementById("results-section");
const summaryCards  = document.getElementById("summary-cards");
const detailsGrid   = document.getElementById("details-grid");
const jsonOutput    = document.getElementById("json-output");
const jsonViewer    = document.getElementById("json-viewer");
const jsonToggle    = document.getElementById("json-toggle");
const toggleArrow   = document.getElementById("toggle-arrow");
const copyBtn       = document.getElementById("copy-btn");
const downloadBtn   = document.getElementById("download-btn");
const parseAgainBtn = document.getElementById("parse-again-btn");
const errorToast    = document.getElementById("error-toast");
const errorMessage  = document.getElementById("error-message");
const closeToast    = document.getElementById("close-toast");
const geminiTag     = document.getElementById("gemini-tag");
const geminiBadge   = document.getElementById("gemini-badge");

let selectedFile = null;
let parsedData   = null;

// ─── Health Check (check Gemini availability on load) ───────────────────────
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      if (data.gemini_enabled) {
        geminiBadge.classList.remove("hidden");
      }
    }
  } catch (_) {
    // Server not running yet, ignore
  }
}

// ─── Drag & Drop ─────────────────────────────────────────────────────────────
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

["dragleave", "dragend"].forEach((evt) => {
  dropZone.addEventListener(evt, () => dropZone.classList.remove("drag-over"));
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) handleFile(files[0]);
});

dropZone.addEventListener("click", (e) => {
  if (e.target !== browseTrigger) fileInput.click();
});

dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});

browseTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files && fileInput.files.length > 0) {
    handleFile(fileInput.files[0]);
  }
});

removeFileBtn.addEventListener("click", resetFile);

// ─── File Handling ────────────────────────────────────────────────────────────
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/bmp",
  "image/tiff",
];

const ALLOWED_EXTS = [".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".bmp", ".tiff"];

function handleFile(file) {
  const ext = "." + file.name.split(".").pop().toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    showError(`Unsupported file type: "${ext}". Please upload PDF, DOCX, TXT, or image files.`);
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError("File is too large. Maximum allowed size is 10 MB.");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  fileInfo.classList.remove("hidden");
  parseBtn.disabled = false;

  // Update drop zone appearance
  dropZone.style.borderColor = "var(--accent-1)";
  dropZone.style.borderStyle = "solid";
}

function resetFile() {
  selectedFile = null;
  fileInput.value = "";
  fileName.textContent = "";
  fileSizeEl.textContent = "";
  fileInfo.classList.add("hidden");
  parseBtn.disabled = true;
  dropZone.style.borderColor = "";
  dropZone.style.borderStyle = "";
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ─── Parse Button ─────────────────────────────────────────────────────────────
parseBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  // Show loading state
  parseBtnText.classList.add("hidden");
  parseBtnLoader.classList.remove("hidden");
  parseBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append("file", selectedFile);

    const res = await fetch(`${API_BASE}/parse`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Parsing failed. Please try again.");
    }

    parsedData = data;
    renderResults(data);

  } catch (err) {
    showError(err.message || "Could not connect to the backend. Make sure the server is running on port 8000.");
  } finally {
    parseBtnText.classList.remove("hidden");
    parseBtnLoader.classList.add("hidden");
    parseBtn.disabled = false;
  }
});

// ─── Render Results ───────────────────────────────────────────────────────────
function renderResults(data) {
  uploadSection.classList.add("hidden");
  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

  // Gemini badge
  if (data.gemini_enhanced) {
    geminiTag.classList.remove("hidden");
    geminiBadge.classList.remove("hidden");
  }

  // Render summary cards
  summaryCards.innerHTML = "";
  const summaryItems = [
    { icon: "👤", label: "Name",  value: data.name },
    { icon: "📧", label: "Email", value: data.email },
    { icon: "📱", label: "Phone", value: data.phone },
    { icon: "💼", label: "Experience", value: data.experience?.total_years != null ? `${data.experience.total_years} yrs` : null },
  ];

  summaryItems.forEach(({ icon, label, value }) => {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div class="summary-card-icon">${icon}</div>
      <div class="summary-card-label">${label}</div>
      <div class="summary-card-value ${!value ? "na" : ""}">${value || "Not found"}</div>
    `;
    summaryCards.appendChild(card);
  });

  // Render detail cards
  detailsGrid.innerHTML = "";

  // Skills
  const skills = data.skills || [];
  appendDetailCard({
    icon: "🛠️",
    title: "Skills",
    className: "full-width",
    html: skills.length > 0
      ? `<div class="skills-container">${skills.map(s => `<span class="skill-chip">${esc(s)}</span>`).join("")}</div>`
      : `<p style="color:var(--text-muted);font-size:14px;">No skills detected.</p>`,
  });

  // Education
  const edu = data.education || {};
  appendDetailCard({
    icon: "🎓",
    title: "Education",
    html: buildListHtml([
      ...(edu.degrees || []).map(d => `<strong>${esc(d)}</strong>`),
      ...(edu.colleges || []),
    ]) || `<p style="color:var(--text-muted);font-size:14px;">Not found.</p>`,
  });

  // Work Experience
  const exp = data.experience || {};
  const expItems = [
    ...(exp.designations || []).map(d => `👔 ${esc(d)}`),
    ...(exp.companies || []).map(c => `🏢 ${esc(c)}`),
  ];
  appendDetailCard({
    icon: "💼",
    title: "Work Experience",
    html: expItems.length > 0
      ? buildListHtml(expItems)
      : `<p style="color:var(--text-muted);font-size:14px;">Not found.</p>`,
  });

  // Links
  const links = data.links || {};
  const linkHtml = buildLinksHtml(links);
  appendDetailCard({
    icon: "🔗",
    title: "Links & Profiles",
    html: linkHtml || `<p style="color:var(--text-muted);font-size:14px;">No links found.</p>`,
  });

  // Certifications
  const certs = data.certifications || [];
  appendDetailCard({
    icon: "🏆",
    title: "Certifications",
    html: certs.length > 0
      ? certs.map(c => `<div class="cert-item"><span class="cert-icon">🎖️</span>${esc(c)}</div>`).join("")
      : `<p style="color:var(--text-muted);font-size:14px;">No certifications found.</p>`,
  });

  // JSON Viewer
  jsonOutput.textContent = JSON.stringify(data, null, 2);
}

function appendDetailCard({ icon, title, html, className = "" }) {
  const card = document.createElement("div");
  card.className = `detail-card ${className}`;
  card.innerHTML = `
    <div class="detail-card-header">
      <span class="detail-card-icon">${icon}</span>
      <span class="detail-card-title">${title}</span>
    </div>
    ${html}
  `;
  detailsGrid.appendChild(card);
}

function buildListHtml(items) {
  if (!items || items.length === 0) return "";
  return `<div class="detail-list">${items.map(i =>
    `<div class="detail-item"><span class="detail-item-dot">▸</span><span class="detail-item-text">${i}</span></div>`
  ).join("")}</div>`;
}

function buildLinksHtml(links) {
  const parts = [];
  if (links.linkedin) {
    parts.push(`<a class="link-item" href="${esc(links.linkedin)}" target="_blank" rel="noopener"><span class="link-icon">💼</span>LinkedIn</a>`);
  }
  if (links.github) {
    parts.push(`<a class="link-item" href="${esc(links.github)}" target="_blank" rel="noopener"><span class="link-icon">🐙</span>GitHub</a>`);
  }
  if (links.portfolio) {
    parts.push(`<a class="link-item" href="${esc(links.portfolio)}" target="_blank" rel="noopener"><span class="link-icon">🌐</span>Portfolio</a>`);
  }
  (links.other || []).slice(0, 3).forEach(url => {
    parts.push(`<a class="link-item" href="${esc(url)}" target="_blank" rel="noopener"><span class="link-icon">🔗</span>${esc(url)}</a>`);
  });
  return parts.join("");
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── JSON Toggle ──────────────────────────────────────────────────────────────
jsonToggle.addEventListener("click", () => {
  const isHidden = jsonViewer.classList.contains("hidden");
  jsonViewer.classList.toggle("hidden");
  toggleArrow.style.transform = isHidden ? "rotate(180deg)" : "";
  jsonToggle.querySelector("span:first-of-type + span") ;
});

// ─── Copy JSON ────────────────────────────────────────────────────────────────
copyBtn.addEventListener("click", async () => {
  if (!parsedData) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(parsedData, null, 2));
    copyBtn.textContent = "✓ Copied!";
    setTimeout(() => {
      copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy JSON
      `;
    }, 2000);
  } catch (_) {
    showError("Could not copy to clipboard.");
  }
});

// ─── Download JSON ────────────────────────────────────────────────────────────
downloadBtn.addEventListener("click", () => {
  if (!parsedData) return;
  const blob = new Blob([JSON.stringify(parsedData, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const safeName = (parsedData.name || "resume").replace(/\s+/g, "_").toLowerCase();
  a.href     = url;
  a.download = `${safeName}_parsed.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Parse Again ──────────────────────────────────────────────────────────────
parseAgainBtn.addEventListener("click", () => {
  resultsSection.classList.add("hidden");
  uploadSection.classList.remove("hidden");
  summaryCards.innerHTML = "";
  detailsGrid.innerHTML  = "";
  jsonOutput.textContent = "";
  jsonViewer.classList.add("hidden");
  toggleArrow.style.transform = "";
  geminiTag.classList.add("hidden");
  parsedData = null;
  resetFile();
  uploadSection.scrollIntoView({ behavior: "smooth" });
});

// ─── Error Toast ──────────────────────────────────────────────────────────────
let toastTimer = null;

function showError(msg) {
  errorMessage.textContent = msg;
  errorToast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => errorToast.classList.add("hidden"), 6000);
}

closeToast.addEventListener("click", () => {
  errorToast.classList.add("hidden");
  clearTimeout(toastTimer);
});

// ─── Init ─────────────────────────────────────────────────────────────────────
checkHealth();
