const DEFAULT_ORIGIN = "https://www.copilotai.live";

/**
 * Public origin used to build OAuth redirect URIs and the registered client id.
 * Configurable so preview deployments and local runs can complete the flow;
 * defaults to production.
 */
export function dashboardOrigin() {
  const configured = String(process.env.DASHBOARD_ORIGIN || "").trim();
  if (!configured) return DEFAULT_ORIGIN;
  try {
    const url = new URL(configured);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

export function clientMetadataUrl() {
  return `${dashboardOrigin()}/dashboard/client-metadata.json`;
}

export function authorizeRedirectUri() {
  return `${dashboardOrigin()}/authorize`;
}

/**
 * Origin check for state-changing requests, as defence in depth behind the
 * SameSite cookie attribute. A missing Origin header fails: browsers always send
 * one on POST/PUT/DELETE, so its absence means the caller is not a browser form
 * or fetch from this site.
 */
export function sameOriginRequest(req) {
  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
