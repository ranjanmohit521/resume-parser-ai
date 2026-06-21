/**
 * service_worker.js — Background Service Worker
 * Routes messages between popup and content scripts.
 * Handles API calls to the ResumeAI FastAPI backend.
 */

const API_BASE = "http://localhost:8000";

// ─── Message Router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PARSE_TEXT") {
    handleParseText(message.text, message.source)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // keeps port open for async response
  }

  if (message.type === "GET_PAGE_TEXT") {
    getPageText(message.tabId)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "CHECK_HEALTH") {
    checkHealth().then(sendResponse).catch(() => sendResponse({ ok: false }));
    return true;
  }
});

// ─── Get Page Text via Content Script ────────────────────────────────────────
async function getPageText(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content.js"],
    });
    // executeScript returns [{result: ...}]
    return results?.[0]?.result || { text: "", source: "generic" };
  } catch (e) {
    // Content script already injected — send message instead
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "SCRAPE" }, (resp) => {
        resolve(resp || { text: "", source: "generic" });
      });
    });
  }
}

// ─── Parse Text via Backend ───────────────────────────────────────────────────
async function handleParseText(text, source) {
  const response = await fetch(`${API_BASE}/parse-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${response.status}`);
  }

  return response.json();
}

// ─── Health Check ─────────────────────────────────────────────────────────────
async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
  const data = await res.json();
  return { ok: res.ok, gemini: data.gemini_enabled };
}
