/*
 * Owner console sign-in.
 *
 * Rewritten from a minified one-liner. Beyond readability it now reports what the
 * server actually said: a throttle carries a wait time, a misconfiguration is
 * distinguished from a wrong password, and both are surfaced instead of collapsing
 * into a bare "Sign-in failed."
 */
const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const submit = document.querySelector("#submit");
const message = document.querySelector("#form-message");
const capsHint = document.querySelector("#caps-hint");
const reveal = document.querySelector("#reveal");

const SUBMIT_IDLE = submit.textContent;
const WARNING_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';

function showMessage(text, tone = "error") {
  message.innerHTML = `${WARNING_ICON}<span></span>`;
  message.querySelector("span").textContent = text;
  message.dataset.tone = tone;
  message.hidden = false;
}

function clearMessage() {
  message.hidden = true;
  message.textContent = "";
}

function setBusy(busy) {
  submit.disabled = busy;
  emailInput.disabled = busy;
  passwordInput.disabled = busy;
  submit.innerHTML = busy
    ? '<span class="spinner" aria-hidden="true"></span>Signing in…'
    : SUBMIT_IDLE;
}

/** Turns a response into something worth reading. */
function describeFailure(status, body, retryAfter) {
  if (status === 429) {
    const seconds = Number(retryAfter);
    const wait = Number.isFinite(seconds) && seconds > 0
      ? `Try again in about ${seconds >= 120 ? `${Math.ceil(seconds / 60)} minutes` : `${Math.max(1, Math.round(seconds))} seconds`}.`
      : "Try again shortly.";
    return { text: `Too many sign-in attempts. ${wait}`, tone: "warn" };
  }
  if (status === 503) {
    return { text: body.error || "Owner sign-in is temporarily unavailable.", tone: "warn" };
  }
  if (status === 403) {
    return { text: "This request was blocked. Reload the page and try again.", tone: "warn" };
  }
  if (status === 401) {
    return { text: body.error || "Invalid owner credentials.", tone: "error" };
  }
  return { text: body.error || "Sign-in failed. Please try again.", tone: "error" };
}

// Caps Lock is a common cause of a "wrong" password that looks right.
for (const eventName of ["keydown", "keyup"]) {
  passwordInput.addEventListener(eventName, (event) => {
    if (typeof event.getModifierState !== "function") return;
    capsHint.hidden = !event.getModifierState("CapsLock");
  });
}
passwordInput.addEventListener("blur", () => { capsHint.hidden = true; });

reveal.addEventListener("click", () => {
  const shown = reveal.getAttribute("aria-pressed") === "true";
  reveal.setAttribute("aria-pressed", String(!shown));
  const label = shown ? "Show password" : "Hide password";
  reveal.setAttribute("aria-label", label);
  reveal.title = label;
  passwordInput.type = shown ? "password" : "text";
  passwordInput.focus({ preventScroll: true });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  // novalidate is set so these read as our own messages, not the browser's.
  if (!emailInput.value.trim()) return showMessage("Enter the owner email address.");
  if (passwordInput.value.length < 8) return showMessage("The password is at least 8 characters.");

  setBusy(true);
  try {
    const response = await fetch("/api/owner-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: emailInput.value.trim(), password: passwordInput.value }),
    });

    if (response.ok) {
      submit.innerHTML = '<span class="spinner" aria-hidden="true"></span>Opening console…';
      location.replace("/owner/monitor");
      return;
    }

    const body = await response.json().catch(() => ({}));
    const { text, tone } = describeFailure(response.status, body, response.headers.get("Retry-After"));
    showMessage(text, tone);
    setBusy(false);
    passwordInput.value = "";
    passwordInput.focus({ preventScroll: true });
  } catch {
    showMessage("Could not reach the server. Check your connection and try again.", "warn");
    setBusy(false);
  }
});

// An existing session skips the form entirely.
(async () => {
  try {
    const response = await fetch("/api/owner-auth", { cache: "no-store", credentials: "same-origin" });
    if (response.ok) location.replace("/owner/monitor");
  } catch {
    // Offline or unconfigured: leave the form in place.
  }
})();
