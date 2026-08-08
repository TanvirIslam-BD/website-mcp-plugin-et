const MCPIZE_PROFILE_ENDPOINT = "https://be.mcpize.com/rest/v1/profiles";

// Read-only anon key published by MCPize's own web client, used solely to
// resolve the authenticated user's public profile fields. It belongs to a third
// party, so it is configured rather than committed; profile enrichment is simply
// skipped when unset.
function mcpizeAnonKey() {
  return String(process.env.MCPIZE_ANON_KEY || "");
}

export function cleanDisplayName(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80);
}

export function cleanProfilePhoto(value) {
  if (typeof value !== "string" || value.length > 500) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function profileIdFromSubject(value) {
  const subject = typeof value === "string" ? value.trim() : "";
  const uuid = subject.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  return uuid || "";
}

/*
 * TEMPORARY DIAGNOSTIC -- remove once the "Unnamed User" question is settled.
 *
 * Reports why a lookup produced no name, without putting anyone's name, username,
 * email or avatar URL into the logs: presence flags and lengths only, plus an
 * 8-character prefix of the profile id so a line can be matched against the owner
 * console without recording the whole identifier.
 *
 * Read the `outcome` field:
 *   no_anon_key  -> MCPIZE_ANON_KEY is unset in this environment. Enrichment never
 *                   runs, so every name depends on the access token's claims.
 *   no_profile_id-> no UUID could be found in the user id, so there is nothing to
 *                   look up. Points at the token subject's shape, not at MCPize.
 *   http_error   -> the key is set but the request was refused. 401/403 means the
 *                   key is wrong, revoked or expired.
 *   empty        -> the request succeeded and MCPize has no such profile row.
 *   ok           -> a row came back; hasFullName/hasUsername/hasAvatar say whether
 *                   it actually carries anything worth showing.
 */
function logProfileLookup(outcome, profileId, extra = {}) {
  console.log("[mcpize-profile]", JSON.stringify({
    outcome,
    profile: profileId ? `${profileId.slice(0, 8)}…` : "",
    ...extra,
  }));
}

export async function readMcpizeProfile(userId) {
  const anonKey = mcpizeAnonKey();
  const profileId = profileIdFromSubject(userId);
  if (!profileId || !anonKey) {
    logProfileLookup(anonKey ? "no_profile_id" : "no_anon_key", profileId);
    return { displayName: "", profilePhotoUrl: "" };
  }
  try {
    const url = new URL(MCPIZE_PROFILE_ENDPOINT);
    // MCP OAuth subjects may be namespaced, while profiles.id is a UUID.
    url.searchParams.set("id", `eq.${profileId}`);
    url.searchParams.set("select", "full_name,username,avatar_url");
    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      logProfileLookup("http_error", profileId, { status: response.status });
      return { displayName: "", profilePhotoUrl: "" };
    }
    const rows = await response.json().catch(() => []);
    const profile = Array.isArray(rows) ? rows[0] : null;
    if (!profile) {
      logProfileLookup("empty", profileId, { rowCount: Array.isArray(rows) ? rows.length : 0 });
      return { displayName: "", profilePhotoUrl: "" };
    }
    const resolved = {
      displayName: cleanDisplayName(profile.full_name || profile.username),
      profilePhotoUrl: cleanProfilePhoto(profile.avatar_url),
    };
    logProfileLookup("ok", profileId, {
      hasFullName: Boolean(profile.full_name),
      hasUsername: Boolean(profile.username),
      hasAvatar: Boolean(profile.avatar_url),
      // A field can be present and still be dropped by the cleaners -- a blank
      // full_name, or an avatar URL that is not https. Length rather than value.
      resolvedNameLength: resolved.displayName.length,
      resolvedPhoto: Boolean(resolved.profilePhotoUrl),
    });
    return resolved;
  } catch (error) {
    logProfileLookup("threw", profileId, {
      message: String((error && error.message) || error).slice(0, 120),
    });
    return { displayName: "", profilePhotoUrl: "" };
  }
}
