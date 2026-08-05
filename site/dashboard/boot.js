/*
 * Runs before first paint. Extracted from an inline <script> so the dashboard
 * can serve `script-src 'self'` with no 'unsafe-inline'.
 */

// Queue analytics calls made before the Vercel insights script loads.
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

// Apply the saved theme now, so the page does not paint in the wrong one first.
(() => {
  try {
    const saved = localStorage.getItem("expenseTrackerTheme");
    document.documentElement.dataset.theme = saved === "dark" || saved === "light"
      ? saved
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();

// Promote preloaded stylesheets once fetched, keeping font CSS off the critical
// path. Replaces an inline onload attribute, which the CSP also blocks.
(() => {
  const promote = (link) => { link.rel = "stylesheet"; };
  const pending = () => document.querySelectorAll('link[data-promote-style][rel="preload"]');
  for (const link of pending()) {
    link.addEventListener("load", () => promote(link), { once: true });
  }
  // Safety net in case a preload resolved before its listener was attached.
  document.addEventListener("DOMContentLoaded", () => {
    for (const link of pending()) promote(link);
  }, { once: true });
})();
