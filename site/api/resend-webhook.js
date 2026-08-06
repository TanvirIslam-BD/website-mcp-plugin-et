import crypto from "node:crypto";

/*
 * Resend webhook receiver.
 *
 * Register this endpoint's URL (https://www.copilotai.live/api/resend-webhook)
 * in the Resend dashboard (https://resend.com/webhooks) and subscribe it to the
 * email.* events you care about. Every delivered event is forwarded as a concise
 * summary email to WEBHOOK_FORWARD_TO (defaults to the owner's Gmail) so all
 * email activity lands in one inbox.
 *
 * Environment:
 *   RESEND_API_KEY         — required to forward the summary email.
 *   RESEND_WEBHOOK_SECRET  — the "whsec_..." signing secret from the Resend
 *                            webhook page. When set, requests must carry a valid
 *                            Svix signature or they are rejected.
 *   WEBHOOK_FORWARD_TO     — destination inbox (default tanvir1ariyan@gmail.com).
 *   EMAIL_FROM             — verified Resend sender (default below).
 */

// Raw body is required for signature verification, so the platform's JSON
// body parser must be turned off for this route.
export const config = { api: { bodyParser: false } };

const DEFAULT_EMAIL_FROM = "Money Copilot <reports@contact.copilotai.live>";
const DEFAULT_FORWARD_TO = "tanvir1ariyan@gmail.com";
// Every forwarded summary carries this subject prefix. Incoming events whose
// subject starts with it are our own forwards — skipping them is what stops the
// webhook from emailing itself in an endless loop.
const LOG_SUBJECT_PREFIX = "[Email Log]";
// Svix timestamp tolerance (seconds) — rejects replayed deliveries.
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    // A webhook body is tiny; cap it so a hostile caller cannot exhaust memory.
    const limit = 1_000_000;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Verifies a Svix (Resend) webhook signature. Returns true when the signature is
 * valid, false otherwise. Mirrors Svix's scheme: HMAC-SHA256 over
 * `${id}.${timestamp}.${body}` keyed by the base64-decoded secret.
 */
