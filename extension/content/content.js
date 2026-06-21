/**
 * content.js — Content Script
 * Runs on LinkedIn, Naukri, Indeed pages.
 * Scrapes profile/resume text and sends it to the popup on request.
 */

// ─── Site Detector ────────────────────────────────────────────────────────────
function detectSite() {
  const host = location.hostname;
  if (host.includes("linkedin.com"))  return "linkedin";
  if (host.includes("naukri.com"))    return "naukri";
  if (host.includes("indeed.com"))    return "indeed";
  if (host.includes("glassdoor.com")) return "glassdoor";
  return "generic";
}

// ─── LinkedIn Scraper ─────────────────────────────────────────────────────────
function scrapeLinkedIn() {
  const get = (sel, all = false) => {
    if (all) return [...document.querySelectorAll(sel)].map(el => el.innerText?.trim()).filter(Boolean);
    return document.querySelector(sel)?.innerText?.trim() || "";
  };

  const name     = get("h1.text-heading-xlarge, h1[class*='heading']") ||
                   get(".pv-top-card--list li:first-child") ||
                   get("h1");
  const headline = get(".text-body-medium.break-words, [data-field='headline']") ||
                   get(".pv-top-card-section__headline");
  const location = get(".text-body-small.inline.t-black--light.break-words") ||
                   get(".pv-top-card-section__location");
  const about    = get("#about ~ div .full-width, section[data-section='summary'] .pv-about__summary-text") ||
                   get(".pv-about-section .pv-about__summary-text");

  // Experience section
  const expItems = get("#experience ~ div li, section[data-section='experience'] li", true);
  // Education section
  const eduItems = get("#education ~ div li, section[data-section='education'] li", true);
  // Skills section
  const skillItems = get("#skills ~ div li, .pv-skill-category-entity__name", true);
  // Certifications
  const certItems = get("#certifications ~ div li, #licenses_and_certifications ~ div li", true);

  // Compose full text block
  const lines = [
    name,
    headline,
    location,
    "",
    "SUMMARY",
    about,
    "",
    "EXPERIENCE",
    ...expItems,
    "",
    "EDUCATION",
    ...eduItems,
    "",
    "SKILLS",
    ...skillItems,
    "",
    "CERTIFICATIONS",
    ...certItems,
  ];

  return {
    text:   lines.filter(Boolean).join("\n"),
    source: "linkedin",
    meta:   { name, headline, location },
  };
}

// ─── Naukri Scraper ───────────────────────────────────────────────────────────
function scrapeNaukri() {
  // Naukri profile / resume view
  const sections = [...document.querySelectorAll(
    ".widg-ctr, .minHeight, .resumeView, .profileView, section, article, .profile-highlights"
  )].map(el => el.innerText?.trim()).filter(Boolean);

  return {
    text:   sections.join("\n\n") || document.body.innerText,
    source: "naukri",
    meta:   {},
  };
}

// ─── Indeed Scraper ───────────────────────────────────────────────────────────
function scrapeIndeed() {
  const main = document.querySelector("#resume-section, .ia-ResumeLayout, main, article");
  return {
    text:   main?.innerText?.trim() || document.body.innerText,
    source: "indeed",
    meta:   {},
  };
}

// ─── Generic Page Scraper ─────────────────────────────────────────────────────
function scrapeGeneric() {
  // Try to get main content area, exclude nav/footer/scripts
  const main = document.querySelector("main, article, [role='main'], #content, .content");
  const text = main?.innerText?.trim() || document.body.innerText;
  // Limit to 8000 chars
  return {
    text:   text.slice(0, 8000),
    source: "generic",
    meta:   {},
  };
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────
function scrape() {
  const site = detectSite();
  switch (site) {
    case "linkedin":  return scrapeLinkedIn();
    case "naukri":    return scrapeNaukri();
    case "indeed":    return scrapeIndeed();
    default:          return scrapeGeneric();
  }
}

// ─── Message Listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCRAPE") {
    try {
      sendResponse(scrape());
    } catch (e) {
      sendResponse({ text: document.body.innerText.slice(0, 8000), source: "generic", meta: {} });
    }
    return true;
  }
});

// Auto-run and store result for immediate access
const _scraped = scrape();
// Make it accessible via executeScript return value
_scraped;
