export { default } from "../site/api/resend-webhook.js";

// Declared here too so the platform reliably detects that this route needs the
// raw request body (signature verification) rather than a parsed one.
export const config = { api: { bodyParser: false } };