function verifySignature(secret, headers, rawBody) {
  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signatureHeader = headers["svix-signature"];
  if (!id || !timestamp || !signatureHeader) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuffer = Buffer.from(expected);

  // The header is a space-separated list of `version,signature` pairs.
  return signatureHeader.split(" ").some((entry) => {
    const candidate = entry.includes(",") ? entry.split(",")[1] : entry;
    const candidateBuffer = Buffer.from(candidate || "");
    return candidateBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

function asList(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/**
 * The email.* webhook payloads carry metadata but not the message body, so the
 * body is fetched separately by id. Inbound (email.received) bodies live at
 * /emails/receiving/:id; outbound ones at /emails/:id. Tries the endpoint that
 * matches the event first, then the other as a fallback. Returns { text, html }
 * or null.
 */
async function fetchEmailBody(apiKey, emailId, type) {
  const id = encodeURIComponent(emailId);
  const paths = String(type || "").startsWith("email.received")
    ? [`emails/receiving/${id}`, `emails/${id}`]
    : [`emails/${id}`, `emails/receiving/${id}`];
  for (const path of paths) {
    try {
      const response = await fetch(`https://api.resend.com/${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) continue;
      const json = await response.json();
      const text = typeof json.text === "string" ? json.text : "";
      const html = typeof json.html === "string" ? json.html : "";
      if (text || html) return { text, html };
    } catch {
      // Try the next candidate endpoint.
    }
  }
  return null;
}

// Minimal HTML→text fallback for messages that only ship an HTML part, so the
// forwarded summary is still readable without rendering untrusted sender markup.
function htmlToPlain(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function bodySectionHtml(body) {
  if (!body) return "";
  const text = body.text && body.text.trim() ? body.text : (body.html ? htmlToPlain(body.html) : "");
  if (!text.trim()) return "";
  return `<div style="margin-top:14px;">
      <div style="font-size:11px;font-weight:800;color:#334155;margin-bottom:6px;">✉️ Message body</div>
      <pre style="margin:0;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:12.5px;line-height:1.5;color:#0f172a;white-space:pre-wrap;word-break:break-word;">${escapeHtml(text.slice(0, 20000))}</pre>
    </div>`;
}

function summaryRows(type, data) {
  const rows = [
    ["Event", type],
    ["From", data.from],
    ["To", asList(data.to).join(", ")],
    ["Subject", data.subject],
    ["Email ID", data.email_id],
    ["Sent at", data.created_at],
  ];
  // Surface the reason on the events where it matters most.
  if (data.bounce?.message || data.bounce?.type) rows.push(["Bounce", `${data.bounce.type || ""} ${data.bounce.message || ""}`.trim()]);
  if (data.click?.link) rows.push(["Clicked link", data.click.link]);
  if (data.reason) rows.push(["Reason", data.reason]);
  return rows.filter(([, value]) => value !== undefined && value !== null && value !== "");
}

function buildForwardHtml(type, data, rawJson, body) {
  const rows = summaryRows(type, data).map(([label, value]) => `
    <tr>
      <td style="padding:6px 12px;font-size:12px;font-weight:700;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:6px 12px;font-size:12px;color:#0f172a;border:1px solid #e2e8f0;word-break:break-word;">${escapeHtml(value)}</td>
    </tr>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="padding:14px 16px;background:#030712;color:#fff;">
        <div style="font-size:15px;font-weight:800;">📨 Resend email event</div>
        <div style="font-size:11px;color:#34d399;font-weight:700;margin-top:2px;">${escapeHtml(type)}</div>
      </td></tr>
      <tr><td style="padding:14px 16px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rows}</table>
        ${bodySectionHtml(body)}
        <details style="margin-top:12px;">
          <summary style="font-size:11px;font-weight:700;color:#64748b;cursor:pointer;">Raw payload</summary>
          <pre style="margin:8px 0 0;padding:10px;background:#0f172a;color:#e2e8f0;border-radius:8px;font-size:11px;line-height:1.4;white-space:pre-wrap;word-break:break-word;">${escapeHtml(rawJson)}</pre>
        </details>
      </td></tr>
    </table>
  </body></html>`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(413).json({ error: "Payload too large." });
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    if (!verifySignature(secret, req.headers, rawBody)) {
      return res.status(401).json({ error: "Invalid signature." });
    }
  } else {
    // Unsigned mode still works so the endpoint can be tested before the secret
    // is configured, but it is an open trigger until RESEND_WEBHOOK_SECRET is set.
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — accepting unsigned request.");
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON." });
  }

  const type = typeof event?.type === "string" ? event.type : "unknown";
  const data = event?.data && typeof event.data === "object" ? event.data : {};
  const subject = typeof data.subject === "string" ? data.subject : "";

  // Loop guard: our own forwarded summaries generate email.sent/delivered
  // events. Ignore anything carrying our subject prefix so the webhook never
  // ends up forwarding its own forwards forever.
  if (subject.startsWith(LOG_SUBJECT_PREFIX)) {
    return res.status(200).json({ ok: true, skipped: "self-generated event" });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn("[resend-webhook] RESEND_API_KEY not set — cannot forward event", { type });
    return res.status(200).json({ ok: true, forwarded: false, reason: "no_api_key" });
  }

  const forwardTo = process.env.WEBHOOK_FORWARD_TO || DEFAULT_FORWARD_TO;
  const firstRecipient = asList(data.to)[0] || "unknown";
  const forwardSubject = `${LOG_SUBJECT_PREFIX} ${type} → ${firstRecipient}`.slice(0, 180);
  const rawJson = JSON.stringify(event, null, 2).slice(0, 20_000);

  // The webhook payload has no body; fetch it by id so the forward is readable.
  let body = {
    text: typeof data.text === "string" ? data.text : "",
    html: typeof data.html === "string" ? data.html : "",
  };
  if (!body.text && !body.html && data.email_id) {
    const fetched = await fetchEmailBody(resendApiKey, data.email_id, type);
    if (fetched) body = fetched;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM,
        to: [forwardTo],
        subject: forwardSubject,
        html: buildForwardHtml(type, data, rawJson, body),
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[resend-webhook] forward failed", errorData);
      // Still return 200 so Resend does not retry-storm on a downstream mail error.
      return res.status(200).json({ ok: true, forwarded: false, reason: "send_failed" });
    }
    return res.status(200).json({ ok: true, forwarded: true });
  } catch (error) {
    console.error("[resend-webhook] forward exception", error);
    return res.status(200).json({ ok: true, forwarded: false, reason: "exception" });
  }
}
