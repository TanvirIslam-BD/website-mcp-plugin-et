/*
 * Runs before paint on the login page. Extracted from inline <script> so the page
 * can serve a strict script-src.
 */

// Queue analytics calls made before the Vercel insights script loads.
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

// Promote preloaded stylesheets once fetched, keeping font CSS off the critical
// path. Replaces an inline onload attribute, which a strict CSP also blocks.
(() => {
  const pending = () => document.querySelectorAll('link[data-promote-style][rel="preload"]');
  const promote = (link) => { link.rel = "stylesheet"; };
  for (const link of pending()) {
    link.addEventListener("load", () => promote(link), { once: true });
  }
  document.addEventListener("DOMContentLoaded", () => {
    for (const link of pending()) promote(link);
  }, { once: true });
})();
