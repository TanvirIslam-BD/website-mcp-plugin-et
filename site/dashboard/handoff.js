/*
 * OAuth popup handoff.
 *
 * The popup used to be redirected to /dashboard, so it downloaded the whole
 * application and ran a full boot only to point its opener at the same URL —
 * which then downloaded everything again. This page is the end of the popup flow
 * instead: tell the opener, close, done.
 *
 * When the page is reached outside a popup (someone opened the link directly, or
 * the opener is gone) it falls back to navigating here.
 */
(() => {
  const params = new URLSearchParams(location.search);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get("month") || "")
    ? params.get("month")
    : new Date().toISOString().slice(0, 7);
  const target = `/dashboard?month=${encodeURIComponent(month)}`;

  const message = document.querySelector("[data-handoff-message]");
  const manual = document.querySelector("[data-handoff-continue]");

  const showManualLink = (text) => {
    if (message) message.textContent = text;
    if (manual) {
      manual.href = target;
      manual.hidden = false;
    }
  };

  const opener = (() => {
    try {
      return window.opener && !window.opener.closed ? window.opener : null;
    } catch {
      return null;
    }
  })();

  if (!opener) {
    // Not a popup: continue in this tab.
    location.replace(target);
    return;
  }

  try {
    // Same-origin target: the opener only accepts messages from its own origin.
    opener.postMessage({ source: "money-copilot", type: "auth-complete", month }, location.origin);
  } catch {
    showManualLink("Almost there — open your dashboard to continue.");
    return;
  }

  // The opener navigates itself on receipt. Closing immediately can race that, so
  // give it a moment, and leave a way forward if the close is blocked.
  setTimeout(() => {
    window.close();
    setTimeout(() => showManualLink("You can close this window."), 400);
  }, 120);
})();
