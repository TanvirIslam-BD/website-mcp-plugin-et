/*
 * Sign-in flow for the login page.
 *
 * Extracted from inline <script> and inline onclick attributes so the page can
 * serve a strict script-src, and reworked for a smoother handoff:
 *
 *  - the popup signals completion with postMessage, so the parent navigates the
 *    instant authorisation finishes rather than up to a second later when a
 *    polling tick notices the window closed;
 *  - a blocked popup falls back to same-tab navigation instead of appearing to do
 *    nothing;
 *  - cancelling says so, rather than silently resetting the button;
 *  - dashboard assets are prefetched on intent, so the post-auth load is warm.
 */
(() => {
  const AUTH_URL = "/api/dashboard-auth";
  const POPUP_NAME = "copilot_auth";
  const DASHBOARD_ASSETS = [
    "/dashboard/app.js",
    "/dashboard/styles.css",
    "/dashboard/report.css",
    "/dashboard/viz.css",
  ];

  let popup = null;
  let watcher = null;
  let completed = false;
  const busyButtons = new Set();

  /* ---------------------------------------------------------------- helpers */

  function currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  function authUrl({ popup: asPopup }) {
    const url = new URL(AUTH_URL, location.origin);
    url.searchParams.set("month", currentMonth());
    if (asPopup) url.searchParams.set("popup", "1");
    return url.toString();
  }

  function status(text, tone = "info") {
    const target = document.querySelector("[data-login-status]");
    if (!target) return;
    target.textContent = text || "";
    target.dataset.tone = tone;
    target.hidden = !text;
  }

  /** Remembers a button's original markup so it can be restored exactly. */
  function setBusy(button, label) {
    if (!button) return;
    if (!busyButtons.has(button)) {
      button.dataset.idleHtml = button.innerHTML;
      busyButtons.add(button);
    }
    button.setAttribute("aria-busy", "true");
    button.disabled = true;
    button.innerHTML = `<span class="login-spinner" aria-hidden="true"></span>${label}`;
  }

  function clearBusy() {
    for (const button of busyButtons) {
      button.removeAttribute("aria-busy");
      button.disabled = false;
      if (button.dataset.idleHtml !== undefined) button.innerHTML = button.dataset.idleHtml;
      delete button.dataset.idleHtml;
    }
    busyButtons.clear();
  }

  let prefetched = false;
  function prefetchDashboard() {
    if (prefetched) return;
    prefetched = true;
    for (const href of DASHBOARD_ASSETS) {
      const link = document.createElement("link");
      // `prefetch` rather than `preload`: these are for the *next* navigation, and
      // preload would warn about an unused resource on this page.
      link.rel = "prefetch";
      link.href = href;
      link.as = href.endsWith(".css") ? "style" : "script";
      document.head.appendChild(link);
    }
  }

  function goToDashboard(month) {
    completed = true;
    if (watcher) clearInterval(watcher);
    status("Signed in — opening your dashboard…", "success");
    const target = new URL("/dashboard", location.origin);
    target.searchParams.set("month", /^\d{4}-(0[1-9]|1[0-2])$/.test(month || "") ? month : currentMonth());
    location.replace(target.toString());
  }

  /* ------------------------------------------------------------ popup flow */

  // The popup posts here the moment the callback completes.
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== "money-copilot" || data.type !== "auth-complete") return;
    try { popup?.close(); } catch { /* already gone */ }
    goToDashboard(data.month);
  });

  function watchPopup() {
    if (watcher) clearInterval(watcher);
    watcher = setInterval(async () => {
      if (completed) return clearInterval(watcher);
      if (popup && !popup.closed) return;
      clearInterval(watcher);

      /*
       * The popup is gone without a message. That is usually a cancel, but a
       * browser can also close it before the message lands — so confirm against
       * the session endpoint before telling the user it failed.
       */
      try {
        const response = await fetch("/api/dashboard-session", { credentials: "same-origin", cache: "no-store" });
        if (response.ok) return goToDashboard(currentMonth());
      } catch { /* offline; fall through to the cancel message */ }

      clearBusy();
      status("Sign-in was not completed. You can try again whenever you're ready.", "warn");
    }, 400);
  }

  function startAuth(button, label) {
    if (completed) return;
    status("");
    setBusy(button, label);
    prefetchDashboard();

    popup = window.open(authUrl({ popup: true }), POPUP_NAME, "width=600,height=820,status=no,resizable=yes,scrollbars=yes");

    if (!popup) {
      // Blocked. Continuing in this tab is better than looking broken.
      status("Continuing to secure sign-in…", "info");
      location.href = authUrl({ popup: false });
      return;
    }

    try {
      // Centre it across whichever screen the window is on.
      const width = 600;
      const height = 820;
      const left = Math.round((window.screen.availWidth - width) / 2);
      const top = Math.round((window.screen.availHeight - height) / 2);
      popup.moveTo(Math.max(0, left), Math.max(0, top));
      popup.resizeTo(width, height);
    } catch { /* some browsers refuse; the popup still works */ }

    popup.focus?.();
    watchPopup();
  }

  /* ------------------------------------------------------------- listeners */

  // One delegated handler replaces four inline onclick attributes.
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-secure-login], [data-oauth-login]");
    if (!trigger) return;
    event.preventDefault();
    startAuth(trigger, trigger.dataset.busyLabel || "Opening secure sign-in…");
  });

  document.querySelector("[data-mobile-login-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    startAuth(document.querySelector("[data-mobile-submit-btn]"), "Signing in…");
  });

  // Warm the dashboard as soon as the user shows intent.
  for (const eventName of ["pointerenter", "focusin", "touchstart"]) {
    document.addEventListener(eventName, (event) => {
      if (event.target.closest?.("[data-secure-login], [data-oauth-login], [data-mobile-submit-btn]")) prefetchDashboard();
    }, { passive: true, once: false });
  }

  /* -------------------------------------------------- already-signed-in path */

  /*
   * Runs before paint work matters: an existing session should land on the
   * dashboard without the login form flashing first. The body stays in a
   * checking state until this resolves.
   */
  (async () => {
    document.body.dataset.authState = "checking";
    try {
      const response = await fetch("/api/dashboard-session", { credentials: "same-origin", cache: "no-store" });
      if (response.ok) {
        prefetchDashboard();
        location.replace(`/dashboard?month=${encodeURIComponent(currentMonth())}`);
        return;
      }
    } catch { /* offline or not configured: show the form */ }
    document.body.dataset.authState = "signed-out";
  })();
})();
